import fs from 'node:fs';
import {execSync} from 'node:child_process';

const appPath='app/src/main/assets/app.js';
const testPath='tests/tv-ui-runtime-smoke.mjs';
const gradlePath='app/build.gradle';
let app=fs.readFileSync(appPath,'utf8');
let test=fs.readFileSync(testPath,'utf8');
let gradle=fs.readFileSync(gradlePath,'utf8');

function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`Missing anchor: ${label}`);
  return source.replace(from,to);
}

app=replaceOnce(app,"const ANDROID_CURRENT_VERSION='0.8.47';","const ANDROID_CURRENT_VERSION='0.8.48';",'app version');
app=replaceOnce(app,"const ANDROID_CURRENT_CHANGELOG=[\n",`const ANDROID_CURRENT_CHANGELOG=[\n  'Replaces first-run provider setup with a calm one-screen-at-a-time wizard: choose Xtream or M3U, enter only the fields that path needs, then connect.',\n  'Xtream first-run now asks for server URL, a friendly playlist name, username and password on separate screens; M3U asks only for playlist URL and playlist name before connecting.',\n  'Hides XMLTV, connection-helper, provider statistics, priority and management controls during onboarding while keeping the full Provider Manager available later in Settings.',\n`,'changelog');

app=replaceOnce(
  app,
  "let firstRunAvatarId='',firstRunStage=state.profiles.length?'done':(state.providers.length?'avatar':'provider'),firstRunProviderBusy=false,firstRunProviderReady=!state.profiles.length&&state.providers.length>0,firstRunProviderError='',firstRunAvatarConfirmed=false;",
  "let firstRunAvatarId='',firstRunStage=state.profiles.length?'done':(state.providers.length?'avatar':'provider'),firstRunProviderBusy=false,firstRunProviderReady=!state.profiles.length&&state.providers.length>0,firstRunProviderError='',firstRunAvatarConfirmed=false;\nlet firstRunProviderStep='method',firstRunProviderDraft={type:'',server:'',url:'',name:'',username:''};",
  'first-run provider wizard state'
);

const wizard=`function firstRunProviderWizardModal(){
  const type=firstRunProviderDraft.type||'',xtream=type==='xtream',step=firstRunProviderStep||'method';
  const total=xtream?5:3;
  const stepNumber=step==='method'?1:step==='address'?2:step==='name'?3:step==='username'?4:5;
  const progress=type?\`STEP \${Math.min(stepNumber,total)} OF \${total}\`:'STEP 1';
  const back=step==='method'?'':\`<button type="button" class="btn secondary" data-first-provider-back>Back</button>\`;
  const shell=(title,copy,body)=>\`<div class="modal-backdrop"><div class="modal provider-modal first-run-provider-wizard" data-modal-card><div class="modal-body provider-modal-body"><section class="provider-add-section"><div class="provider-add-heading"><span class="eyebrow">\${progress}</span><h2>\${title}</h2>\${copy?\`<p>\${copy}</p>\`:''}</div>\${body}<div id="providerStatus" aria-live="polite"></div></section></div></div></div>\`;
  if(step==='method')return shell('How do you sign in?','Choose the option your TV provider gave you.',\`<div class="provider-methods" aria-label="Provider type"><button type="button" class="provider-method" data-first-provider-method="xtream"><span class="provider-method-icon">X</span><span><strong>Xtream Codes</strong><small>Server, username and password</small></span></button><button type="button" class="provider-method" data-first-provider-method="m3u"><span class="provider-method-icon">M3U</span><span><strong>M3U Playlist</strong><small>Playlist URL</small></span></button></div>\`);
  if(step==='address'){
    const title=xtream?'What is your server URL?':'What is your M3U playlist URL?';
    const label=xtream?'Server URL':'Playlist URL',value=xtream?firstRunProviderDraft.server:firstRunProviderDraft.url;
    return shell(title,'Enter the address exactly as your provider gave it to you.',\`<div class="field"><label>\${label}</label><input data-first-provider-input type="url" value="\${esc(value||'')}" placeholder="http://..." autocomplete="url" autofocus></div><div class="cta-row">\${back}<button type="button" class="btn accent" data-first-provider-next>Next</button></div>\`);
  }
  if(step==='name'){
    const copy='This can be anything you want — for example Main TV, Family TV or Lounge.';
    if(!xtream)return shell('Name this playlist',copy,\`<form id="m3uForm"><input type="hidden" name="url" value="\${esc(firstRunProviderDraft.url||'')}"><input type="hidden" name="epgUrl" value=""><input type="hidden" name="remember" value="on"><div class="field"><label>Playlist name</label><input data-first-provider-input name="name" value="\${esc(firstRunProviderDraft.name||'')}" placeholder="Main TV" required autofocus></div><div class="cta-row">\${back}<button class="btn accent" type="submit">Connect</button></div></form>\`);
    return shell('Name this playlist',copy,\`<div class="field"><label>Playlist name</label><input data-first-provider-input value="\${esc(firstRunProviderDraft.name||'')}" placeholder="Main TV" autofocus></div><div class="cta-row">\${back}<button type="button" class="btn accent" data-first-provider-next>Next</button></div>\`);
  }
  if(step==='username')return shell('What is your username?','Use the username supplied by your TV provider.',\`<div class="field"><label>Username</label><input data-first-provider-input value="\${esc(firstRunProviderDraft.username||'')}" autocomplete="username" autofocus></div><div class="cta-row">\${back}<button type="button" class="btn accent" data-first-provider-next>Next</button></div>\`);
  return shell('Enter your password','One last step, then Swoop TV will connect.',\`<form id="xtreamForm"><input type="hidden" name="name" value="\${esc(firstRunProviderDraft.name||'Xtream Provider')}"><input type="hidden" name="server" value="\${esc(firstRunProviderDraft.server||'')}"><input type="hidden" name="username" value="\${esc(firstRunProviderDraft.username||'')}"><input type="hidden" name="relayUrl" value=""><input type="hidden" name="relayToken" value=""><input type="hidden" name="remember" value="on"><div class="field"><label>Password</label><input data-first-provider-input name="password" type="password" autocomplete="current-password" required autofocus></div><div class="cta-row">\${back}<button class="btn accent" type="submit">Connect</button></div></form>\`);
}

`;
app=replaceOnce(app,'function providerModal(){',wizard+"function providerModal(){\n  if(!state.profiles.length&&!state.providers.length)return firstRunProviderWizardModal();",'provider modal wizard entry');

