import {readFileSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const run=(cmd,args=[],options={})=>execFileSync(cmd,args,{stdio:'inherit',...options});
const appPath='app/src/main/assets/app.js';
const cssPath='app/src/main/assets/styles.css';
const nativePath='app/src/main/assets/src/native.js';
const gradlePath='app/build.gradle';
const activityPath='app/src/main/java/tv/swoop/player/MainActivity.java';
const testPath='tests/tv-ui-runtime-smoke.mjs';
const seedScriptPath='scripts/refresh-seed-cache.mjs';
const notesPath='RELEASE_NOTES.md';
const fixesPath='TV_HARDWARE_RUNNING_FIXES.md';
const selfPath='.promotion/promote-pending.mjs';

function replaceRequired(source,search,replacement,label){
  const next=source.replace(search,replacement);
  if(next===source)throw new Error(`v0.8.39 promotion could not patch ${label}`);
  return next;
}

let app=readFileSync(appPath,'utf8');
app=replaceRequired(app,"const ANDROID_CURRENT_VERSION='0.8.38';","const ANDROID_CURRENT_VERSION='0.8.39';",'Android current version');
app=replaceRequired(
  app,
  "  'Stops STARmeter blank/repaint stalls during held-D-pad traversal by batching deferred row patches, unloading distant artwork and serving TV-sized STARmeter images.',",
  "  'Adds a visible pre-login preparation progress bar, cleans profile focus styling, restores true bottom breathing room on Home, and upgrades the native Google TV player controls.',",
  'v0.8.39 changelog lead item'
);
const oldPrep=`\${NATIVE_ANDROID?\`<div class="profile-starmeter-prep \${starmeterBackgroundReady?'ready':''}" data-profile-starmeter-prep><span>\${starmeterBackgroundReady?'✓':\`\${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%\`}</span><strong>\${esc(starmeterBackgroundReady?'STARmeter Top 100 ready':starmeterBackgroundStatus)}</strong></div>\`:''}`;
const newPrep=`\${NATIVE_ANDROID?\`<div class="profile-starmeter-prep \${starmeterBackgroundComplete?'ready':''}" data-profile-starmeter-prep><div class="profile-starmeter-prep-line"><strong data-profile-starmeter-copy>\${starmeterBackgroundComplete?'Ready':'Please wait…'}</strong><span data-profile-starmeter-percent>\${starmeterBackgroundComplete?'✓':\`\${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%\`}</span></div><div class="profile-starmeter-progress"><i data-profile-starmeter-bar style="width:\${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%"></i></div></div>\`:''}`;
app=replaceRequired(app,oldPrep,newPrep,'Who’s Watching preparation progress markup');
app=replaceRequired(
  app,
  /function patchProfileStarmeterPrep\(\)\{[\s\S]*?\}\nfunction setStarmeterBackgroundProgress/,
`function patchProfileStarmeterPrep(){
  if(!NATIVE_ANDROID||!profilePickerOpen)return;const el=document.querySelector('[data-profile-starmeter-prep]');if(!el)return;
  const progress=Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)));
  el.classList.toggle('ready',starmeterBackgroundComplete);
  const value=el.querySelector('[data-profile-starmeter-percent]'),copy=el.querySelector('[data-profile-starmeter-copy]'),bar=el.querySelector('[data-profile-starmeter-bar]');
  if(value)value.textContent=starmeterBackgroundComplete?'✓':\`${progress}%\`;
  if(copy)copy.textContent=starmeterBackgroundComplete?'Ready':'Please wait…';
  if(bar)bar.style.width=\`${progress}%\`;
}
function setStarmeterBackgroundProgress`,
  'profile preparation progress patcher'
);
writeFileSync(appPath,app);

let native=readFileSync(nativePath,'utf8');
native=replaceRequired(
  native,
  "  const payload={url:item.streamUrl,title:item.name||'Swoop TV',kind:item.kind||'video',startSeconds:Number(startSeconds||0)};",
  "  const rawSubs=[...(Array.isArray(item?.subtitles)?item.subtitles:[]),...(item?.subtitleUrl||item?.subtitle_url?[{url:item.subtitleUrl||item.subtitle_url,label:'External subtitles'}]:[])];const subtitles=rawSubs.map(s=>typeof s==='string'?{url:s}:s).filter(s=>s&&String(s.url||s.uri||'').trim()).map(s=>({url:String(s.url||s.uri||'').trim(),label:String(s.label||s.name||''),language:String(s.language||s.lang||''),mimeType:String(s.mimeType||s.mime_type||'')}));const payload={url:item.streamUrl,title:item.name||'Swoop TV',kind:item.kind||'video',startSeconds:Number(startSeconds||0),subtitles};",
  'native subtitle payload'
);
writeFileSync(nativePath,native);

let css=readFileSync(cssPath,'utf8');
if(!css.includes('v0.8.39 — profile progress, bottom breathing room and player polish')){
  css+=`

/* v0.8.39 — profile progress, bottom breathing room and player polish. */
html.android-tv .profile-choice:focus-visible{
  outline:0!important;
  box-shadow:none!important;
  background:transparent!important;
  border-color:transparent!important;
}
html.android-tv .profile-choice:focus-visible .profile-avatar-xl{
  box-shadow:0 0 0 5px #fff,0 24px 70px rgba(0,0,0,.55)!important;
}
html.android-tv .profile-starmeter-prep{
  width:min(430px,54vw)!important;
  margin:18px auto 2px!important;
  display:block!important;
  color:#b9bdc7!important;
}
html.android-tv .profile-starmeter-prep-line{
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:16px!important;
  margin-bottom:7px!important;
  font-size:11px!important;
}
html.android-tv .profile-starmeter-prep-line strong{
  color:#eef0f4!important;
  font-size:11px!important;
  letter-spacing:.02em!important;
}
html.android-tv .profile-starmeter-prep-line span{
  min-width:42px!important;
  color:#f5c518!important;
  font-weight:950!important;
  text-align:right!important;
}
html.android-tv .profile-starmeter-progress{
  height:6px!important;
  overflow:hidden!important;
  border-radius:999px!important;
  background:rgba(255,255,255,.12)!important;
  box-shadow:inset 0 1px 2px rgba(0,0,0,.55)!important;
}
html.android-tv .profile-starmeter-progress>i{
  display:block!important;
  height:100%!important;
  border-radius:inherit!important;
  background:linear-gradient(90deg,var(--accent),var(--accent-2))!important;
  transition:width .22s ease!important;
}
html.android-tv .profile-starmeter-prep.ready .profile-starmeter-prep-line strong,
html.android-tv .profile-starmeter-prep.ready .profile-starmeter-prep-line span{color:#7fe6bd!important}
html.android-tv .home-content,
html.android-tv .myswoop-content,
html.android-tv .live-hub-content,
html.android-tv .media-category-page .page-content,
html.android-tv .starmeter-content,
html.android-tv .search-page .page-content{
  padding-bottom:210px!important;
}
`;
}
writeFileSync(cssPath,css);

let gradle=readFileSync(gradlePath,'utf8');
gradle=replaceRequired(gradle,/versionCode\s+838\b/,'versionCode 839','versionCode');
gradle=replaceRequired(gradle,/versionName\s+['"]0\.8\.38['"]/, "versionName '0.8.39'",'versionName');
writeFileSync(gradlePath,gradle);

let activity=readFileSync(activityPath,'utf8');
if(!activity.includes('0.8.38')||!activity.includes('versionCode", 838'))throw new Error('v0.8.39 promotion could not find native version markers');
activity=activity.replaceAll('0.8.38','0.8.39').replace('out.put("versionCode", 838);','out.put("versionCode", 839);');
activity=replaceRequired(activity,"import androidx.media3.common.MediaItem;","import androidx.media3.common.MediaItem;\nimport androidx.media3.common.MimeTypes;",'Media3 subtitle MIME import');
activity=replaceRequired(
  activity,
`        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        playerView.setControllerHideOnTouch(false);
        playerView.setKeepScreenOn(true);
        playerView.setVisibility(View.GONE);`,
`        playerView.setUseController(true);
        playerView.setControllerAutoShow(true);
        playerView.setControllerHideOnTouch(false);
        playerView.setControllerShowTimeoutMs(7000);
        playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        playerView.setShowRewindButton(true);
        playerView.setShowFastForwardButton(true);
        playerView.setShowSubtitleButton(true);
        playerView.setShowPreviousButton(false);
        playerView.setShowNextButton(false);
        playerView.setTimeBarScrubbingEnabled(true);
        playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        playerView.setKeepScreenOn(true);
        playerView.setVisibility(View.GONE);`,
  'premium PlayerView configuration'
);
activity=replaceRequired(
  activity,
`        root.addView(playerView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        launchSplashView = new ImageView(this);`,
`        root.addView(playerView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        configurePremiumPlayerControls();

        launchSplashView = new ImageView(this);`,
  'premium player control styling hook'
);
activity=replaceRequired(
  activity,
`    private void startNativePlayer(String url, String title, String kind, double startSeconds) {`,
`    private View media3Control(String resourceName) {
        if (playerView == null || resourceName == null) return null;
        int id = getResources().getIdentifier(resourceName, "id", getPackageName());
        return id == 0 ? null : playerView.findViewById(id);
    }

    private void configurePremiumPlayerControls() {
        if (playerView == null) return;
        String[] ids = new String[]{"exo_rew","exo_play_pause","exo_ffwd","exo_subtitle","exo_settings"};
        for (String idName : ids) {
            View control = media3Control(idName);
            if (control == null) continue;
            control.setVisibility(View.VISIBLE);
            float scale = "exo_play_pause".equals(idName) ? 1.28f : 1.14f;
            control.setScaleX(scale);
            control.setScaleY(scale);
            control.setPadding(12,12,12,12);
            if ("exo_subtitle".equals(idName)) control.setContentDescription("Subtitles");
            if ("exo_settings".equals(idName)) control.setContentDescription("Audio and playback options");
        }
        View bottomBar = media3Control("exo_bottom_bar");
        if (bottomBar != null) {
            bottomBar.setBackgroundColor(Color.argb(188,7,8,14));
            bottomBar.setPadding(34,16,34,24);
        }
    }

    private java.util.List<MediaItem.SubtitleConfiguration> buildSubtitleConfigurations(JSONArray subtitleTracks) {
        java.util.ArrayList<MediaItem.SubtitleConfiguration> out = new java.util.ArrayList<>();
        if (subtitleTracks == null) return out;
        for (int i=0;i<subtitleTracks.length();i++) {
            JSONObject row = subtitleTracks.optJSONObject(i);
            if (row == null) continue;
            String url = row.optString("url", row.optString("uri", "")).trim();
            if (url.isEmpty()) continue;
            String mime = row.optString("mimeType", row.optString("mime_type", "")).trim();
            if (mime.isEmpty()) {
                String lower = url.toLowerCase(Locale.ROOT);
                mime = lower.contains(".srt") ? MimeTypes.APPLICATION_SUBRIP : MimeTypes.TEXT_VTT;
            }
            MediaItem.SubtitleConfiguration.Builder builder = new MediaItem.SubtitleConfiguration.Builder(Uri.parse(url)).setMimeType(mime);
            String language = row.optString("language", row.optString("lang", "")).trim();
            String label = row.optString("label", row.optString("name", "")).trim();
            if (!language.isEmpty()) builder.setLanguage(language);
            if (!label.isEmpty()) builder.setLabel(label);
            out.add(builder.build());
        }
        return out;
    }

    private void startNativePlayer(String url, String title, String kind, double startSeconds, JSONArray subtitleTracks) {`,
  'premium player helper methods'
);
activity=replaceRequired(
  activity,
`        MediaItem item = new MediaItem.Builder().setUri(url).setMediaId(currentTitle).build();
        player.setMediaItem(item);`,
`        MediaItem.Builder mediaBuilder = new MediaItem.Builder().setUri(url).setMediaId(currentTitle);
        java.util.List<MediaItem.SubtitleConfiguration> subtitleConfigurations = buildSubtitleConfigurations(subtitleTracks);
        if (!subtitleConfigurations.isEmpty()) mediaBuilder.setSubtitleConfigurations(subtitleConfigurations);
        MediaItem item = mediaBuilder.build();
        player.setMediaItem(item);`,
  'sideloaded subtitle configuration'
);
activity=replaceRequired(
  activity,
`                    startNativePlayer(url, title, kind, start);`,
`                    startNativePlayer(url, title, kind, start, p.optJSONArray("subtitles"));`,
  'Android player bridge subtitle handoff'
);
writeFileSync(activityPath,activity);

let seedScript=readFileSync(seedScriptPath,'utf8');
seedScript=replaceRequired(seedScript,"sourceVersion:'0.8.38'","sourceVersion:'0.8.39'",'seed source version');
writeFileSync(seedScriptPath,seedScript);

let tests=readFileSync(testPath,'utf8');
tests=replaceRequired(tests,"if (!appSource.includes(\"const ANDROID_CURRENT_VERSION='0.8.38';\")) throw new Error('Current Android UI version marker missing');","if (!appSource.includes(\"const ANDROID_CURRENT_VERSION='0.8.39';\")) throw new Error('Current Android UI version marker missing');",'runtime current-version assertion');
tests=replaceRequired(tests,"if (!activitySource.includes('public String saveDiagnostics(String payloadJson)') || !activitySource.includes('Swoop-TV-v0.8.38-Diagnostics-')) throw new Error('Android diagnostic file export bridge missing');","if (!activitySource.includes('public String saveDiagnostics(String payloadJson)') || !activitySource.includes('Swoop-TV-v0.8.39-Diagnostics-')) throw new Error('Android diagnostic file export bridge missing');",'diagnostic filename assertion');
tests=replaceRequired(tests,"if (String(installSeed.sourceVersion||'') !== '0.8.38') throw new Error('Install seed source version is not v0.8.38');","if (String(installSeed.sourceVersion||'') !== '0.8.39') throw new Error('Install seed source version is not v0.8.39');",'install seed assertion');
tests=replaceRequired(tests,"if (!activitySource.includes('SwoopTV/0.8.38 AndroidTV') || !activitySource.includes('public String version() { return \"0.8.38\"; }')) throw new Error('v0.8.38 native Android markers missing');","if (!activitySource.includes('SwoopTV/0.8.39 AndroidTV') || !activitySource.includes('public String version() { return \"0.8.39\"; }')) throw new Error('v0.8.39 native Android markers missing');",'native Android version assertion');
tests += `
if (!appSource.includes('data-profile-starmeter-bar') || !appSource.includes("copy.textContent=starmeterBackgroundComplete?'Ready':'Please wait…'")) throw new Error('Who’s Watching preparation progress bar missing');
if (!cssSource.includes('html.android-tv .home-content,') || !cssSource.includes('padding-bottom:210px!important')) throw new Error('Home final-row breathing room missing');
if (!cssSource.includes('html.android-tv .profile-choice:focus-visible') || !cssSource.includes('.profile-choice:focus-visible .profile-avatar-xl')) throw new Error('Avatar-only profile focus treatment missing');
if (!activitySource.includes('setShowSubtitleButton(true)') || !activitySource.includes('setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS)') || !activitySource.includes('setTimeBarScrubbingEnabled(true)')) throw new Error('Premium Media3 playback controls missing');
if (!activitySource.includes('buildSubtitleConfigurations(JSONArray subtitleTracks)') || !nativeSource.includes('item?.subtitles') || !nativeSource.includes('subtitleUrl')) throw new Error('Sideloaded subtitle handoff missing');
if (!activitySource.includes('Audio and playback options')) throw new Error('Premium audio/settings control emphasis missing');
`;
writeFileSync(testPath,tests);

let notes=readFileSync(notesPath,'utf8');
const section=`## v0.8.39 — Profile Preparation + Player Experience Pass

- Replaces the technical STARmeter preparation status on Who’s Watching with a simple **Please wait…** progress bar and completion state.
- Removes the large rectangular profile focus treatment; focus now lives only around the animal avatar.
- Adds a true 210 px TV bottom tail to Home and other browsing hubs so the final rail clearly ends instead of appearing frozen against the screen edge.
- Upgrades the native Media3 player with stronger TV controls, visible buffering feedback, 10-second rewind/fast-forward, a longer control timeout, direct subtitle controls and a prominent settings path for audio/playback options.
- Multiple embedded audio tracks remain selectable through Media3’s track settings when the source exposes them.
- Adds sideloaded/provider subtitle handoff for SRT/VTT-style subtitle URLs when Swoop has subtitle metadata for the selected title.
- Android versionName is **0.8.39** and versionCode is **839**.

`;
if(!notes.includes('## v0.8.39 — Profile Preparation + Player Experience Pass')){const header='# Swoop TV Release Notes\n\n';notes=notes.startsWith(header)?header+section+notes.slice(header.length):section+notes;writeFileSync(notesPath,notes)}

let fixes=readFileSync(fixesPath,'utf8');
fixes=fixes.replace(/\*\*v0\.8\.\d+[^*]*\*\*/,'**v0.8.39 — Profile Preparation + Player Experience Pass**');
if(!fixes.includes('PLAYER-001'))fixes=fixes.replace('## Implemented — needs physical-TV verification\n','## Implemented — needs physical-TV verification\n\n- [ ] **PROFILE-PREP-001:** Who’s Watching shows a simple visible progress bar while startup preparation runs; no technical STARmeter status copy is required.\n- [ ] **PROFILE-FOCUS-001:** profile selection focus is drawn only around the avatar, with no large white rectangle around the whole profile tile.\n- [ ] **HOME-TAIL-001:** the final Home rail has a clear ~210 px blank tail beneath it and no longer stops flush against the bottom of the TV.\n- [ ] **PLAYER-001:** native VOD/episode playback has premium TV controls with visible buffering, rewind/fast-forward, subtitle selection and an Audio/Playback settings path.\n- [ ] **PLAYER-AUDIO-001:** sources exposing multiple audio tracks can switch tracks through the Media3 settings UI.\n- [ ] **PLAYER-SUB-001:** embedded subtitles are selectable and provider/sideloaded subtitle URLs are attached when present.\n');
writeFileSync(fixesPath,fixes);

run(process.execPath,['scripts/refresh-seed-cache.mjs']);
if(existsSync(selfPath))unlinkSync(selfPath);

for(const p of [appPath,nativePath,testPath])run(process.execPath,['--check',p]);
run(process.execPath,['tests/card-runtime-smoke.mjs']);
run(process.execPath,[testPath]);
run('python',['-m','json.tool','app/src/main/assets/starmeter.json'],{stdio:'ignore'});
run('python',['-m','json.tool','app/src/main/assets/seed-cache.json'],{stdio:'ignore'});
run('python',['-m','json.tool','swoop-tv-seed-cache.json'],{stdio:'ignore'});

run('git',['config','user.name','github-actions[bot]']);
run('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
run('git',['add','-A']);
const status=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
if(!status)throw new Error('v0.8.39 promotion produced no source changes');
run('git',['commit','-m','Promote v0.8.39 profile preparation and player experience pass [skip ci]']);
run('git',['push','origin','HEAD:main']);
console.log('v0.8.39 source promotion complete; continuing APK build and Downloader publication.');
