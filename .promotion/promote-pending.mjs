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
const cssPath='app/src/main/assets/styles.css';
const updaterPath='app/src/main/java/tv/swoop/player/SwoopUpdateManager.java';
const activityPath='app/src/main/java/tv/swoop/player/MainActivity.java';
const gradlePath='app/build.gradle';
const testPath='tests/tv-ui-runtime-smoke.mjs';
const swPath='app/src/main/assets/sw.js';

let app=read(appPath);
app=replaceOnce(app,"const ANDROID_CURRENT_VERSION='0.8.46';","const ANDROID_CURRENT_VERSION='0.8.47';",'Android UI version');
app=replaceOnce(app,"const ANDROID_CURRENT_CHANGELOG=[\n",`const ANDROID_CURRENT_CHANGELOG=[
  'Removes the manufactured Swoop TV/lion profile from clean first-run: zero accounts now shows a real Sign In entry with every avatar choice, then opens Xtream Codes or M3U provider setup.',
  'Slows playful startup lines to one every 15 seconds and reduces their TV size so each line can actually be read.',
  'Improves the Google TV install-permission handoff with package-specific Settings attempts plus visible guidance when firmware still opens the full unknown-sources list.',
`,'changelog');

app=replaceOnce(app,"if(!Array.isArray(state.sharedProviders))state.sharedProviders=[];\n",`if(!Array.isArray(state.sharedProviders))state.sharedProviders=[];
const FIRST_ACCOUNT_SCHEMA=1;
if(Number(state.settings.firstAccountSchemaVersion||0)<FIRST_ACCOUNT_SCHEMA){
  const legacyIndex=Array.isArray(state.profiles)?state.profiles.findIndex(p=>p?.id==='profile-main'&&String(p?.name||'').trim()==='Swoop TV'&&(p?.avatar||'lion')==='lion'&&!p?.kids&&!p?.pinHash&&['myList','continueWatching','watchHistory','recentLive','liveFavourites'].every(key=>!Array.isArray(p?.[key])||!p[key].length)):-1;
  if(legacyIndex>=0){
    state.profiles=state.profiles.filter((_,i)=>i!==legacyIndex);
    if(state.activeProfileId==='profile-main')state.activeProfileId=state.profiles[0]?.id||'';
  }
  state.settings.firstAccountSchemaVersion=FIRST_ACCOUNT_SCHEMA;
}
`,'first account migration');