app=replaceOnce(
  app,
  "document.querySelector('[data-first-provider-open]')?.addEventListener('click',()=>{firstRunStage='provider';modal='provider';profilePickerOpen=true;render();requestAnimationFrame(()=>document.querySelector('[data-provider-tab=\"xtream\"]')?.focus?.({preventScroll:true}))});",
  "document.querySelector('[data-first-provider-open]')?.addEventListener('click',()=>{firstRunStage='provider';firstRunProviderStep='method';firstRunProviderDraft={type:'',server:'',url:'',name:'',username:''};modal='provider';profilePickerOpen=true;render();requestAnimationFrame(()=>document.querySelector('[data-first-provider-method]')?.focus?.({preventScroll:true}))});\n  document.querySelectorAll('[data-first-provider-method]').forEach(el=>el.onclick=()=>{firstRunProviderDraft={type:el.dataset.firstProviderMethod||'',server:'',url:'',name:'',username:''};firstRunProviderStep='address';render();requestAnimationFrame(()=>document.querySelector('[data-first-provider-input]')?.focus?.({preventScroll:true}))});\n  document.querySelector('[data-first-provider-next]')?.addEventListener('click',()=>{const input=document.querySelector('[data-first-provider-input]'),value=String(input?.value||'').trim();if(!value){toast('Please enter this detail');input?.focus?.();return}if(firstRunProviderStep==='address'){if(firstRunProviderDraft.type==='xtream')firstRunProviderDraft.server=value;else firstRunProviderDraft.url=value;firstRunProviderStep='name'}else if(firstRunProviderStep==='name'){firstRunProviderDraft.name=value;firstRunProviderStep='username'}else if(firstRunProviderStep==='username'){firstRunProviderDraft.username=value;firstRunProviderStep='password'}render();requestAnimationFrame(()=>document.querySelector('[data-first-provider-input]')?.focus?.({preventScroll:true}))});\n  document.querySelector('[data-first-provider-back]')?.addEventListener('click',()=>{if(firstRunProviderStep==='address')firstRunProviderStep='method';else if(firstRunProviderStep==='name')firstRunProviderStep='address';else if(firstRunProviderStep==='username')firstRunProviderStep='name';else if(firstRunProviderStep==='password')firstRunProviderStep='username';render();requestAnimationFrame(()=>document.querySelector('[data-first-provider-input],[data-first-provider-method]')?.focus?.({preventScroll:true}))});",
  'first-run provider wizard events'
);

app=replaceOnce(app,"androidLatestManifest={version:ANDROID_CURRENT_VERSION,versionCode:845,changes:[...ANDROID_CURRENT_CHANGELOG]}","androidLatestManifest={version:ANDROID_CURRENT_VERSION,versionCode:848,changes:[...ANDROID_CURRENT_CHANGELOG]}",'whats new version code');

gradle=replaceOnce(gradle,'versionCode 847','versionCode 848','gradle version code');
gradle=replaceOnce(gradle,"versionName '0.8.47'","versionName '0.8.48'",'gradle version name');

test=replaceOnce(test,"const ANDROID_CURRENT_VERSION='0.8.47';","const ANDROID_CURRENT_VERSION='0.8.48';",'test version marker');
test=replaceOnce(
  test,
  "if (!appSource.includes('TV PROVIDER SIGN IN') || !appSource.includes('CHOOSE A LOGIN METHOD') || !appSource.includes('data-first-account-avatar') || !appSource.includes('completeFirstRunIfReady') || !appSource.includes('firstRunProviderBusy=true')) throw new Error('Provider-first background-loading avatar onboarding missing');",
  "if (!appSource.includes('function firstRunProviderWizardModal()') || !appSource.includes('data-first-provider-method') || !appSource.includes('data-first-provider-next') || !appSource.includes('Name this playlist') || !appSource.includes('data-first-account-avatar') || !appSource.includes('completeFirstRunIfReady') || !appSource.includes('firstRunProviderBusy=true')) throw new Error('Guided provider-first background-loading avatar onboarding missing');",
  'guided onboarding regression'
);

fs.writeFileSync(appPath,app);
fs.writeFileSync(testPath,test);
fs.writeFileSync(gradlePath,gradle);
fs.rmSync('.promotion/promote-pending.mjs');

execSync('git config user.name "Swoop081"');
execSync('git config user.email "justinbelot8@gmail.com"');
execSync(`git add ${appPath} ${testPath} ${gradlePath} .promotion/promote-pending.mjs`);
execSync('git commit -m "Promote v0.8.48 guided provider setup [skip ci]"');
execSync('git push origin HEAD:main');
console.log('Promoted v0.8.48 guided provider setup.');
