import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v)};
function replaceOnce(text,from,to,label){
  if(!text.includes(from))throw new Error(`${label} anchor missing`);
  return text.replace(from,to);
}

const VERSION='0.8.42';
const VERSION_CODE=842;
const STABLE_APK='Swoop-TV-v0.8.1-Google-TV-Test.apk';
const RELEASE_TAG='google-tv-test-v0.8.1';
const REPO=process.env.GITHUB_REPOSITORY||'Swoop081/swoop-tv-android';

// Native updater classes are staged outside workflow paths so this promotion lands atomically.
let manager=read('staging/v0842/SwoopUpdateManager.java.txt');
manager=manager.replace('long total = connection.getContentLengthLong();','long total = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N ? connection.getContentLengthLong() : connection.getContentLength();');
write('app/src/main/java/tv/swoop/player/SwoopUpdateManager.java',manager);
write('app/src/main/java/tv/swoop/player/SwoopUpdateReceiver.java',read('staging/v0842/SwoopUpdateReceiver.java.txt'));

let gradle=read('app/build.gradle');
gradle=replaceOnce(gradle,'versionCode 841','versionCode 842','Gradle versionCode');
gradle=replaceOnce(gradle,"versionName '0.8.41'","versionName '0.8.42'",'Gradle versionName');
write('app/build.gradle',gradle);

let manifest=read('app/src/main/AndroidManifest.xml');
manifest=replaceOnce(manifest,'    <uses-permission android:name="android.permission.WAKE_LOCK" />\n','    <uses-permission android:name="android.permission.WAKE_LOCK" />\n    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <uses-permission android:name="android.permission.UPDATE_PACKAGES_WITHOUT_USER_ACTION" />\n','Updater permissions');
manifest=replaceOnce(manifest,'\n        <activity\n            android:name=".MainActivity"','\n        <receiver\n            android:name=".SwoopUpdateReceiver"\n            android:exported="false" />\n\n        <activity\n            android:name=".MainActivity"','Updater receiver');
write('app/src/main/AndroidManifest.xml',manifest);

let activity=read('app/src/main/java/tv/swoop/player/MainActivity.java');
activity=replaceOnce(activity,'    private final ExecutorService networkExecutor = Executors.newFixedThreadPool(2);\n','    private final ExecutorService networkExecutor = Executors.newFixedThreadPool(2);\n    private SwoopUpdateManager updateManager;\n','MainActivity updater field');
activity=replaceOnce(activity,'        configureWebView();\n        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");','        configureWebView();\n        updateManager = new SwoopUpdateManager(this, detail -> emitNativeEvent("swoop-update-status", detail));\n        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");\n        updateManager.scheduleLaunchCheck();','MainActivity updater startup');
activity=activity.replaceAll('SwoopTV/0.8.41 AndroidTV','SwoopTV/0.8.42 AndroidTV');
activity=activity.replaceAll('Swoop-TV-v0.8.41-Diagnostics-','Swoop-TV-v0.8.42-Diagnostics-');
activity=replaceOnce(activity,'        public String version() { return "0.8.41"; }','        public String version() { return "0.8.42"; }','Native bridge version');
activity=replaceOnce(activity,'        public String githubRepository() { return BuildConfig.GITHUB_REPOSITORY == null ? "" : BuildConfig.GITHUB_REPOSITORY; }\n\n        @JavascriptInterface\n        public String play(String payloadJson) {','        public String githubRepository() { return BuildConfig.GITHUB_REPOSITORY == null ? "" : BuildConfig.GITHUB_REPOSITORY; }\n\n        @JavascriptInterface\n        public String updateStatus() { return updateManager == null ? "{\\"phase\\":\\"unavailable\\"}" : updateManager.statusJson(); }\n\n        @JavascriptInterface\n        public String setAutomaticUpdates(boolean enabled) { return updateManager == null ? "{\\"phase\\":\\"unavailable\\"}" : updateManager.setAutomaticUpdates(enabled); }\n\n        @JavascriptInterface\n        public String checkForUpdate(boolean installIfAvailable) { return updateManager == null ? "{\\"phase\\":\\"unavailable\\"}" : updateManager.checkForUpdate(installIfAvailable, true); }\n\n        @JavascriptInterface\n        public String installAvailableUpdate() { return updateManager == null ? "{\\"phase\\":\\"unavailable\\"}" : updateManager.installAvailableUpdate(true); }\n\n        @JavascriptInterface\n        public String openUpdatePermissionSettings() { return updateManager == null ? "{\\"phase\\":\\"unavailable\\"}" : updateManager.openInstallPermissionSettings(); }\n\n        @JavascriptInterface\n        public String play(String payloadJson) {','Native updater bridge methods');
activity=replaceOnce(activity,'    @Override\n    protected void onPause() {','    @Override\n    protected void onResume() {\n        super.onResume();\n        if (updateManager != null) updateManager.onResume();\n    }\n\n    @Override\n    protected void onPause() {','Updater resume permission continuation');
activity=replaceOnce(activity,'        releasePlayerOnly();\n        try { networkExecutor.shutdownNow(); } catch (Exception ignored) {}','        releasePlayerOnly();\n        if (updateManager != null) updateManager.shutdown();\n        try { networkExecutor.shutdownNow(); } catch (Exception ignored) {}','Updater shutdown');
write('app/src/main/java/tv/swoop/player/MainActivity.java',activity);

