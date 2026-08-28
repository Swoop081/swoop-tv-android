import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v)};
function replaceOnce(text,from,to,label){if(!text.includes(from))throw new Error(`${label} anchor missing`);return text.replace(from,to)}

const VERSION='0.8.43';
const VERSION_CODE=843;
const STABLE_APK='Swoop-TV-v0.8.1-Google-TV-Test.apk';
const RELEASE_TAG='google-tv-test-v0.8.1';
const REPO=process.env.GITHUB_REPOSITORY||'Swoop081/swoop-tv-android';

let gradle=read('app/build.gradle');
gradle=replaceOnce(gradle,'versionCode 842','versionCode 843','Gradle versionCode');
gradle=replaceOnce(gradle,"versionName '0.8.42'","versionName '0.8.43'",'Gradle versionName');
write('app/build.gradle',gradle);

let manager=read('app/src/main/java/tv/swoop/player/SwoopUpdateManager.java');
manager=replaceOnce(manager,`    void onResume() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && "permission_required".equals(phase)
                && canRequestPackageInstalls()
                && automaticUpdates()
                && latestVersionCode > BuildConfig.VERSION_CODE
                && !busy) {
            installAvailableUpdate(false);
        }
    }
`,`    void onResume() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            notifyStatus();
            return;
        }
        boolean canInstall = canRequestPackageInstalls();
        boolean pendingManual = prefs.getBoolean("installAfterPermission", false);
        if (canInstall && "permission_required".equals(phase)) {
            if (latestVersionCode > BuildConfig.VERSION_CODE && !busy && (pendingManual || automaticUpdates())) {
                prefs.edit().putBoolean("installAfterPermission", false).apply();
                installAvailableUpdate(false);
                return;
            }
            prefs.edit().putBoolean("installAfterPermission", false).apply();
            setState(latestVersionCode > BuildConfig.VERSION_CODE ? "available" : "up_to_date", "", latestVersionCode > BuildConfig.VERSION_CODE ? 0 : 100);
            return;
        }
        notifyStatus();
    }
`,'Updater resume permission flow');
manager=replaceOnce(manager,`            if (!canRequestPackageInstalls()) {
                setState("permission_required", "", 0);
                if (openPermissionWhenNeeded) openInstallPermissionSettings();
                return statusJson();
            }
`,`            if (!canRequestPackageInstalls()) {
                prefs.edit().putBoolean("installAfterPermission", true).apply();
                setState("permission_required", "", 0);
                if (openPermissionWhenNeeded) openInstallPermissionSettings();
                return statusJson();
            }
`,'Manual update permission continuation');
manager=replaceOnce(manager,`    String openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return statusJson();
        main.post(() -> {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                activity.startActivity(intent);
            } catch (Exception e) {
                Log.w(TAG, "Could not open unknown-app-source settings", e);
            }
        });
        return statusJson();
    }
`,`    String openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return statusJson();
        main.post(() -> {
            Uri packageUri = Uri.parse("package:" + activity.getPackageName());
            Intent[] candidates = new Intent[] {
                    new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, packageUri),
                    new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES),
                    new Intent(Settings.ACTION_SECURITY_SETTINGS),
                    new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
            };
            Exception lastError = null;
            for (Intent intent : candidates) {
                try {
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    activity.startActivity(intent);
                    Log.i(TAG, "Opened update install settings with " + intent.getAction());
                    return;
                } catch (Exception e) {
                    lastError = e;
                    Log.w(TAG, "Update settings intent unavailable: " + intent.getAction(), e);
                }
            }
            String message = "Could not open Android update-install settings. Open Settings > Apps > Special app access > Install unknown apps and allow Swoop TV.";
            if (lastError != null) Log.e(TAG, message, lastError);
            setState("permission_required", message, 0);
        });
        return statusJson();
    }
`,'Google TV unknown-source settings fallback');
write('app/src/main/java/tv/swoop/player/SwoopUpdateManager.java',manager);

let activity=read('app/src/main/java/tv/swoop/player/MainActivity.java').replaceAll('0.8.42','0.8.43');
write('app/src/main/java/tv/swoop/player/MainActivity.java',activity);