app=replaceRegex(app,/function ensureProfiles\(\)\{\n  if\(!Array\.isArray\(state\.profiles\)\|\|!state\.profiles\.length\)\{[\s\S]*?\n  if\(state\.profiles\[0\]\)state\.profiles\[0\]\.providerMode='shared';\n\}/,`function ensureProfiles(){
  if(!Array.isArray(state.profiles))state.profiles=[];
  if(state.profiles.length){
    state.profiles=state.profiles.map((p,i)=>sanitizeLegacyDemoRefs(normalizeProfile(p,{name:p?.name||\`Profile \${i+1}\`,avatar:p?.avatar||PROFILE_AVATARS[i%PROFILE_AVATARS.length].id,profileSettings:{themeId:'swoop',backgroundColor:'#030306',backgroundOverride:false,movieSourcePreferences:{},homeRows:[...DEFAULT_HOME_ROWS],smartHomeOrder:true}})));
    if(!state.profiles.some(p=>p.id===state.activeProfileId))state.activeProfileId=state.profiles[0].id;
    state.profiles[0].providerMode='shared';
  }else state.activeProfileId='';
}`,'ensureProfiles zero-account support');

app=replaceOnce(app,"let profilePickerOpen=true,profileEditId='',pendingProfileId='',profilePinError='';","let profilePickerOpen=true,profileEditId='',pendingProfileId='',profilePinError='';\nlet firstRunAvatarId='lion';",'first-run avatar state');

app=replaceRegex(app,/function profilePickerPage\(\)\{[\s\S]*?\nfunction profilesModal\(\)\{/,`function profilePickerPage(){
  const profiles=state.profiles||[];
  if(!profiles.length){
    return \`<main class="profile-picker-page first-account-page"><div class="profile-picker-brand"><span class="brand-mark">S</span><span>SWOOP <b>TV</b></span></div><div class="profile-picker-shell first-account-shell"><div class="eyebrow">WELCOME TO SWOOP TV</div><h1>Sign in</h1><p>Choose your avatar. Your TV provider comes next.</p><div class="first-account-avatar-grid">\${PROFILE_AVATARS.map(av=>\`<button type="button" class="first-account-avatar-choice \${firstRunAvatarId===av.id?'active':''}" data-first-account-avatar="\${esc(av.id)}" aria-pressed="\${firstRunAvatarId===av.id?'true':'false'}">\${profileAvatarHtml({name:av.label,avatar:av.id},'profile-avatar-first-run')}<strong>\${esc(av.label)}</strong></button>\`).join('')}</div><button class="btn accent first-account-signin" data-first-account-submit>Sign In</button><small class="first-account-next">Next: choose Xtream Codes or M3U Playlist and enter your provider login.</small></div></main>\`;
  }
  return \`<main class="profile-picker-page"><div class="profile-picker-brand"><span class="brand-mark">S</span><span>SWOOP <b>TV</b></span></div><div class="profile-picker-shell"><div class="eyebrow">PERSONALISED SWOOP TV</div><h1>Who’s watching?</h1><p>Every profile gets its own theme, Home layout, recommendations, Continue Watching, My SwoopTV saves and favorite channels.</p><div class="profile-picker-grid">\${profiles.map(p=>{const t=profileTheme(p);return \`<button class="profile-choice profile-theme-\${esc(t.id)}" data-profile-select="\${esc(p.id)}">\${profileAvatarHtml(p,'profile-avatar-xl')}<strong>\${esc(p.name)}</strong><span>\${p.kids?'Kids profile':'Personal profile'}\${p.pinHash?' · PIN':''}\${profileProviderMode(p)==='private'?' · Private providers':' · Shared providers'}</span><em class="profile-theme-chip" style="--theme-chip:\${esc(t.swatch)}">\${esc(t.name)}</em></button>\`}).join('')}<button class="profile-choice profile-add-choice" data-profile-add>\${profileAvatarHtml({name:'+',avatar:'elephant'},'profile-avatar-xl')}<strong>Add Profile</strong><span>Create another personalised Swoop TV</span><em class="profile-theme-chip">Choose a theme</em></button></div>\${NATIVE_ANDROID?\`<div class="profile-starmeter-prep \${starmeterBackgroundComplete?'ready':''}" data-profile-starmeter-prep><div class="profile-starmeter-prep-line"><strong data-profile-starmeter-copy>\${starmeterBackgroundComplete?'Ready':'Please wait…'}</strong><span data-profile-starmeter-percent>\${starmeterBackgroundComplete?'✓':\`\${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%\`}</span></div><div class="profile-starmeter-progress"><i data-profile-starmeter-bar style="width:\${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%"></i></div></div>\`:''}<div class="profile-picker-actions"><button class="btn secondary" data-profile-manage>Manage Profiles</button><button class="btn secondary" data-page="settings">⚙ Settings</button></div></div></main>\`;
}
function focusDefaultProfileChoice(){
  if(!NATIVE_ANDROID||!profilePickerOpen)return false;
  const first=document.querySelector('[data-profile-select],[data-first-account-avatar].active,[data-first-account-submit]');
  if(!first)return false;
  try{first.focus({preventScroll:true})}catch{first.focus()}
  tvLastFocusedElement=first;
  return true;
}
function profilesModal(){`,'profile picker first-run state');

app=replaceOnce(app,"  document.querySelectorAll('[data-profile-add]').forEach(el=>el.onclick=()=>{profilePickerOpen=false;profileEditId='';modal='profileEdit';render()});\n",`  document.querySelectorAll('[data-profile-add]').forEach(el=>el.onclick=()=>{profilePickerOpen=false;profileEditId='';modal='profileEdit';render()});
  document.querySelectorAll('[data-first-account-avatar]').forEach(el=>el.onclick=()=>{
    firstRunAvatarId=avatarById(el.dataset.firstAccountAvatar||'lion').id;
    document.querySelectorAll('[data-first-account-avatar]').forEach(x=>{
      const active=x.dataset.firstAccountAvatar===firstRunAvatarId;
      x.classList.toggle('active',active);
      x.setAttribute('aria-pressed',active?'true':'false');
    });
  });
  document.querySelector('[data-first-account-submit]')?.addEventListener('click',async()=>{
    if(state.profiles.length)return;
    const first=makeProfile({name:'Profile 1',avatar:firstRunAvatarId,providerMode:'shared',myList:[...(state.myList||[])],continueWatching:[...(state.continueWatching||[])],watchHistory:[...(state.watchHistory||[])],recentLive:[...(state.recentLive||[])],liveFavourites:[...(state.liveFavourites||[])],privateProviders:[],profileSettings:profileSettingsSnapshot()});
    state.profiles=[first];
    state.activeProfileId=first.id;
    applyProfileToState(first);
    profilePickerOpen=false;
    profileEditId='';
    modal='provider';
    await persist();
    render();
    requestAnimationFrame(()=>document.querySelector('[data-provider-tab="xtream"]')?.focus?.({preventScroll:true}));
  });
`,'first account bind');

app=replaceOnce(app,"tick();androidBootFunTimer=setInterval(()=>{androidBootFunIndex=(androidBootFunIndex+1)%ANDROID_BOOT_FUN_LINES.length;tick()},1350);","tick();androidBootFunTimer=setInterval(()=>{androidBootFunIndex=(androidBootFunIndex+1)%ANDROID_BOOT_FUN_LINES.length;tick()},15000);",'15 second startup lines');

app=replaceOnce(app,"  const providers=state.providers.slice().sort((a,b)=>Number(a.priority)-Number(b.priority));","  const providers=state.providers.slice().sort((a,b)=>Number(a.priority)-Number(b.priority));\n  const firstProvider=!providers.length;",'first provider state');
app=replaceOnce(app,'<div class="eyebrow">TV PROVIDERS</div><h2>Provider Manager</h2><p>Add, update or remove your TV providers.</p>','<div class="eyebrow">${firstProvider?\'TV PROVIDER SIGN IN\':\'TV PROVIDERS\'}</div><h2>${firstProvider?\'Connect your TV provider\':\'Provider Manager\'}</h2><p>${firstProvider?\'Choose Xtream Codes or M3U Playlist to continue.\':\'Add, update or remove your TV providers.\'}</p>','provider modal first-run title');
app=replaceOnce(app,'<span class="eyebrow">ADD ANOTHER PROVIDER</span><h3>Connect a TV service</h3><p>Add another provider to your Swoop TV library.</p>','<span class="eyebrow">${firstProvider?\'CHOOSE A LOGIN METHOD\':\'ADD ANOTHER PROVIDER\'}</span><h3>${firstProvider?\'Sign in to your TV service\':\'Connect a TV service\'}</h3><p>${firstProvider?\'Select the login format supplied by your TV provider.\':\'Add another provider to your Swoop TV library.\'}</p>','provider modal first-run heading');

app=replaceOnce(app,"<small>Updates install over the existing Swoop TV app so providers, playlists, Favorites, Continue Watching and profile settings stay on this device. Downloader 3682231 remains the fallback installer.</small>","<small>Updates install over the existing Swoop TV app so providers, playlists, Favorites, Continue Watching and profile settings stay on this device. Downloader 3682231 remains the fallback installer.${!permission?' If Android shows the full Install unknown apps list, scroll to Swoop TV, switch it On, then press Back.':''}</small>",'permission guidance');
write(appPath,app);

let css=read(cssPath);
css += `

/* v0.8.47 — zero-account first-run and readable cinema copy. */
.first-account-shell{display:grid;justify-items:center}
.first-account-avatar-grid{width:min(1180px,94vw);display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:16px 20px;margin:8px auto 26px}
.first-account-avatar-choice{appearance:none;border:2px solid transparent;background:transparent;color:#fff;border-radius:18px;padding:8px 4px;display:grid;justify-items:center;gap:7px;cursor:pointer;opacity:.74}
.first-account-avatar-choice.active,.first-account-avatar-choice:focus-visible{opacity:1;border-color:#fff;background:rgba(255,255,255,.07);outline:none}
.profile-avatar-first-run{width:88px;height:88px;border-radius:20px}
.profile-avatar-first-run img{width:100%;height:100%;object-fit:cover}
.first-account-avatar-choice strong{font-size:12px}
.first-account-signin{min-width:240px;font-size:18px;padding:15px 34px}
.first-account-next{display:block;margin-top:12px;color:#858a95;font-size:11px}
html.android-tv .first-account-page{padding:42px 4vw 28px!important}
html.android-tv .first-account-page .profile-picker-shell h1{font-size:clamp(48px,5.5vw,72px)!important;margin:6px 0 10px!important}
html.android-tv .first-account-page .profile-picker-shell>p{margin-bottom:18px!important;font-size:13px!important}
html.android-tv .first-account-avatar-grid{grid-template-columns:repeat(10,minmax(78px,1fr));gap:12px;width:min(1320px,94vw);margin-bottom:22px}
html.android-tv .profile-avatar-first-run{width:82px;height:82px;border-radius:18px}
html.android-tv .first-account-avatar-choice{padding:7px 2px;gap:6px}
html.android-tv .startup-cinema-card .boot-fun-title{font-size:clamp(24px,2.6vw,38px)!important;line-height:1.12!important;min-height:1.2em!important}
`;
write(cssPath,css);

let updater=read(updaterPath);
updater=replaceOnce(updater,'import android.content.Intent;','import android.content.ComponentName;\nimport android.content.Intent;','ComponentName import');
updater=replaceOnce(updater,'import android.util.Log;','import android.util.Log;\nimport android.widget.Toast;','Toast import');
updater=replaceRegex(updater,/    String openInstallPermissionSettings\(\) \{[\s\S]*?\n    \}\n\n    String statusJson\(\)/,`    String openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return statusJson();
        main.post(() -> {
            String packageName = activity.getPackageName();
            Uri packageUri = Uri.parse("package:" + packageName);
            try {
                Toast.makeText(activity, "Turn on Swoop TV. If Android shows a full list, scroll to Swoop TV, switch it On, then press Back.", Toast.LENGTH_LONG).show();
            } catch (Exception ignored) {}

            Intent phoneSpecific = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, packageUri)
                    .setComponent(new ComponentName("com.android.settings", "com.android.settings.Settings$ManageAppExternalSourcesActivity"));
            Intent tvLegacySpecific = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, packageUri)
                    .setComponent(new ComponentName("com.android.tv.settings", "com.android.tv.settings.device.apps.specialaccess.ManageExternalSourcesActivity"));
            Intent tvCurrentSpecific = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, packageUri)
                    .setComponent(new ComponentName("com.android.tv.settings", "com.android.tv.settings.device.apps.specialaccess.ExternalSourcesActivity"));
            Intent packageSpecific = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, packageUri);
            Intent generic = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            Intent security = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            Intent appDetails = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri);

            Intent[] candidates = new Intent[] {
                    phoneSpecific,
                    tvLegacySpecific,
                    tvCurrentSpecific,
                    packageSpecific,
                    generic,
                    security,
                    appDetails
            };
            Exception lastError = null;
            for (Intent intent : candidates) {
                try {
                    intent.putExtra(Intent.EXTRA_PACKAGE_NAME, packageName);
                    intent.putExtra("android.provider.extra.APP_PACKAGE", packageName);
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NO_HISTORY);
                    activity.startActivity(intent);
                    Log.i(TAG, "Opened update install settings with " + intent.getAction() + " component=" + intent.getComponent());
                    return;
                } catch (Exception e) {
                    lastError = e;
                    Log.w(TAG, "Update settings intent unavailable: " + intent.getAction() + " component=" + intent.getComponent(), e);
                }
            }
            String message = "Could not open Android update-install settings. Open Settings > Apps > Special app access > Install unknown apps, choose Swoop TV and switch it On.";
            if (lastError != null) Log.e(TAG, message, lastError);
            setState("permission_required", message, 0);
        });
        return statusJson();
    }

    String statusJson()`,'permission handoff');
write(updaterPath,updater);

let activity=read(activityPath);
activity=replaceOnce(activity,'SwoopTV/0.8.46 AndroidTV','SwoopTV/0.8.47 AndroidTV','native user-agent version');
write(activityPath,activity);

let gradle=read(gradlePath);
gradle=replaceOnce(gradle,'versionCode 846','versionCode 847','versionCode');
gradle=replaceOnce(gradle,"versionName '0.8.46'","versionName '0.8.47'",'versionName');
write(gradlePath,gradle);

let sw=read(swPath);
sw=replaceOnce(sw,"const CACHE='swoop-tv-v0840-shell';","const CACHE='swoop-tv-v0847-shell';",'service worker cache');
write(swPath,sw);

let tests=read(testPath);
tests=replaceOnce(tests,"const ANDROID_CURRENT_VERSION='0.8.46';","const ANDROID_CURRENT_VERSION='0.8.47';",'test Android version marker');
const anchor="if (!appSource.includes(\"const ANDROID_CURRENT_VERSION='0.8.47';\")) throw new Error('Current Android UI version marker missing');";
tests=replaceOnce(tests,anchor,`${anchor}
if (appSource.includes("id:'profile-main',name:'Swoop TV',avatar:'lion'")) throw new Error('Manufactured Swoop TV/lion first-run profile still exists');
if (!appSource.includes('const FIRST_ACCOUNT_SCHEMA=1;') || !appSource.includes('data-first-account-submit') || !appSource.includes('data-first-account-avatar')) throw new Error('Zero-account Sign In/avatar onboarding missing');
if (!appSource.includes('setInterval(()=>{androidBootFunIndex=(androidBootFunIndex+1)%ANDROID_BOOT_FUN_LINES.length;tick()},15000)')) throw new Error('Cinema loading messages are not held for 15 seconds');
if (!cssSource.includes('.first-account-avatar-grid') || !cssSource.includes('font-size:clamp(24px,2.6vw,38px)!important')) throw new Error('First-run avatar layout or smaller startup copy missing');
if (!updaterSource.includes('ManageAppExternalSourcesActivity') || !updaterSource.includes('Intent.EXTRA_PACKAGE_NAME') || !updaterSource.includes('Toast.makeText')) throw new Error('Direct-app install-permission guidance/fallback missing');
if (!appSource.includes('TV PROVIDER SIGN IN') || !appSource.includes('CHOOSE A LOGIN METHOD')) throw new Error('First provider Xtream/M3U onboarding copy missing');`,'v0.8.47 regression contracts');
write(testPath,tests);

fs.rmSync('.promotion/promote-pending.mjs',{force:true});
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add',appPath,cssPath,updaterPath,activityPath,gradlePath,testPath,swPath,'.promotion/promote-pending.mjs']);
execFileSync('git',['commit','-m','Promote v0.8.47 first-run onboarding and permission UX [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Promoted v0.8.47 first-run onboarding and permission UX.');