let app=read('app/src/main/assets/app.js');
app=replaceOnce(app,"const ANDROID_CURRENT_VERSION='0.8.41';","const ANDROID_CURRENT_VERSION='0.8.42';",'Web UI Android version');
app=replaceOnce(app,'let tvLastFocusedElement=null,tvLastActivationAt=0,androidLaunchChecksScheduled=false,androidLaunchChecksRunning=false,androidProviderLaunchCheckRunning=false,androidAppUpdateAvailable=null,androidLatestManifest=null;','let tvLastFocusedElement=null,tvLastActivationAt=0,androidLaunchChecksScheduled=false,androidLaunchChecksRunning=false,androidProviderLaunchCheckRunning=false,androidAppUpdateAvailable=null,androidLatestManifest=null,androidUpdateRenderTimer=0;','Updater render throttle');
app=replaceOnce(app,'const ANDROID_CURRENT_CHANGELOG=[\n','const ANDROID_CURRENT_CHANGELOG=[\n  \'Adds native automatic GitHub updates on Google TV: Swoop TV checks the stable release at launch, downloads a newer APK and updates itself in place.\',\n  \'Verifies the published SHA-256 checksum plus application ID/version before installation, keeps Automatic Updates on by default, and falls back to Android approval when the TV requires it.\',\n  \'Adds Automatic Updates, Check for Update Now and one-time install-permission controls to Settings while keeping Downloader code 3682231 as the bootstrap/fallback installer.\',\n','Current changelog');

