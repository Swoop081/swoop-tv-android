import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const selfPath='.promotion/promote-pending.mjs';
const appPath='app/src/main/assets/app.js';
const cssPath='app/src/main/assets/styles.css';
const buildPath='app/build.gradle';
const activityPath='app/src/main/java/tv/swoop/player/MainActivity.java';
const seedPath='scripts/refresh-seed-cache.mjs';
const swPath='app/src/main/assets/sw.js';
const testsPath='tests/tv-ui-runtime-smoke.mjs';
const notesPath='RELEASE_NOTES.md';
const checklistPath='TV_HARDWARE_TEST_CHECKLIST.md';

function read(path){return fs.readFileSync(path,'utf8')}
function write(path,value){fs.writeFileSync(path,value)}
function replaceRequired(source,search,replacement,label){
  if(!source.includes(search))throw new Error(`v0.8.40 promotion could not find ${label}`);
  return source.replace(search,replacement);
}

let app=read(appPath);
app=replaceRequired(app,"const ANDROID_CURRENT_VERSION='0.8.39';","const ANDROID_CURRENT_VERSION='0.8.40';",'Android UI version');
app=replaceRequired(
  app,
  "let livePreviewTimer=null,livePreviewItemId='',livePreviewActive=false,livePreviewPageToken=0;",
  "let livePreviewTimer=null,livePreviewItemId='',livePreviewActive=false,livePreviewPageToken=0,liveHeroProgrammeTimer=null;",
  'Live TV preview state'
);
app=replaceRequired(
  app,
  'const ANDROID_CURRENT_CHANGELOG=[\n',
  "const ANDROID_CURRENT_CHANGELOG=[\n  'Shows the programme playing right now directly under the Live TV channel logo, updating as focus or the programme changes.',\n",
  'Android changelog'
);
app=replaceRequired(
  app,
  "  const lead=favorites[0]||recent[0]||all[0],leadVisual=visualItem(lead),leadFav=lead?isLiveFavourite(lead):false;",
  "  const lead=favorites[0]||recent[0]||all[0],leadVisual=visualItem(lead),leadFav=lead?isLiveFavourite(lead):false,leadNow=lead?currentProgramme(lead):null;",
  'Live TV lead programme lookup'
);
app=replaceRequired(
  app,
  '<div class="live-hub-brand-copy"><div class="eyebrow">LIVE TV · ${esc(providerName)}</div><span data-live-hero-meta>${esc(lead?.group||\'Live TV\')}</span></div>',
  '<div class="live-hub-brand-copy"><div class="live-hub-now" data-live-hero-now><span>NOW PLAYING</span><strong>${esc(leadNow?.title||\'Programme information unavailable\')}</strong></div><div class="eyebrow">LIVE TV · ${esc(providerName)}</div><span data-live-hero-meta>${esc(lead?.group||\'Live TV\')}</span></div>',
  'Live TV Now Playing markup'
);
app=replaceRequired(
  app,
  "  const categoryRows=shownCategories.map(liveCategoryRailMarkup).join('');",
  "  const categoryRows=shownCategories.map(liveCategoryRailMarkup).join('');\n  if(lead)setTimeout(()=>{if(state.page==='live')scheduleLiveHeroNowPlaying(lead,120)},0);",
  'initial Live TV programme refresh'
);
app=replaceRequired(
  app,
  "fallback.textContent=item.name||'LIVE'}return true;",
  "fallback.textContent=item.name||'LIVE'}scheduleLiveHeroNowPlaying(item,180);return true;",
  'focused Live TV programme refresh'
);
app=replaceRequired(
  app,
  "function currentProgramme(channel){const cached=epgCache.get(channel?.id),now=Date.now(),list=cached?.list||[];return list.find(p=>now>=p.startMs&&now<p.endMs)||null}\nasync function ensureLiveEpg(channel){",
  `function currentProgramme(channel){const cached=epgCache.get(channel?.id),now=Date.now(),list=cached?.list||[];return list.find(p=>now>=p.startMs&&now<p.endMs)||null}\nfunction patchLiveHeroNowPlaying(channel){\n  if(state.page!=='live'||!channel)return false;const hero=document.querySelector('.live-hub-hero'),box=hero?.querySelector('[data-live-hero-now]');if(!hero||!box||String(hero.dataset.liveHeroItem||'')!==String(channel.id||''))return false;\n  const programme=currentProgramme(channel),title=String(programme?.title||'').trim(),strong=box.querySelector('strong');box.classList.toggle('unavailable',!title);if(strong)strong.textContent=title||'Programme information unavailable';return Boolean(title);\n}\nfunction scheduleLiveHeroNowPlaying(channel,delay=180){\n  if(liveHeroProgrammeTimer){clearTimeout(liveHeroProgrammeTimer);liveHeroProgrammeTimer=null}if(state.page!=='live'||!channel)return;patchLiveHeroNowPlaying(channel);const id=String(channel.id||'');\n  liveHeroProgrammeTimer=setTimeout(async()=>{liveHeroProgrammeTimer=null;const hero=document.querySelector('.live-hub-hero');if(state.page!=='live'||String(hero?.dataset?.liveHeroItem||'')!==id)return;await ensureLiveEpg(channel).catch(()=>null);const latest=document.querySelector('.live-hub-hero');if(state.page!=='live'||String(latest?.dataset?.liveHeroItem||'')!==id)return;patchLiveHeroNowPlaying(channel);const programme=currentProgramme(channel);if(programme?.endMs){const wait=Math.max(1250,Math.min(6*3600000,Number(programme.endMs)-Date.now()+1000));liveHeroProgrammeTimer=setTimeout(()=>scheduleLiveHeroNowPlaying(channel,0),wait)}},Math.max(0,Number(delay)||0));\n}\nasync function ensureLiveEpg(channel){`,
  'Live TV current-programme sync helpers'
);
app=replaceRequired(
  app,
  "function stopLiveHeroPreview(){\n  if(livePreviewTimer){clearTimeout(livePreviewTimer);livePreviewTimer=null}livePreviewItemId='';document.querySelector('.live-hub-preview-panel')?.classList.remove('preview-active');",
  "function stopLiveHeroPreview(){\n  if(liveHeroProgrammeTimer){clearTimeout(liveHeroProgrammeTimer);liveHeroProgrammeTimer=null}\n  if(livePreviewTimer){clearTimeout(livePreviewTimer);livePreviewTimer=null}livePreviewItemId='';document.querySelector('.live-hub-preview-panel')?.classList.remove('preview-active');",
  'Live TV programme timer cleanup'
);
write(appPath,app);