let app=read('app/src/main/assets/app.js');
app=replaceOnce(app,"const ANDROID_CURRENT_VERSION='0.8.42';","const ANDROID_CURRENT_VERSION='0.8.43';",'Web UI Android version');
app=replaceOnce(app,"const ANDROID_CURRENT_CHANGELOG=[\n","const ANDROID_CURRENT_CHANGELOG=[\n  'Fixes the Google TV Allow Update Installs button so it actually opens Android settings, with multiple TV-firmware fallbacks when the package-specific settings page is unavailable.',\n  'Resumes a pending manual or automatic Swoop TV update after the one-time install-source permission is granted and the user returns to the app.',\n",'v0.8.43 changelog');
app=app.replace("toast('Enable “Allow from this source” for Swoop TV.')","toast('Opening Android update-install settings…')");
write('app/src/main/assets/app.js',app);

let refresh=read('scripts/refresh-seed-cache.mjs').replaceAll('0.8.42','0.8.43');
write('scripts/refresh-seed-cache.mjs',refresh);
for(const seedPath of ['app/src/main/assets/seed-cache.json','swoop-tv-seed-cache.json']){
  const seed=JSON.parse(read(seedPath));seed.sourceVersion=VERSION;write(seedPath,JSON.stringify(seed,null,2)+'\n');
}

let tests=read('tests/tv-ui-runtime-smoke.mjs').replaceAll('0.8.42','0.8.43');
const updaterTestAnchor="if (!updaterSource.includes('PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED') || !updaterSource.includes('downloadVerifiedApk') || !updaterSource.includes('SHA-256')) throw new Error('Native verified self-update pipeline missing');";
tests=replaceOnce(tests,updaterTestAnchor,updaterTestAnchor+"\nif (!updaterSource.includes('Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES') || !updaterSource.includes('Settings.ACTION_SECURITY_SETTINGS') || !updaterSource.includes('Settings.ACTION_APPLICATION_DETAILS_SETTINGS')) throw new Error('Google TV update-permission settings fallbacks missing');\nif (!updaterSource.includes('installAfterPermission') || !updaterSource.includes('pendingManual || automaticUpdates()')) throw new Error('Updater permission-return continuation missing');",'v0.8.43 updater regression tests');
write('tests/tv-ui-runtime-smoke.mjs',tests);

let notes=read('RELEASE_NOTES.md');
const releaseLines=[
  '## v0.8.43 — Google TV Updater Permission Hotfix',
  '',
  '- Fixes the physical Google TV failure shown in `IMG_1155.mp4` where **Allow Update Installs** displayed a toast but did not open Android settings.',
  '- The updater now tries the package-specific **Install unknown apps** screen first, then the generic unknown-source screen, Android Security settings and finally Swoop TV app-details settings so vendor-specific Google TV firmware has a usable path.',
  '- A manual update waiting for install-source permission is now remembered. After permission is granted and Swoop TV resumes, the pending update continues automatically.',
  '- Automatic-update permission return is also repaired; the updater no longer remains stuck in `permission_required` after access has been granted.',
  '- Keeps the verified SHA-256/application-ID/version checks and in-place `tv.swoop.player` update model from v0.8.42.',
  '- Keeps Downloader code **3682231** as the stable bootstrap/fallback installer.',
  '- Android versionName is **0.8.43** and versionCode is **843**.',
  '',
  ''
];
const releaseSection=releaseLines.join('\n');
if(!notes.startsWith('## v0.8.43'))notes=releaseSection+notes;
write('RELEASE_NOTES.md',notes);
const changes=releaseLines.filter(line=>line.startsWith('- ')).map(line=>line.slice(2).replace(/\*\*/g,'').replace(/`/g,'')).slice(0,8);
const updateUrl='https://github.com/'+REPO+'/releases/download/'+RELEASE_TAG+'/'+STABLE_APK;
write('swoop-tv-latest.json',JSON.stringify({version:VERSION,versionCode:VERSION_CODE,updateUrl,changes},null,2)+'\n');
write('build-metadata.json',JSON.stringify({version:VERSION,versionCode:VERSION_CODE,versionedApk:'Swoop-TV-v'+VERSION+'-Google-TV-Test.apk',stableApk:STABLE_APK,changes},null,2)+'\n');
write('release-summary.md','Swoop TV Google TV hardware-test channel — current v'+VERSION+'.\n\n'+changes.map(x=>'- '+x).join('\n')+'\n\nTest-only signing identity; not a production release.\n');

fs.rmSync(path.join(root,'.promotion/promote-pending.mjs'),{force:true});
try{fs.rmdirSync(path.join(root,'.promotion'))}catch{}
execFileSync('git',['config','user.name','github-actions[bot]'],{stdio:'inherit'});
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],{stdio:'inherit'});
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Promote v0.8.43 Google TV updater permission hotfix [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Promoted v0.8.43 Google TV updater permission hotfix.');