const updaterHelpers=`function androidUpdateBridgeCall(method,...args){\n  if(!NATIVE_ANDROID)return null;try{const fn=globalThis.SwoopAndroid?.[method];if(typeof fn!=='function')return null;const raw=fn(...args);return typeof raw==='string'?JSON.parse(raw||'{}'):raw}catch{return null}\n}\nfunction androidUpdateStatusSync(){return androidUpdateBridgeCall('updateStatus')||{currentVersion:ANDROID_CURRENT_VERSION,automaticUpdates:true,phase:'idle',progress:0,updateAvailable:Boolean(androidAppUpdateAvailable),latestVersion:androidAppUpdateAvailable?.version||''}}\nfunction androidUpdateStatusCopy(s={}){\n  const phase=String(s.phase||'idle'),latest=String(s.latestVersion||androidAppUpdateAvailable?.version||''),pct=Math.max(0,Math.min(100,Number(s.progress||0)));\n  if(phase==='checking')return 'Checking the stable GitHub release…';\n  if(phase==='downloading')return \\`Downloading and verifying the update… \\${pct}%\\`;\n  if(phase==='installing')return 'Update verified. Android is installing it now…';\n  if(phase==='approval_required')return 'Android needs one confirmation to finish this update.';\n  if(phase==='permission_required')return 'One-time setup required: allow Swoop TV to install its own updates.';\n  if(phase==='error')return String(s.error||'The last update attempt failed.');\n  if(s.updateAvailable||androidAppUpdateAvailable)return \\`Version \\${latest||androidAppUpdateAvailable?.version||''} is ready to install.\\`;\n  if(phase==='up_to_date')return 'Swoop TV is up to date.';\n  return s.automaticUpdates===false?'Automatic update checks are off.':'Swoop TV checks GitHub for updates when it launches.';\n}\nfunction androidUpdaterCardHtml(){\n  if(!NATIVE_ANDROID)return '';const s=androidUpdateStatusSync(),auto=s.automaticUpdates!==false,phase=String(s.phase||'idle'),busy=['checking','downloading','installing'].includes(phase),available=Boolean(s.updateAvailable||androidAppUpdateAvailable),permission=Boolean(s.canInstallPackages),current=String(s.currentVersion||ANDROID_CURRENT_VERSION),latest=String(s.latestVersion||androidAppUpdateAvailable?.version||current);\n  const permissionButton=!permission?'<button class="btn secondary" data-android-update-permission>Allow Update Installs</button>':'';\n  const installButton=available?'<button class="btn accent" data-android-update-install '+(busy?'disabled':'')+'>Install Update</button>':'';\n  return \\`<section class="setting-card app-update-card"><div class="setting-icon">↑</div><div class="setting-main"><h3>Automatic Updates</h3><p>\\${esc(androidUpdateStatusCopy(s))}</p><div class="setting-stats"><span><strong>v\\${esc(current)}</strong> Installed</span><span><strong>v\\${esc(latest)}</strong> Latest</span><span><strong>\\${auto?'ON':'OFF'}</strong> Auto update</span></div><div class="cta-row"><button class="btn \\${auto?'accent':'secondary'}" data-android-auto-update="\\${auto?'off':'on'}">Automatic Updates: \\${auto?'On':'Off'}</button><button class="btn secondary" data-android-update-check \\${busy?'disabled':''}>Check for Update Now</button>\\${installButton}\\${permissionButton}</div><small>Updates install over the existing Swoop TV app so providers, playlists, Favorites, Continue Watching and profile settings stay on this device. Downloader 3682231 remains the fallback installer.</small></div></section>\\`;\n}\nif(NATIVE_ANDROID)window.addEventListener('swoop-update-status',event=>{\n  const detail=event?.detail||{};if(detail.updateAvailable)androidAppUpdateAvailable={version:String(detail.latestVersion||''),versionCode:Number(detail.latestVersionCode||0)};else if(detail.phase==='up_to_date')androidAppUpdateAvailable=null;\n  if(detail.phase==='error'&&detail.error)toast(String(detail.error));\n  if(state?.page==='settings'&&!modal&&!profilePickerOpen&&!androidUpdateRenderTimer)androidUpdateRenderTimer=setTimeout(()=>{androidUpdateRenderTimer=0;if(state.page==='settings'&&!modal&&!profilePickerOpen)render()},650);\n});\n`;
app=replaceOnce(app,'function settingsPage(){',updaterHelpers+'\nfunction settingsPage(){','Updater settings helpers');
app=app.replace(/\n  \$\{NATIVE_ANDROID&&androidAppUpdateAvailable\?`<section class="setting-card app-update-card">.*?<\/section>`:''\}/,'');
app=replaceOnce(app,'\n  <section class="setting-card profile-setting-card">','\n  ${androidUpdaterCardHtml()}\n  <section class="setting-card profile-setting-card">','Updater settings card');
app=app.replace('toast(`Swoop TV v${latest} is available · Downloader 3682231`);if(state.page===\'settings\'&&!modal&&!profilePickerOpen)render();return androidAppUpdateAvailable;','if(state.page===\'settings\'&&!modal&&!profilePickerOpen)render();return androidAppUpdateAvailable;');
app=replaceOnce(app,"  document.querySelectorAll('[data-provider-refresh-all]').forEach(el=>el.onclick=()=>refreshAllProviders());","  document.querySelectorAll('[data-provider-refresh-all]').forEach(el=>el.onclick=()=>refreshAllProviders());\n  document.querySelectorAll('[data-android-auto-update]').forEach(el=>el.onclick=()=>{const enabled=el.dataset.androidAutoUpdate==='on';androidUpdateBridgeCall('setAutomaticUpdates',enabled);toast(enabled?'Automatic updates enabled':'Automatic updates disabled');render()});\n  document.querySelector('[data-android-update-check]')?.addEventListener('click',()=>{androidUpdateBridgeCall('checkForUpdate',false);toast('Checking GitHub for a Swoop TV update…');setTimeout(()=>{if(state.page==='settings')render()},800)});\n  document.querySelector('[data-android-update-install]')?.addEventListener('click',()=>{const result=androidUpdateBridgeCall('installAvailableUpdate');if(result?.phase==='permission_required')toast('Allow Swoop TV to install updates once, then the update will continue.');else toast('Preparing the Swoop TV update…');setTimeout(()=>{if(state.page==='settings')render()},500)});\n  document.querySelector('[data-android-update-permission]')?.addEventListener('click',()=>{androidUpdateBridgeCall('openUpdatePermissionSettings');toast('Enable “Allow from this source” for Swoop TV.')} );",'Updater settings actions');
write('app/src/main/assets/app.js',app);

