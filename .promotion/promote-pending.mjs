import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`Missing anchor: ${label}`);
  return source.replace(from,to);
}
function replaceRegex(source,re,to,label){
  if(!re.test(source))throw new Error(`Missing regex anchor: ${label}`);
  return source.replace(re,to);
}

const appPath='app/src/main/assets/app.js';
const testPath='tests/tv-ui-runtime-smoke.mjs';
const notesPath='RELEASE_NOTES.md';
const profilesPath='app/src/main/assets/src/profiles.js';
const swPath='app/src/main/assets/sw.js';

let app=read(appPath);

const stagedAvatars=[
  ['cheetah','Cheetah'],['seal','Seal'],['triceratops','Triceratops'],['capybara','Capybara'],['panda','Panda'],
  ['dinosaur','Dinosaur'],['red-panda','Red Panda'],['kangaroo','Kangaroo'],['dog','Dog'],['cat','Cat']
];
for(const [id] of stagedAvatars){
  const src=`.staging/avatars/${id}.jpg`,dst=`app/src/main/assets/assets/avatar-${id}.jpg`;
  if(!fs.existsSync(src))throw new Error(`Missing staged avatar: ${src}`);
  fs.copyFileSync(src,dst);
}
let profiles=read(profilesPath);
const avatarAnchor="  {id:'tiger',label:'Tiger',image:'./assets/avatar-tiger.jpeg'}\n];";
const avatarRows=stagedAvatars.map(([id,label])=>`  {id:'${id}',label:'${label}',image:'./assets/avatar-${id}.jpg'}`).join(',\n');
profiles=replaceOnce(profiles,avatarAnchor,`  {id:'tiger',label:'Tiger',image:'./assets/avatar-tiger.jpeg'},\n${avatarRows}\n];`,'user avatar menu expansion');
write(profilesPath,profiles);

let sw=read(swPath);
const swAvatarAnchor="'./assets/avatar-tiger.jpeg'";
const swExtra=stagedAvatars.map(([id])=>`'./assets/avatar-${id}.jpg'`).join(',');
sw=replaceOnce(sw,swAvatarAnchor,`${swAvatarAnchor},${swExtra}`,'service worker avatar cache');
write(swPath,sw);


app=replaceOnce(
  app,
  "  'Removes the manufactured Swoop TV/lion profile from clean first-run: zero accounts now shows a real Sign In entry with every avatar choice, then opens Xtream Codes or M3U provider setup.',",
  "  'Reorders clean first-run so the customer connects Xtream Codes or M3U first; provider/library work then continues behind the avatar chooser before Swoop TV opens.',",
  'v0.8.47 provider-first changelog'
);
app=replaceOnce(app,"const ANDROID_CURRENT_CHANGELOG=[\n",`const ANDROID_CURRENT_CHANGELOG=[\n  'Adds ten new first-run avatar choices supplied for Swoop TV: Cheetah, Seal, Triceratops, Capybara, Panda, Dinosaur, Red Panda, Kangaroo, Dog and Cat.',\n`,'avatar changelog');

app=replaceOnce(
  app,
  "let modal=null,continueOptionsTarget=null,toastTimer=null,playerItem=null,playerUiHidden=false,activeHls=null,trailerKey='',trailerTitle='',sourceChoiceItem=null;",
  "let modal=(state.profiles.length||state.providers.length)?null:'provider',continueOptionsTarget=null,toastTimer=null,playerItem=null,playerUiHidden=false,activeHls=null,trailerKey='',trailerTitle='',sourceChoiceItem=null;",
  'first-run provider modal default'
);

app=replaceOnce(
  app,
  "let firstRunAvatarId='lion';",
  "let firstRunAvatarId='',firstRunStage=state.profiles.length?'done':(state.providers.length?'avatar':'provider'),firstRunProviderBusy=false,firstRunProviderReady=!state.profiles.length&&state.providers.length>0,firstRunProviderError='',firstRunAvatarConfirmed=false;",
  'first-run stage state'
);