let css=read(cssPath);
if(!css.includes('v0.8.40 — Live TV current-programme identity')){
  css += `\n\n/* ========================================================================== */\n/* v0.8.40 — Live TV current-programme identity.                              */\n/* ========================================================================== */\n.live-hub-now{display:flex;align-items:baseline;gap:8px;min-width:0}\n.live-hub-now>span{font-size:9px;font-weight:950;letter-spacing:.12em;color:#7fe6bd;white-space:nowrap}\n.live-hub-now>strong{min-width:0;font-size:15px;line-height:1.2;color:#fff;font-weight:900;overflow:hidden;text-overflow:ellipsis}\n.live-hub-now.unavailable>strong{color:#8d929c;font-weight:750}\nhtml.android-tv .live-hub-now{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;align-items:start!important;gap:8px!important;margin-top:4px!important;max-width:100%!important}\nhtml.android-tv .live-hub-now>span{font-size:8px!important;line-height:1.35!important;padding-top:2px!important;color:#7fe6bd!important;font-weight:1000!important;letter-spacing:.11em!important}\nhtml.android-tv .live-hub-now>strong{font-size:16px!important;line-height:1.16!important;color:#fff!important;font-weight:900!important;display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;white-space:normal!important;overflow:hidden!important;text-overflow:ellipsis!important}\nhtml.android-tv .live-hub-now.unavailable>strong{font-size:11px!important;color:#838894!important;font-weight:750!important}\nhtml.android-tv[data-tv-density=\"tight\"] .live-hub-now>strong{font-size:14px!important;-webkit-line-clamp:1!important}\n`;
}
write(cssPath,css);