let refresh=read('scripts/refresh-seed-cache.mjs');
refresh=refresh.replaceAll("'user-agent':'SwoopTV/0.8.41'","'user-agent':'SwoopTV/0.8.42'");
refresh=replaceOnce(refresh,"sourceVersion:'0.8.41'","sourceVersion:'0.8.42'",'Seed source version');
write('scripts/refresh-seed-cache.mjs',refresh);

// Keep the checked-in warm-start seed version-aligned even before CI refreshes its live contents.
for(const seedPath of ['app/src/main/assets/seed-cache.json','swoop-tv-seed-cache.json']){
  const seed=JSON.parse(read(seedPath));seed.sourceVersion=VERSION;write(seedPath,JSON.stringify(seed,null,2)+'\n');
}

let tests=read('tests/tv-ui-runtime-smoke.mjs');
tests=replaceOnce(tests,"const activitySource = fs.readFileSync(new URL('../app/src/main/java/tv/swoop/player/MainActivity.java', import.meta.url), 'utf8');","const activitySource = fs.readFileSync(new URL('../app/src/main/java/tv/swoop/player/MainActivity.java', import.meta.url), 'utf8');\nconst updaterSource = fs.readFileSync(new URL('../app/src/main/java/tv/swoop/player/SwoopUpdateManager.java', import.meta.url), 'utf8');\nconst updateReceiverSource = fs.readFileSync(new URL('../app/src/main/java/tv/swoop/player/SwoopUpdateReceiver.java', import.meta.url), 'utf8');\nconst manifestSource = fs.readFileSync(new URL('../app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');",'Updater test sources');
tests=tests.replace("const ANDROID_CURRENT_VERSION='0.8.41';","const ANDROID_CURRENT_VERSION='0.8.42';");
tests=tests.replace('Swoop-TV-v0.8.41-Diagnostics-','Swoop-TV-v0.8.42-Diagnostics-');
tests=tests.replace("String(installSeed.sourceVersion||'') !== '0.8.41'","String(installSeed.sourceVersion||'') !== '0.8.42'").replace('Install seed source version is not v0.8.41','Install seed source version is not v0.8.42');
tests=tests.replace("activitySource.includes('SwoopTV/0.8.41 AndroidTV') || !activitySource.includes('public String version() { return \"0.8.41\"; }')","activitySource.includes('SwoopTV/0.8.42 AndroidTV') || !activitySource.includes('public String version() { return \"0.8.42\"; }')");
tests=replaceOnce(tests,"if (!appSource.includes('swoop-tv-latest.json')) throw new Error('GitHub build manifest update check missing');","if (!appSource.includes('swoop-tv-latest.json')) throw new Error('GitHub build manifest update check missing');\nif (!manifestSource.includes('android.permission.REQUEST_INSTALL_PACKAGES') || !manifestSource.includes('android.permission.UPDATE_PACKAGES_WITHOUT_USER_ACTION')) throw new Error('Android updater permissions missing');\nif (!manifestSource.includes('.SwoopUpdateReceiver')) throw new Error('PackageInstaller status receiver missing');\nif (!updaterSource.includes('PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED') || !updaterSource.includes('downloadVerifiedApk') || !updaterSource.includes('SHA-256')) throw new Error('Native verified self-update pipeline missing');\nif (!updaterSource.includes('Swoop-TV-v0.8.1-Google-TV-Test.apk.sha256') && !updaterSource.includes('url + \".sha256\"')) throw new Error('Stable APK checksum verification missing');\nif (!updateReceiverSource.includes('STATUS_PENDING_USER_ACTION') || !updateReceiverSource.includes('STATUS_SUCCESS')) throw new Error('Android install approval/success fallback handling missing');\nif (!appSource.includes('data-android-update-check') || !appSource.includes('data-android-auto-update') || !appSource.includes('data-android-update-permission')) throw new Error('Settings automatic-update controls missing');",'Updater regression tests');
write('tests/tv-ui-runtime-smoke.mjs',tests);

