import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function replaceOnce(text,from,to,label){
  if(!text.includes(from)) throw new Error(`Missing v0.8.50 promotion anchor: ${label}`);
  return text.replace(from,to);
}

{
  const path='app/build.gradle';
  let s=read(path);
  s=replaceOnce(s,'versionCode 849','versionCode 850','Gradle versionCode');
  s=replaceOnce(s,"versionName '0.8.49'","versionName '0.8.50'",'Gradle versionName');
  write(path,s);
}

{
  const path='app/src/main/assets/app.js';
  let s=read(path);
  const marker="const ANDROID_CURRENT_VERSION='0.8.49';";
  const markerNew="const ANDROID_CURRENT_VERSION='0.8.50';\nconst TV_SHARP_PROFILE_AVATAR_IDS=new Set(['lion','elephant','giraffe','zebra','rhino','turtle','monkey','meerkat','parrot','tiger']);\nfunction tvProfileAvatarChoices(){return PROFILE_AVATARS.filter(av=>TV_SHARP_PROFILE_AVATAR_IDS.has(av.id))}";
  s=replaceOnce(s,marker,markerNew,'Android version and sharp avatar set');
  s=replaceOnce(s,'const ANDROID_CURRENT_CHANGELOG=[',"const ANDROID_CURRENT_CHANGELOG=[\n  'Fixes first-run Google TV keyboard Enter/Done so each provider field advances without pressing Back.',\n  'Fixes avatar selection so Use this avatar / Continue becomes enabled immediately after a choice.',\n  'Keeps only production-resolution avatar artwork selectable on TV until the low-resolution secondary batch is replaced.',",'v0.8.50 changelog');

  const avatarMapCount=(s.match(/PROFILE_AVATARS\.map\(av=>/g)||[]).length;
  if(avatarMapCount<2) throw new Error(`Expected at least two profile avatar pickers, found ${avatarMapCount}`);
  s=s.replaceAll('PROFILE_AVATARS.map(av=>','tvProfileAvatarChoices().map(av=>');

  s=s.replace(/<input data-first-provider-input(?![^>]*enterkeyhint)/g,'<input data-first-provider-input enterkeyhint="go"');

  const nextPrefix="  document.querySelector('[data-first-provider-next]')?.addEventListener('click',()=>{";
  const nextAt=s.indexOf(nextPrefix);
  if(nextAt<0) throw new Error('First-run provider Next binding not found');
  const nextLineEnd=s.indexOf('\n',nextAt);
  if(nextLineEnd<0) throw new Error('First-run provider Next line end not found');
  const keyboardHandler="\n  document.querySelectorAll('[data-first-provider-input]').forEach(input=>input.addEventListener('keydown',event=>{\n    const enter=event.key==='Enter'||event.keyCode===13||event.which===13;\n    if(!enter)return;\n    event.preventDefault();event.stopPropagation();\n    const next=document.querySelector('[data-first-provider-next]');\n    if(next){input.blur();next.click();return}\n    const form=input.closest('form');\n    if(form){input.blur();if(typeof form.requestSubmit==='function')form.requestSubmit();else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}\n  }));";
  s=s.slice(0,nextLineEnd)+keyboardHandler+s.slice(nextLineEnd);

  const avatarStart=s.indexOf("  document.querySelectorAll('[data-first-account-avatar]').forEach(el=>el.onclick=()=>{");
  if(avatarStart<0) throw new Error('First-run avatar selection binding not found');
  const avatarNext=s.indexOf("  document.querySelector('[data-first-provider-open]')",avatarStart);
  if(avatarNext<0) throw new Error('First-run avatar selection end marker not found');
  let avatarBlock=s.slice(avatarStart,avatarNext);
  const outerClose=avatarBlock.lastIndexOf('\n  });');
  if(outerClose<0) throw new Error('First-run avatar outer close not found');
  const enable="\n    const submit=document.querySelector('[data-first-account-submit]');\n    if(submit){submit.disabled=false;submit.removeAttribute('disabled');submit.textContent=firstRunProviderReady?'Continue':'Use this avatar'}";
  avatarBlock=avatarBlock.slice(0,outerClose)+enable+avatarBlock.slice(outerClose);
  s=s.slice(0,avatarStart)+avatarBlock+s.slice(avatarNext);
  write(path,s);
}

{
  const path='app/src/main/java/tv/swoop/player/MainActivity.java';
  let s=read(path);
  s=replaceOnce(s,'import android.view.WindowManager;','import android.view.WindowManager;\nimport android.view.inputmethod.InputMethodManager;','InputMethodManager import');
  s=s.replace('SwoopTV/0.8.47 AndroidTV','SwoopTV/0.8.50 AndroidTV');
  const method="    private boolean isTvSelectKey(int keyCode) {\n        return keyCode == KeyEvent.KEYCODE_DPAD_CENTER\n                || keyCode == KeyEvent.KEYCODE_ENTER\n                || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER\n                || keyCode == KeyEvent.KEYCODE_BUTTON_A;\n    }\n";
  const helper=method+"\n    private boolean isWebTextInputActive() {\n        try {\n            if (webView == null || !webView.hasFocus()) return false;\n            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);\n            return imm != null && imm.isActive(webView) && imm.isAcceptingText();\n        } catch (Exception ignored) {\n            return false;\n        }\n    }\n";
  s=replaceOnce(s,method,helper,'native editable-input detector');
  s=replaceOnce(s,'if (!nativePlayerVisible && isTvSelectKey(event.getKeyCode())) {','if (!nativePlayerVisible && isTvSelectKey(event.getKeyCode()) && !isWebTextInputActive()) {','native Select pass-through while typing');
  write(path,s);
}

{
  const path='app/src/main/assets/sw.js';
  let s=read(path);
  s=replaceOnce(s,"const CACHE='swoop-tv-v0847-shell';","const CACHE='swoop-tv-v0850-shell';",'service worker cache');
  write(path,s);
}

{
  const path='tests/tv-ui-runtime-smoke.mjs';
  let s=read(path);
  const guard="if (!appSource.includes(\"const ANDROID_CURRENT_VERSION='0.8.49';\")) throw new Error('Current Android UI version marker missing');";
  const replacement=guard.replace('0.8.49','0.8.50')+"\nif (!activitySource.includes('InputMethodManager') || !activitySource.includes('isWebTextInputActive()') || !activitySource.includes('imm.isAcceptingText()') || !activitySource.includes('&& !isWebTextInputActive())') ) throw new Error('First-run TV keyboard Select/Enter pass-through missing');\nif (!appSource.includes(\"event.key==='Enter'\") || !appSource.includes('form.requestSubmit')) throw new Error('First-run keyboard Enter/Done handling missing');\nif (!appSource.includes('submit.disabled=false') || !appSource.includes(\"submit.removeAttribute('disabled')\")) throw new Error('First-run avatar Continue enable hotfix missing');\nif (!appSource.includes('function tvProfileAvatarChoices()') || !appSource.includes('tvProfileAvatarChoices().map')) throw new Error('Sharp TV avatar chooser filter missing');\nif (!swSource.includes('swoop-tv-v0850-shell')) throw new Error('v0.8.50 service-worker cache marker missing');";
  s=replaceOnce(s,guard,replacement,'v0.8.50 runtime guards');
  write(path,s);
}

{
  const path='RELEASE_NOTES.md';
  let s=read(path);
  if(!s.startsWith('## v0.8.50')){
    const notes=[
      '## v0.8.50 — First-Run Remote Input + Avatar Hotfix',
      '',
      '- Fixes Google TV first-run text entry so the on-screen keyboard Enter / Done action reaches the WebView instead of being swallowed by the native TV Select-key handler.',
      '- Pressing Enter on server URL, playlist URL, playlist name and username now advances directly; final password/name fields submit Connect.',
      '- Fixes Choose your avatar so selecting an avatar immediately enables Use this avatar / Continue.',
      '- Removes the low-resolution 128×128 secondary avatar batch from new selectable TV choices for now, retaining the original production-resolution animal set. Existing profile IDs remain compatible.',
      '- Keeps the v0.8.49 approximately 80%-viewport responsive onboarding geometry unchanged.',
      '- Bumps the packaged shell cache and native Android marker so corrected onboarding code is not shadowed by an old cached shell.',
      '- Android versionName/versionCode: 0.8.50 / 850.',
      '',
      ''
    ].join('\n');
    s=notes+s;
  }
  write(path,s);
}

{
  const path='TV_HARDWARE_TEST_CHECKLIST.md';
  let s=read(path);
  if(!s.startsWith('## v0.8.50 first-run onboarding checks')){
    const section=[
      '## v0.8.50 first-run onboarding checks',
      '',
      '- ONBOARD-ENTER-001: Type each provider field and press keyboard Enter with the remote. Intermediate fields must advance without Back; final fields must submit Connect.',
      '- ONBOARD-AVATAR-001: Press OK on an avatar. Use this avatar / Continue must enable immediately and be reachable with Down/OK.',
      '- ONBOARD-ART-001: New selectable avatars use the sharp original production-resolution set; low-resolution secondary portraits are not offered.',
      '- ONBOARD-STATE-001: Updating over a connected provider with no completed profile resumes avatar selection without deleting the provider.',
      '',
      ''
    ].join('\n');
    s=section+s;
  }
  write(path,s);
}

try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
try{fs.rmSync('.promotion/build-request.txt')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Promote v0.8.50 onboarding remote and avatar hotfix [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.50 onboarding hotfix promoted.');