let build=read(buildPath);
build=replaceRequired(build,'versionCode 839','versionCode 840','Android versionCode');
build=replaceRequired(build,"versionName '0.8.39'","versionName '0.8.40'",'Android versionName');
write(buildPath,build);

let activity=read(activityPath);
if(!activity.includes('0.8.39'))throw new Error('v0.8.40 promotion could not find MainActivity version markers');
activity=activity.replaceAll('0.8.39','0.8.40');
activity=replaceRequired(activity,'out.put("versionCode", 839);','out.put("versionCode", 840);','native diagnostic versionCode');
write(activityPath,activity);

let seed=read(seedPath);
seed=replaceRequired(seed,"sourceVersion:'0.8.39'","sourceVersion:'0.8.40'",'seed sourceVersion');
write(seedPath,seed);

let sw=read(swPath);
sw=replaceRequired(sw,"const CACHE='swoop-tv-v0837-shell';","const CACHE='swoop-tv-v0840-shell';",'service-worker shell cache');
write(swPath,sw);

let tests=read(testsPath);
if(!tests.includes('0.8.39'))throw new Error('v0.8.40 promotion could not find runtime test version markers');
tests=tests.replaceAll('0.8.39','0.8.40');
if(!tests.includes('Live TV current-programme header'))tests += `\n// v0.8.40 Live TV current-programme header.\nif (!appSource.includes('data-live-hero-now') || !appSource.includes('function scheduleLiveHeroNowPlaying(')) throw new Error('Live TV current-programme header/sync missing');\nif (!appSource.includes('currentProgramme(channel)') || !appSource.includes('ensureLiveEpg(channel)')) throw new Error('Live TV Now Playing is not sourced from the existing EPG cache/path');\nif (!appSource.includes('NOW PLAYING') || !cssSource.includes('.live-hub-now>strong')) throw new Error('Live TV Now Playing presentation missing');\n`;
write(testsPath,tests);

let notes=read(notesPath);
if(!notes.includes('## v0.8.40 — Live TV Now Playing')){
  notes=notes.replace('# Swoop TV Release Notes\n','# Swoop TV Release Notes\n\n## v0.8.40 — Live TV Now Playing\n\n- Adds one concise **Now Playing** programme title directly under the persistent Live TV channel logo.\n- Uses Swoop’s existing EPG cache/current-programme lookup; no extra guide grid, synopsis, next-programme row or timeline is added to the Live TV header.\n- The programme title updates immediately when remote focus moves to another channel and refreshes again at the current programme boundary.\n- Keeps the approved sticky Live TV header geometry, large native preview, channel branding and channel rails unchanged.\n- Android versionName is **0.8.40** and versionCode is **840**.\n');
}
write(notesPath,notes);

let checklist=read(checklistPath);
if(!checklist.includes('LIVE-NOW-001'))checklist += `\n- [ ] **LIVE-NOW-001:** On Live TV, the left channel logo has exactly one current EPG programme title beneath it; changing channel focus updates the title, and the title changes at the programme boundary without opening the full Guide.\n`;
write(checklistPath,checklist);

if(fs.existsSync(selfPath))fs.unlinkSync(selfPath);
execFileSync('git',['config','user.name','github-actions[bot]'],{stdio:'inherit'});
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],{stdio:'inherit'});
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Promote v0.8.40 Live TV Now Playing [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.40 Live TV Now Playing promotion applied and pushed.');