let notes=read('RELEASE_NOTES.md');
const releaseSection=`## v0.8.42 — Automatic GitHub Updates\n\n- Adds a native Google TV self-update pipeline that checks the stable GitHub release shortly after Swoop TV launches.\n- **Automatic Updates** are enabled by default. When a newer stable version is available, Swoop TV downloads the existing stable APK URL and updates the installed app in place rather than uninstalling it.\n- Verifies the published **SHA-256 checksum**, Android application ID and newer versionCode before handing an APK to Android for installation. A mismatched or incomplete APK is rejected.\n- Uses Android PackageInstaller and requests a no-user-action self-update on Android 12+ where the TV permits it, while correctly handling Android’s confirmation fallback when user action is still required.\n- Adds one-time **Allow Update Installs** setup for TVs that require Swoop TV itself to be trusted as an install source. Once granted, later updates can continue automatically where Android permits.\n- Adds **Automatic Updates**, **Check for Update Now**, installed/latest version status, live download state and manual Install Update controls to Settings.\n- Keeps TV providers, Xtream/M3U details, playlists, Favorites, Continue Watching, watch history and profile settings intact because updates retain application ID \`tv.swoop.player\`, signing identity and app data.\n- Keeps permanent Downloader code **3682231** and the stable \`${STABLE_APK}\` URL as the bootstrap/fallback installation route.\n- Android versionName is **0.8.42** and versionCode is **842**.\n\n`;
if(!notes.startsWith('## v0.8.42'))notes=releaseSection+notes;
write('RELEASE_NOTES.md',notes);

const changes=releaseSection.split('\n').filter(line=>/^\s*-\s+/.test(line)).map(line=>line.replace(/^\s*-\s+/,'').replace(/\*\*/g,'').replace(/`/g,'')).slice(0,8);
const updateUrl=`https://github.com/${REPO}/releases/download/${RELEASE_TAG}/${STABLE_APK}`;
write('swoop-tv-latest.json',JSON.stringify({version:VERSION,versionCode:VERSION_CODE,updateUrl,changes},null,2)+'\n');
write('build-metadata.json',JSON.stringify({version:VERSION,versionCode:VERSION_CODE,versionedApk:`Swoop-TV-v${VERSION}-Google-TV-Test.apk`,stableApk:STABLE_APK,changes},null,2)+'\n');
write('release-summary.md',`Swoop TV Google TV hardware-test channel — current v${VERSION}.\n\n${changes.map(x=>`- ${x}`).join('\n')}\n\nTest-only signing identity; not a production release.\n`);

// Remove temporary staging/promotion files before promoting the canonical source commit.
fs.rmSync(path.join(root,'staging/v0842'),{recursive:true,force:true});
try{fs.rmdirSync(path.join(root,'staging'))}catch{}
fs.rmSync(path.join(root,'.promotion/promote-pending.mjs'),{force:true});
try{fs.rmdirSync(path.join(root,'.promotion'))}catch{}

execFileSync('git',['config','user.name','github-actions[bot]'],{stdio:'inherit'});
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],{stdio:'inherit'});
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Promote v0.8.42 automatic GitHub updates [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Promoted v0.8.42 automatic GitHub update source.');
