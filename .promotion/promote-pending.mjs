import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function replaceOnce(text,from,to,label){
  if(!text.includes(from))throw new Error(`Missing v0.8.50 promotion anchor: ${label}`);
  return text.replace(from,to);
}

// Version alignment.
{
  const path='app/build.gradle';
  let s=read(path);
  s=replaceOnce(s,'versionCode 849','versionCode 850','Gradle versionCode');
  s=replaceOnce(s,"versionName '0.8.49'","versionName '0.8.50'",'Gradle versionName');
  write(path,s);
}

// First-run TV input, avatar selection and sharp-avatar chooser.
{
  const path='app/src/main/assets/app.js';
  let s=read(path);
  const versionAnchor="const ANDROID_CURRENT_VERSION='0.8.49';";
  const sharp=`const ANDROID_CURRENT_VERSION='0.8.50';\nconst TV_SHARP_PROFILE_AVATAR_IDS=new Set(['lion','elephant','giraffe','zebra','rhino','turtle','monkey','meerkat','parrot','tiger']);\nfunction tvProfileAvatarChoices(){return PROFILE_AVATARS.filter(av=>TV_SHARP_PROFILE_AVATAR_IDS.has(av.id))}`;
  s=replaceOnce(s,versionAnchor,sharp,'Android UI version + sharp avatar set');
  s=replaceOnce(s,"const ANDROID_CURRENT_CHANGELOG=[",`const ANDROID_CURRENT_CHANGELOG=[\n  'Fixes first-run Google TV keyboard Enter/Done so each provider field advances without pressing Back to dismiss the keyboard.',\n  'Fixes avatar selection so Use this avatar / Continue becomes enabled immediately after a choice.',\n  'Keeps only production-resolution avatar artwork selectable on TV until the low-resolution secondary batch is replaced.',`,'v0.8.50 changelog');

  const avatarMapCount=(s.match(/PROFILE_AVATARS\.map\(av=>/g)||[]).length;
  if(avatarMapCount<2)throw new Error(`Expected at least two PROFILE_AVATARS.map pickers, found ${avatarMapCount}`);
  s=s.replaceAll('PROFILE_AVATARS.map(av=>','tvProfileAvatarChoices().map(av=>');

  s=s.replaceAll('data-first-provider-input type="url"','data-first-provider-input type="url" enterkeyhint="next"');
  s=s.replaceAll('data-first-provider-input value="${esc(firstRunProviderDraft.name||\'\')}" placeholder="Main TV" autofocus','data-first-provider-input value="${esc(firstRunProviderDraft.name||\'\')}" placeholder="Main TV" enterkeyhint="next" autofocus');
  s=s.replaceAll('data-first-provider-input value="${esc(firstRunProviderDraft.username||\'\')}" autocomplete="username" autofocus','data-first-provider-input value="${esc(firstRunProviderDraft.username||\'\')}" autocomplete="username" enterkeyhint="next" autofocus');
  s=s.replaceAll('data-first-provider-input name="password" type="password" autocomplete="current-password" required autofocus','data-first-provider-input name="password" type="password" autocomplete="current-password" enterkeyhint="done" required autofocus');
  s=s.replaceAll('data-first-provider-input name="name" value="${esc(firstRunProviderDraft.name||\'\')}" placeholder="Main TV" required autofocus','data-first-provider-input name="name" value="${esc(firstRunProviderDraft.name||\'\')}" placeholder="Main TV" enterkeyhint="done" required autofocus');

  const nextPrefix="  document.querySelector('[data-first-provider-next]')?.addEventListener('click',()=>{";
  const nextAt=s.indexOf(nextPrefix);
  if(nextAt<0)throw new Error('First-run provider Next binding not found');
  const nextLineEnd=s.indexOf('\n',nextAt);
  if(nextLineEnd<0)throw new Error('First-run provider Next binding line end not found');
  const keyboardHandler=`\n  document.querySelectorAll('[data-first-provider-input]').forEach(input=>input.addEventListener('keydown',event=>{\n    const enter=event.key==='Enter'||event.keyCode===13||event.which===13;\n    if(!enter)return;\n    event.preventDefault();event.stopPropagation();\n    const next=document.querySelector('[data-first-provider-next]');\n    if(next){input.blur();next.click();return}\n    const form=input.closest('form');\n    if(form){input.blur();if(typeof form.requestSubmit==='function')form.requestSubmit();else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}\n  }));`;
  s=s.slice(0,nextLineEnd)+keyboardHandler+s.slice(nextLineEnd);

  const avatarClose="    });\n  });\n  document.querySelector('[data-first-provider-open]')";
  const avatarFixed="    });\n    const submit=document.querySelector('[data-first-account-submit]');\n    if(submit){submit.disabled=false;submit.removeAttribute('disabled');submit.textContent=firstRunProviderReady?'Continue':'Use this avatar'}\n  });\n  document.querySelector('[data-first-provider-open]')";
  s=replaceOnce(s,avatarClose,avatarFixed,'avatar submit enable');
  write(path,s);
}

// Let the WebView/IME receive Select/Enter while a DOM text editor owns the keyboard.
{
  const path='app/src/main/java/tv/swoop/player/MainActivity.java';
  let s=read(path);
  s=replaceOnce(s,'import android.view.WindowManager;','import android.view.WindowManager;\nimport android.view.inputmethod.InputMethodManager;','InputMethodManager import');
  s=replaceOnce(s,'SwoopTV/0.8.47 AndroidTV','SwoopTV/0.8.50 AndroidTV','native user agent version');
  const method=`    private boolean isTvSelectKey(int keyCode) {\n        return keyCode == KeyEvent.KEYCODE_DPAD_CENTER\n                || keyCode == KeyEvent.KEYCODE_ENTER\n                || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER\n                || keyCode == KeyEvent.KEYCODE_BUTTON_A;\n    }\n`;
  const helper=`${method}\n    private boolean isWebTextInputActive() {\n        try {\n            if (webView == null || !webView.hasFocus()) return false;\n            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);\n            return imm != null && imm.isActive(webView);\n        } catch (Exception ignored) {\n            return false;\n        }\n    }\n`;
  s=replaceOnce(s,method,helper,'native editable-input detector');
  s=replaceOnce(s,'if (!nativePlayerVisible && isTvSelectKey(event.getKeyCode())) {','if (!nativePlayerVisible && isTvSelectKey(event.getKeyCode()) && !isWebTextInputActive()) {','native Select pass-through while typing');
  write(path,s);
}

// Force a fresh app shell after the APK update.
{
  const path='app/src/main/assets/sw.js';
  let s=read(path);
  s=replaceOnce(s,"const CACHE='swoop-tv-v0847-shell';","const CACHE='swoop-tv-v0850-shell';",'service worker shell cache');
  write(path,s);
}

// Regression guards.
{
  const path='tests/tv-ui-runtime-smoke.mjs';
  let s=read(path);
  const guard=`if (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.49';")) throw new Error('Current Android UI version marker missing');`;
  const replacement=`if (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.50';")) throw new Error('Current Android UI version marker missing');\nif (!activitySource.includes('InputMethodManager') || !activitySource.includes('isWebTextInputActive()') || !activitySource.includes('&& !isWebTextInputActive())')) throw new Error('First-run TV keyboard Select/Enter pass-through missing');\nif (!appSource.includes("event.key==='Enter'") || !appSource.includes('form.requestSubmit')) throw new Error('First-run keyboard Enter/Done advance handling missing');\nif (!appSource.includes('submit.disabled=false') || !appSource.includes('submit.removeAttribute(\'disabled\')')) throw new Error('First-run avatar Continue enable hotfix missing');\nif (!appSource.includes('function tvProfileAvatarChoices()') || !appSource.includes('tvProfileAvatarChoices().map')) throw new Error('Sharp TV avatar chooser filter missing');\nif (!swSource.includes("swoop-tv-v0850-shell")) throw new Error('v0.8.50 service-worker cache marker missing');`;
  s=replaceOnce(s,guard,replacement,'v0.8.50 test guards');
  write(path,s);
}

// Canonical release notes.
{
  const path='RELEASE_NOTES.md';
  let s=read(path);
  if(!s.startsWith('## v0.8.50')){
    s=`## v0.8.50 — First-Run Remote Input + Avatar Hotfix\n\n- Fixes Google TV first-run text entry so the on-screen keyboard **Enter / Done** action reaches the WebView instead of being swallowed by the native TV Select-key handler.\n- Pressing Enter on **server URL, playlist URL, playlist name and username** now advances directly to the next setup screen; final M3U name/password fields submit their Connect form directly.\n- Adds TV keyboard `enterkeyhint` guidance so intermediate fields present **Next** semantics and final fields present **Done** semantics where the keyboard supports it.\n- Fixes **Choose your avatar** so selecting an avatar immediately enables **Use this avatar / Continue**; the button no longer remains disabled after the visible avatar selection changes.\n- Removes the low-resolution secondary avatar batch from new selectable TV avatar choices for now, retaining the original production-resolution animal set instead of enlarging visibly soft source artwork. Existing profile data remains compatible.\n- Keeps the v0.8.49 approximately 80%-viewport responsive onboarding geometry unchanged.\n- Bumps the packaged shell cache and native Swoop TV Android user-agent marker so the corrected onboarding code is not shadowed by an older cached shell.\n- Android versionName/versionCode: **0.8.50 / 850**.\n\n${s}`;
  }
  write(path,s);
}

// Add a focused physical-TV verification section.
{
  const path='TV_HARDWARE_TEST_CHECKLIST.md';
  let s=read(path);
  const section=`## v0.8.50 first-run onboarding checks\n\n- **ONBOARD-ENTER-001:** On a clean provider-first setup, type the server/playlist URL and press the on-screen keyboard Enter key with the remote. The keyboard action must advance directly without requiring Android Back first. Repeat for playlist name and username; final password/M3U name Enter must submit Connect.\n- **ONBOARD-AVATAR-001:** On Choose your avatar, press OK on any avatar. **Use this avatar / Continue** must immediately become enabled and be reachable with Down/OK.\n- **ONBOARD-ART-001:** The selectable first-run/profile-editor avatar set must use the sharp original production-resolution animal artwork; visibly soft low-resolution secondary portraits must not be offered as new choices.\n- **ONBOARD-STATE-001:** Installing v0.8.50 over a device that already connected its provider but has not completed first-run must resume at avatar selection without deleting the saved provider.\n\n`;
  if(!s.startsWith('## v0.8.50 first-run onboarding checks'))s=section+s;
  write(path,s);
}

// Remove the one-shot promotion file and commit the exact promoted source without starting a second build.
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Promote v0.8.50 onboarding remote and avatar hotfix [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.50 onboarding remote input and avatar hotfix promoted.');