app=replaceRegex(
  app,
  /function profilePickerPage\(\)\{\n  const profiles=state\.profiles\|\|\[\];\n  if\(!profiles\.length\)\{[\s\S]*?\n  \}\n  return `<main class="profile-picker-page">/,
  `function profilePickerPage(){
  const profiles=state.profiles||[];
  if(!profiles.length){
    if(firstRunStage==='provider')return \`<main class="profile-picker-page first-account-page first-provider-landing"><div class="profile-picker-brand"><span class="brand-mark">S</span><span>SWOOP <b>TV</b></span></div><div class="profile-picker-shell first-account-shell"><div class="eyebrow">WELCOME TO SWOOP TV</div><h1>Connect your TV provider</h1><p>Start with Xtream Codes or M3U. Once the login is accepted, Swoop TV starts preparing everything while you choose an avatar.</p><button class="btn accent first-account-signin" data-first-provider-open>Connect Provider</button></div></main>\`;
    const waiting=firstRunAvatarConfirmed&&!firstRunProviderReady;
    return \`<main class="profile-picker-page first-account-page"><div class="profile-picker-brand"><span class="brand-mark">S</span><span>SWOOP <b>TV</b></span></div><div class="profile-picker-shell first-account-shell"><div class="eyebrow">MAKE IT YOURS</div><h1>Choose your avatar</h1><p>Your provider is already loading behind this screen. Pick the one that feels like you.</p><div class="first-account-avatar-grid">\${PROFILE_AVATARS.map(av=>\`<button type="button" class="first-account-avatar-choice \${firstRunAvatarId===av.id?'active':''}" data-first-account-avatar="\${esc(av.id)}" aria-pressed="\${firstRunAvatarId===av.id?'true':'false'}" \${firstRunAvatarConfirmed?'disabled':''}>\${profileAvatarHtml({name:av.label,avatar:av.id},'profile-avatar-first-run')}<strong>\${esc(av.label)}</strong></button>\`).join('')}</div><button class="btn accent first-account-signin" data-first-account-submit \${!firstRunAvatarId||firstRunAvatarConfirmed?'disabled':''}>\${waiting?'Great choice — almost showtime':firstRunProviderReady?'Continue':'Use this avatar'}</button><small class="first-account-next">\${waiting?'Swoop TV will continue automatically as soon as everything is ready.':'Your provider and library preparation continue in the background while you choose.'}</small></div></main>\`;
  }
  return \`<main class="profile-picker-page">`,
  'provider-first zero-account picker'
);

app=replaceOnce(
  app,
  "function focusDefaultProfileChoice(){",
  `async function completeFirstRunIfReady(){
  if(state.profiles.length||!firstRunAvatarConfirmed||!firstRunProviderReady||!firstRunAvatarId)return false;
  const first=makeProfile({name:'Profile 1',avatar:firstRunAvatarId,providerMode:'shared',myList:[...(state.myList||[])],continueWatching:[...(state.continueWatching||[])],watchHistory:[...(state.watchHistory||[])],recentLive:[...(state.recentLive||[])],liveFavourites:[...(state.liveFavourites||[])],privateProviders:[],profileSettings:profileSettingsSnapshot()});
  state.sharedProviders=cloneProviderRecords(state.providers);
  state.profiles=[first];
  state.activeProfileId=first.id;
  applyProfileToState(first);
  firstRunStage='done';
  firstRunProviderBusy=false;
  firstRunAvatarConfirmed=false;
  profilePickerOpen=false;
  profileEditId='';
  modal=null;
  state.page='home';
  await persist(NATIVE_WINDOWS?'cache':true).catch(()=>false);
  render();
  if(NATIVE_ANDROID)requestAnimationFrame(()=>forceAndroidHomeEntry());
  return true;
}
function focusDefaultProfileChoice(){`,
  'first-run completion helper'
);

app=replaceOnce(
  app,
  "  if(!NATIVE_ANDROID||!profilePickerOpen)return false;\n  const first=document.querySelector('[data-profile-select],[data-first-account-avatar].active,[data-first-account-submit]');\n  if(!first)return false;",
  "  if(!NATIVE_ANDROID||!profilePickerOpen)return false;\n  const first=document.querySelector('[data-profile-select],[data-first-account-avatar].active,[data-first-account-avatar],[data-first-account-submit],[data-first-provider-open]');\n  if(!first)return false;",
  'first-run focus target'
);

app=replaceRegex(
  app,
  /  document\.querySelector\('\[data-first-account-submit\]'\)\?\.addEventListener\('click',async\(\)=>\{[\s\S]*?\n  \}\);\n  document\.querySelectorAll\('\[data-profile-edit\]'\)/,
  `  document.querySelector('[data-first-provider-open]')?.addEventListener('click',()=>{firstRunStage='provider';modal='provider';profilePickerOpen=true;render();requestAnimationFrame(()=>document.querySelector('[data-provider-tab="xtream"]')?.focus?.({preventScroll:true}))});
  document.querySelector('[data-first-account-submit]')?.addEventListener('click',async()=>{
    if(state.profiles.length)return;
    if(!firstRunAvatarId){toast('Choose an avatar');return}
    firstRunAvatarConfirmed=true;
    render();
    await completeFirstRunIfReady();
  });
  document.querySelectorAll('[data-profile-edit]')`,
  'first-run avatar submit'
);

app=replaceOnce(
  app,
  "  const firstProvider=!providers.length;",
  "  const firstProvider=!providers.length,firstRun=!state.profiles.length;",
  'provider modal first-run flag'
);

app=replaceOnce(
  app,
  'return `<div class="modal-backdrop" data-close-modal><div class="modal provider-modal multi-provider-modal" data-modal-card><div class="modal-head provider-modal-head"><div><div class="eyebrow">${firstProvider?\'TV PROVIDER SIGN IN\':\'TV PROVIDERS\'}</div><h2>${firstProvider?\'Connect your TV provider\':\'Provider Manager\'}</h2><p>${firstProvider?\'Choose Xtream Codes or M3U Playlist to continue.\':\'Add, update or remove your TV providers.\'}</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div><div class="modal-body provider-modal-body">${providerCards}<div id="providerSetup">',
  'return `<div class="modal-backdrop" ${firstRun?\'\':\'data-close-modal\'}><div class="modal provider-modal multi-provider-modal" data-modal-card><div class="modal-head provider-modal-head"><div><div class="eyebrow">${firstRun?\'TV PROVIDER SIGN IN\':\'TV PROVIDERS\'}</div><h2>${firstRun?\'Connect your TV provider\':\'Provider Manager\'}</h2><p>${firstRun?\'Choose Xtream Codes or M3U. Once accepted, your library starts loading while you choose an avatar.\':\'Add, update or remove your TV providers.\'}</p></div>${firstRun?\'\':\'<button class="icon-btn" data-close aria-label="Close">✕</button>\'}</div><div class="modal-body provider-modal-body">${firstRun?\'\':providerCards}<div id="providerSetup">',
  'provider modal first-run shell'
);

app=replaceOnce(
  app,
  '<div class="provider-add-heading"><span class="eyebrow">${firstProvider?\'CHOOSE A LOGIN METHOD\':\'ADD ANOTHER PROVIDER\'}</span><h3>${firstProvider?\'Sign in to your TV service\':\'Connect a TV service\'}</h3><p>${firstProvider?\'Select the login format supplied by your TV provider.\':\'Add another provider to your Swoop TV library.\'}</p></div>',
  '<div class="provider-add-heading"><span class="eyebrow">${firstRun?\'CHOOSE A LOGIN METHOD\':\'ADD ANOTHER PROVIDER\'}</span><h3>${firstRun?\'How do you sign in?\':\'Connect a TV service\'}</h3><p>${firstRun?\'Enter your provider details first. Swoop TV will do the heavy loading behind the avatar screen.\':\'Add another provider to your Swoop TV library.\'}</p></div>',
  'provider modal first-run login copy'
);

app=replaceOnce(
  app,
  "providerProgressStart('m3u',name);try{",
  "const firstRun=!state.profiles.length;providerProgressStart('m3u',name);if(firstRun){firstRunProviderBusy=true;firstRunProviderReady=false;firstRunProviderError='';firstRunStage='avatar';modal=null;profilePickerOpen=true;render();}try{",
  'M3U first-run background start'
);

app=replaceOnce(
  app,
  "providerProgressStart('xtream',name);try{",
  "const firstRun=!state.profiles.length;providerProgressStart('xtream',name);try{",
  'Xtream first-run flag'
);

app=replaceOnce(
  app,
  "providerProgressMark('auth','Authorised');providerProgressUpdate({step:'live',progress:26,title:'Loading this provider library…',detail:'Live TV, Movies and TV Shows are loading. Your existing providers remain available.'});",
  "providerProgressMark('auth','Authorised');if(firstRun){firstRunProviderBusy=true;firstRunProviderReady=false;firstRunProviderError='';firstRunStage='avatar';modal=null;profilePickerOpen=true;render();}providerProgressUpdate({step:'live',progress:26,title:'Loading this provider library…',detail:'Live TV, Movies and TV Shows are loading. Your existing providers remain available.'});",
  'Xtream avatar handoff after auth'
);

const firstRunSuccess = "providerProgressMark('save','Ready');providerProgressSuccess(`${name} added · ${counts.live.toLocaleString()} live · ${counts.movie.toLocaleString()} movies · ${counts.series.toLocaleString()} shows`)}catch(err){providerProgressError(err.message||String(err))}});";
const firstRunReplacement = "providerProgressMark('save','Ready');if(firstRun){firstRunProviderBusy=false;firstRunProviderReady=true;firstRunProviderError='';firstRunStage='avatar';void completeFirstRunIfReady();if(!firstRunAvatarConfirmed)render()}else providerProgressSuccess(`${name} added · ${counts.live.toLocaleString()} live · ${counts.movie.toLocaleString()} movies · ${counts.series.toLocaleString()} shows`)}catch(err){if(firstRun){firstRunProviderBusy=false;firstRunProviderReady=false;firstRunProviderError=err.message||String(err);firstRunStage='provider';firstRunAvatarConfirmed=false;modal='provider';profilePickerOpen=true;render();requestAnimationFrame(()=>setStatus('#providerStatus',firstRunProviderError,'err'))}else providerProgressError(err.message||String(err))}});";
app=replaceOnce(app,firstRunSuccess,firstRunReplacement,'M3U first-run completion');
app=replaceOnce(app,firstRunSuccess,firstRunReplacement,'Xtream first-run completion');

write(appPath,app);

let tests=read(testPath);
tests=replaceOnce(
  tests,
  "if (!appSource.includes('const FIRST_ACCOUNT_SCHEMA=1;') || !appSource.includes('data-first-account-submit') || !appSource.includes('data-first-account-avatar')) throw new Error('Zero-account Sign In/avatar onboarding missing');",
  "if (!appSource.includes('const FIRST_ACCOUNT_SCHEMA=1;') || !appSource.includes(\"firstRunStage=state.profiles.length?'done':(state.providers.length?'avatar':'provider')\") || !appSource.includes(\"let modal=(state.profiles.length||state.providers.length)?null:'provider'\")) throw new Error('Zero-account provider-first onboarding missing');",
  'first-run regression contract'
);
tests=replaceOnce(
  tests,
  "if (!appSource.includes('TV PROVIDER SIGN IN') || !appSource.includes('CHOOSE A LOGIN METHOD')) throw new Error('First provider Xtream/M3U onboarding copy missing');",
  "if (!appSource.includes('TV PROVIDER SIGN IN') || !appSource.includes('CHOOSE A LOGIN METHOD') || !appSource.includes('data-first-account-avatar') || !appSource.includes('completeFirstRunIfReady') || !appSource.includes('firstRunProviderBusy=true')) throw new Error('Provider-first background-loading avatar onboarding missing');",
  'provider-first loading regression'
);
tests += `\nif (!profilesSource.includes("id:'cheetah'") || !profilesSource.includes("id:'cat'") || !profilesSource.includes("id:'red-panda'")) throw new Error('Supplied first-run avatar expansion missing');\n`;
write(testPath,tests);

let notes=read(notesPath);
if(!notes.includes('## v0.8.47')){
  notes=`## v0.8.47 — Provider-First First Run + Guided TV Setup

- Removes the manufactured **Swoop TV / lion** profile from clean first-run. With no real account, Swoop TV does not pretend one exists.
- Reorders first-run to **TV provider first**: choose **Xtream Codes** or **M3U**, enter the provider details, then move to avatar selection.
- Starts provider/library preparation before the avatar chooser appears. Heavy import, local library preparation and performance work continue **behind the avatar selection screen** while the customer makes the only required personal choice.
- Adds the ten supplied avatar portraits to the chooser: **Cheetah, Seal, Triceratops, Capybara, Panda, Dinosaur, Red Panda, Kangaroo, Dog and Cat**, alongside the existing Swoop TV avatars.
- No avatar is preselected. The customer deliberately chooses one; if loading is still finishing after that choice, Swoop TV continues automatically as soon as it is ready.
- Existing provider data survives the migration: if an upgraded device already has a provider but only the old manufactured Swoop TV profile, it goes straight to avatar choice instead of asking for the provider again.
- Startup cinema messages are smaller and remain on screen for **15 seconds each** so they can actually be read.
- Improves Android/Google TV **Install unknown apps** routing with package-specific Settings attempts and explicit Swoop TV guidance when firmware still insists on showing the full app list.
- Retains v0.8.46 credential privacy: secondary accounts remain Private by default and household provider sharing requires explicit opt-in.
- Android versionName/versionCode: **0.8.47 / 847**.

${notes}`;
  write(notesPath,notes);
}

fs.rmSync('.staging/avatars',{recursive:true,force:true});
if(fs.existsSync('.promotion/promote-pending.mjs'))fs.unlinkSync('.promotion/promote-pending.mjs');
execFileSync('git',['config','user.name','Swoop081']);
execFileSync('git',['config','user.email','justinbelot8@gmail.com']);
execFileSync('git',['add','-A',appPath,testPath,notesPath,profilesPath,swPath,'app/src/main/assets/assets','.staging/avatars','.promotion/promote-pending.mjs']);
execFileSync('git',['commit','-m','Finish v0.8.47 provider-first onboarding [skip ci]']);
execFileSync('git',['push','origin','HEAD:main']);
console.log('Promoted v0.8.47 provider-first onboarding.');