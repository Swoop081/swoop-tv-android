import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s,'utf8');
function replaceOnce(path,from,to,label){
  let s=read(path);
  const first=s.indexOf(from);
  if(first<0)throw new Error(`Missing ${label} in ${path}`);
  if(s.indexOf(from,first+from.length)>=0)throw new Error(`Ambiguous ${label} in ${path}`);
  s=s.slice(0,first)+to+s.slice(first+from.length);
  write(path,s);
}

const app='app/src/main/assets/app.js';
const css='app/src/main/assets/styles.css';
const gradle='app/build.gradle';
const tests='tests/tv-ui-runtime-smoke.mjs';
const sw='app/src/main/assets/sw.js';
const notes='RELEASE_NOTES.md';

replaceOnce(app,"const ANDROID_CURRENT_VERSION='0.8.50';","const ANDROID_CURRENT_VERSION='0.8.51';",'Android runtime version');
replaceOnce(app,"const ANDROID_CURRENT_CHANGELOG=[\n",`const ANDROID_CURRENT_CHANGELOG=[\n  'Fixes the Google TV launch race that could reopen Who’s Watching after a profile had already entered Home.',\n  'Who’s Watching no longer exposes STARmeter optimisation as a loading gate; STARmeter preparation now runs after profile entry in the background.',\n  'Prevents the profile-screen progress indicator from cycling indefinitely while optional background matching retries.',\n`,'v0.8.51 changelog insertion');

replaceOnce(app,
"let storageRestoring=false;\nlet startupRefreshActive=false;\nlet androidBootSequenceActive=false;",
"let storageRestoring=false;\nlet startupRefreshActive=false;\nlet androidBootSequenceActive=false;\nlet androidProfileEntryCommitted=false;",
'Android profile-entry latch');

replaceOnce(app,
"  if(NATIVE_ANDROID&&!starmeterBackgroundComplete)void prepareStarmeterBeforeLogin().catch(()=>false);\n  if(playerItem)await stopPlayback(true);",
"  if(NATIVE_ANDROID)androidProfileEntryCommitted=true;\n  if(playerItem)await stopPlayback(true);",
'profile selection foreground STARmeter call');

replaceOnce(app,
"  firstRunAvatarConfirmed=false;\n  profilePickerOpen=false;\n  profileEditId='';",
"  firstRunAvatarConfirmed=false;\n  profilePickerOpen=false;\n  if(NATIVE_ANDROID)androidProfileEntryCommitted=true;\n  profileEditId='';",
'first-run profile-entry latch');

replaceOnce(app,
"  setTimeout(()=>{refreshPerformancePackInfo().catch(()=>null);prepareStarmeterBeforeLogin().catch(()=>false)},0);",
"  setTimeout(()=>{refreshPerformancePackInfo().catch(()=>null)},0);",
'pre-login STARmeter launch');

replaceOnce(app,
"  stopAndroidBootFunTicker();androidBootSequenceActive=false;startupRefreshActive=false;profilePickerOpen=true;state.page='home';render();",
"  stopAndroidBootFunTicker();androidBootSequenceActive=false;startupRefreshActive=false;state.page='home';\n  if(androidProfileEntryCommitted){profilePickerOpen=false;render();requestAnimationFrame(()=>forceAndroidHomeEntry());setTimeout(()=>prepareStarmeterBeforeLogin().catch(()=>false),5000)}\n  else{profilePickerOpen=true;render()}",
'pre-login completion race');

replaceOnce(app,
"  await persist();render();if(NATIVE_ANDROID)forceAndroidHomeEntry();toast(changed?`Switched to ${target.name}`:`Welcome, ${target.name}`);if(NATIVE_ANDROID)setTimeout(maybeShowWhatsNewOnLogin,120);",
"  await persist();render();if(NATIVE_ANDROID){forceAndroidHomeEntry();setTimeout(()=>prepareStarmeterBeforeLogin().catch(()=>false),5000)}toast(changed?`Switched to ${target.name}`:`Welcome, ${target.name}`);if(NATIVE_ANDROID)setTimeout(maybeShowWhatsNewOnLogin,120);",
'post-login STARmeter scheduling');

let cssSource=read(css);
const cssRule='html.android-tv .profile-starmeter-prep{display:none!important}\n';
if(!cssSource.includes(cssRule)){cssSource+=`\n/* v0.8.51: profile choice is never blocked by optional STARmeter optimisation. */\n${cssRule}`;write(css,cssSource)}

replaceOnce(gradle,"versionCode 850\n        versionName '0.8.50'","versionCode 851\n        versionName '0.8.51'",'Gradle version');
replaceOnce(sw,'swoop-tv-v0850-shell','swoop-tv-v0851-shell','service worker cache version');

let testSource=read(tests);
testSource=testSource.replaceAll('0.8.50','0.8.51').replaceAll('v0850','v0851');
const testAnchor="if (!appSource.includes('function tvProfileAvatarChoices()') || !appSource.includes('tvProfileAvatarChoices().map')) throw new Error('Sharp TV avatar chooser filter missing');\n";
if(!testSource.includes(testAnchor))throw new Error('Unable to locate v0.8.50 test anchor');
const extraTests=`if (!appSource.includes('let androidProfileEntryCommitted=false;')) throw new Error('Android profile-entry commitment latch missing');\nif (!appSource.includes('if(NATIVE_ANDROID)androidProfileEntryCommitted=true;')) throw new Error('Profile selection does not commit Android Home entry');\nif (appSource.includes('refreshPerformancePackInfo().catch(()=>null);prepareStarmeterBeforeLogin().catch(()=>false)')) throw new Error('STARmeter still launches before profile selection');\nif (!appSource.includes('if(androidProfileEntryCommitted){profilePickerOpen=false;render();requestAnimationFrame(()=>forceAndroidHomeEntry())')) throw new Error('Android pre-login completion can still reopen Who’s Watching after Home entry');\nif (!cssSource.includes('html.android-tv .profile-starmeter-prep{display:none!important}')) throw new Error('Who’s Watching still exposes optional STARmeter progress as a loading gate');\n`;
testSource=testSource.replace(testAnchor,testAnchor+extraTests);
write(tests,testSource);

let release=read(notes);
if(!release.includes('## v0.8.51')){
  release=`## v0.8.51 — Profile Entry Race + Background Optimisation Hotfix\n\n- Fixes the Android/Google TV launch race that could successfully enter Home and then kick the viewer back to **Who’s watching?** when the original pre-login task completed.\n- Adds a launch-session profile-entry latch: once a profile or first-run account commits to Home, the boot sequence is no longer allowed to reopen the profile picker.\n- Removes STARmeter preparation from the pre-login critical path. It now starts several seconds after Home entry and remains optional/background work.\n- Hides the STARmeter optimisation percentage from **Who’s watching?**, so account selection is never presented as waiting on a 50–80% retry loop.\n- Retains v0.8.50 remote keyboard Enter/Done and sharp-avatar onboarding fixes.\n\n`+release;
  write(notes,release);
}

// Promotion must leave the source tree as the canonical v0.8.51 baseline and must not trigger a second build.
for(const p of ['.promotion/promote-pending.mjs','.promotion/build-request.txt']){try{fs.rmSync(p)}catch{}}
execFileSync('git',['config','user.name','Swoop TV Build'],{stdio:'inherit'});
execFileSync('git',['config','user.email','actions@users.noreply.github.com'],{stdio:'inherit'});
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Promote v0.8.51 profile-entry race hotfix [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.51 profile-entry race hotfix promoted.');
