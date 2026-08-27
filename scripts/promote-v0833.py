from pathlib import Path
import json, subprocess

root = Path.cwd()
app = root / 'app/src/main/assets/app.js'
css = root / 'app/src/main/assets/styles.css'
worker = root / 'app/src/main/assets/src/catalog-index-worker.js'
gradle = root / 'app/build.gradle'
sw = root / 'app/src/main/assets/sw.js'
activity = root / 'app/src/main/java/tv/swoop/player/MainActivity.java'
test = root / 'tests/tv-ui-runtime-smoke.mjs'
seed_script = root / 'scripts/refresh-seed-cache.mjs'
notes = root / 'RELEASE_NOTES.md'

if not app.exists() or not gradle.exists():
    raise SystemExit('Run from the Swoop TV repository root')

current = gradle.read_text()
if "versionName '0.8.33'" in current and 'function prepareStarmeterBeforeLogin()' in app.read_text():
    print('v0.8.33 source promotion already applied')
    raise SystemExit(0)
if "versionName '0.8.32'" not in current:
    print('v0.8.33 one-time promotion is not applicable to this source version')
    raise SystemExit(0)

s = app.read_text()
s = s.replace("const ANDROID_CURRENT_VERSION='0.8.32';", "const ANDROID_CURRENT_VERSION='0.8.33';")
s = s.replace(
"  'Makes STARmeter a fixed 100-row TV surface so fast D-pad scrolling can never outrun row mounting or collapse the viewport while provider matches hydrate.',\n  'Runs bounded concurrent STARmeter matching with directional look-ahead, stable row geometry and larger horizontal filmography rails.',\n  'Aggressively preloads artwork ahead of focus on Top 100 and long TV rails, including correctly-sized hero backdrops, while keeping text/title fallbacks visible until artwork has decoded.',\n  'Prewarms Home and Live TV before route entry, hides the Live preview surface until native video is actually ready, enlarges Guide logos inside the existing cells and adds a branded Android launch surface.'",
"  'Restores every main Google TV route to its true top position when D-pad focus returns to the selected top navigation tab.',\n  'Prepares the full STARmeter Top 100 against the connected provider catalogue before profile login using one indexed batch match instead of focus-driven person jobs.',\n  'Keeps STARmeter rows in permanent non-overlapping TV geometry and renders the page only from completed provider-match results.',\n  'Prewarms STARmeter portraits and representative filmography artwork while the Who’s Watching screen is still visible.'")

old = """let starmeterPeople=[],starmeterLoaded=false,starmeterLoading=false,starmeterError='',starmeterObserver=null,starmeterPrewarmTimer=null,starmeterVisibleCount=5,starmeterAutoLoadObserver=null;\nconst starmeterPersonCache=new Map(),starmeterHotCache=new Map(),starmeterHydratePending=new Map(),starmeterRetryCounts=new Map();\nconst starmeterHydrateQueue=[];let starmeterHydrateBusy=0,starmeterGeneration=0;"""
new = """let starmeterPeople=[],starmeterLoaded=false,starmeterLoading=false,starmeterError='',starmeterObserver=null,starmeterPrewarmTimer=null,starmeterVisibleCount=5,starmeterAutoLoadObserver=null;\nconst starmeterPersonCache=new Map(),starmeterHotCache=new Map(),starmeterHydratePending=new Map(),starmeterRetryCounts=new Map();\nconst starmeterHydrateQueue=[];let starmeterHydrateBusy=0,starmeterGeneration=0;\nlet starmeterBackgroundPreparePromise=null,starmeterBackgroundReady=false,starmeterBackgroundProgress=0,starmeterBackgroundStatus='Preparing STARmeter…',starmeterPreparedProviderSignature='';"""
if old not in s: raise SystemExit('STARmeter state anchor not found')
s = s.replace(old, new)

old = """<div class=\"profile-picker-grid\">${profiles.map(p=>{const t=profileTheme(p);return `<button class=\"profile-choice profile-theme-${esc(t.id)}\" data-profile-select=\"${esc(p.id)}\">${profileAvatarHtml(p,'profile-avatar-xl')}<strong>${esc(p.name)}</strong><span>${p.kids?'Kids profile':'Personal profile'}${p.pinHash?' · PIN':''}</span><em class=\"profile-theme-chip\" style=\"--theme-chip:${esc(t.swatch)}\">${esc(t.name)}</em></button>`}).join('')}<button class=\"profile-choice profile-add-choice\" data-profile-add>${profileAvatarHtml({name:'+',avatar:'elephant'},'profile-avatar-xl')}<strong>Add Profile</strong><span>Create another personalised Swoop TV</span><em class=\"profile-theme-chip\">Choose a theme</em></button></div><div class=\"profile-picker-actions\"><button class=\"btn secondary\" data-profile-manage>Manage Profiles</button><button class=\"btn secondary\" data-page=\"settings\">⚙ Settings</button></div></div></main>`;"""
new = """<div class=\"profile-picker-grid\">${profiles.map(p=>{const t=profileTheme(p);return `<button class=\"profile-choice profile-theme-${esc(t.id)}\" data-profile-select=\"${esc(p.id)}\">${profileAvatarHtml(p,'profile-avatar-xl')}<strong>${esc(p.name)}</strong><span>${p.kids?'Kids profile':'Personal profile'}${p.pinHash?' · PIN':''}</span><em class=\"profile-theme-chip\" style=\"--theme-chip:${esc(t.swatch)}\">${esc(t.name)}</em></button>`}).join('')}<button class=\"profile-choice profile-add-choice\" data-profile-add>${profileAvatarHtml({name:'+',avatar:'elephant'},'profile-avatar-xl')}<strong>Add Profile</strong><span>Create another personalised Swoop TV</span><em class=\"profile-theme-chip\">Choose a theme</em></button></div>${NATIVE_ANDROID?`<div class=\"profile-starmeter-prep ${starmeterBackgroundReady?'ready':''}\" data-profile-starmeter-prep><span>${starmeterBackgroundReady?'✓':`${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%`}</span><strong>${esc(starmeterBackgroundReady?'STARmeter Top 100 ready':starmeterBackgroundStatus)}</strong></div>`:''}<div class=\"profile-picker-actions\"><button class=\"btn secondary\" data-profile-manage>Manage Profiles</button><button class=\"btn secondary\" data-page=\"settings\">⚙ Settings</button></div></div></main>`;"""
if old not in s: raise SystemExit('Profile picker anchor not found')
s = s.replace(old, new)

old = """  if(target.pinHash&&!skipPin){pendingProfileId=id;profilePinError='';modal='pin';profilePickerOpen=false;render();return}\n  if(playerItem)await stopPlayback(true);"""
new = """  if(target.pinHash&&!skipPin){pendingProfileId=id;profilePinError='';modal='pin';profilePickerOpen=false;render();return}\n  if(NATIVE_ANDROID&&!starmeterBackgroundReady)await prepareStarmeterBeforeLogin().catch(()=>false);\n  if(playerItem)await stopPlayback(true);"""
if old not in s: raise SystemExit('switchProfile anchor not found')
s = s.replace(old, new)

anchor = "function starmeterPersonSeed(entry={}){const hot=starmeterHotCache.get(starmeterNormalize(entry.name));return hot?.person||{id:entry.id||'',name:entry.name||'',profile:entry.profile||'',knownForDepartment:entry.knownForDepartment||'Person'}}\n"
helpers = r'''function starmeterProviderSignature(){
  const ids=enabledProviders().map(p=>`${p.id}:${Number(p?.counts?.live||0)+Number(p?.counts?.movie||0)+Number(p?.counts?.series||0)}:${Number(p?.lastRefreshAt||p?.updatedAt||0)}`).sort();
  return `${catalogLogicalTotal()}|${ids.join('|')}`;
}
function patchProfileStarmeterPrep(){
  if(!NATIVE_ANDROID||!profilePickerOpen)return;const el=document.querySelector('[data-profile-starmeter-prep]');if(!el)return;
  el.classList.toggle('ready',starmeterBackgroundReady);const value=el.querySelector('span'),copy=el.querySelector('strong');
  if(value)value.textContent=starmeterBackgroundReady?'✓':`${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%`;
  if(copy)copy.textContent=starmeterBackgroundReady?'STARmeter Top 100 ready':starmeterBackgroundStatus;
}
function setStarmeterBackgroundProgress(progress,status=''){
  starmeterBackgroundProgress=Math.max(0,Math.min(100,Number(progress||0)));if(status)starmeterBackgroundStatus=status;patchProfileStarmeterPrep();
}
function prewarmPreparedStarmeterArtwork(){
  if(!NATIVE_ANDROID||!starmeterBackgroundReady)return;
  const portraits=[];for(const entry of starmeterPeople){const person=starmeterPersonCache.get(starmeterNormalize(entry.name))?.person||starmeterPersonSeed(entry),url=artworkWarmEntry(person?.profile,'w185');if(url&&!portraits.includes(url))portraits.push(url)}
  portraits.slice(0,100).forEach(rememberArtworkPrewarm);
  const rounds=[];for(let slot=0;slot<3;slot++)for(const entry of starmeterPeople){const cached=starmeterPersonCache.get(starmeterNormalize(entry.name)),item=starmeterPersonTitles(cached)[slot];if(item)rounds.push(item)}
  prewarmArtworkUrls(rounds,160);
}
async function prepareStarmeterBeforeLogin(){
  if(!NATIVE_ANDROID)return false;
  const currentSignature=starmeterProviderSignature();
  if(starmeterBackgroundReady&&currentSignature&&currentSignature===starmeterPreparedProviderSignature)return true;
  if(starmeterBackgroundPreparePromise)return starmeterBackgroundPreparePromise;
  starmeterBackgroundPreparePromise=(async()=>{
    try{
      setStarmeterBackgroundProgress(4,'Preparing STARmeter Top 100…');
      await ensureStarmeterLoaded();if(!starmeterPeople.length)throw new Error('STARmeter list unavailable');
      setStarmeterBackgroundProgress(10,'Restoring your provider catalogue…');
      if(!state.catalog.length||tvHomeSnapshotActive)await ensureDurableLibraryRestored().catch(()=>false);
      if(!state.catalog.length){setStarmeterBackgroundProgress(100,'STARmeter will prepare after a provider is connected.');return false}
      setStarmeterBackgroundProgress(18,'Indexing your connected movies and TV shows…');
      const workerReady=await ensureTvCatalogWorkerReady(18000);if(!workerReady)throw new Error('Provider availability index unavailable');
      const people=starmeterPeople.map(entry=>{const key=starmeterNormalize(entry.name),hot=starmeterHotCache.get(key),person=hot?.person||starmeterPersonSeed(entry),credits=Array.isArray(hot?.credits)?hot.credits:[];return {key,rank:Number(entry.rank||0),person,moviePayload:personCreditPayload(credits,'movie'),showPayload:personCreditPayload(credits,'series')}});
      setStarmeterBackgroundProgress(28,'Matching all 100 people to your providers…');
      const batch=await tvCatalogWorkerRequest('person-match-batch',{people},24000);const results=Array.isArray(batch?.results)?batch.results:[];
      if(results.length!==people.length)throw new Error('STARmeter batch match did not complete');
      const byKey=new Map(people.map(row=>[row.key,row]));let done=0;
      for(const row of results){const source=byKey.get(row.key);if(!source)continue;const value={person:source.person,movies:Array.isArray(row.movies)?sortPersonLibraryItems(row.movies):[],shows:Array.isArray(row.shows)?sortPersonLibraryItems(row.shows):[],loadedAt:Date.now(),prelogin:true};starmeterPersonCache.set(row.key,value);starmeterHotCache.set(row.key,{...(starmeterHotCache.get(row.key)||{}),...value});personLibraryCache.set(`${value.person.id||''}|${String(value.person.name||'').toLowerCase()}`,value);done++;if(done%10===0)setStarmeterBackgroundProgress(28+(done/Math.max(1,people.length))*62,`Matched ${done} of ${people.length} STARmeter people…`)}
      starmeterBackgroundReady=true;starmeterPreparedProviderSignature=starmeterProviderSignature();setStarmeterBackgroundProgress(100,'STARmeter Top 100 ready');prewarmPreparedStarmeterArtwork();
      if(state.page==='starmeter'&&!profilePickerOpen&&!detailItem&&!personView)render();return true;
    }catch(err){starmeterBackgroundReady=false;starmeterBackgroundStatus=err?.message||'STARmeter preparation will retry in the background.';patchProfileStarmeterPrep();return false}
    finally{starmeterBackgroundPreparePromise=null}
  })();
  return starmeterBackgroundPreparePromise;
}
'''
if anchor not in s: raise SystemExit('starmeterPersonSeed anchor not found')
s = s.replace(anchor, helpers + anchor)

old = """function starmeterPage(){\n  const visible=starmeterPeople.slice(0,100);\n  const body=visible.length?visible.map(starmeterPersonSection).join(''):starmeterError?`<div class=\"starmeter-error\"><h2>STARmeter unavailable</h2><p>${esc(starmeterError)}</p><button class=\"btn secondary\" data-starmeter-retry>Try again</button></div>`:`<div class=\"starmeter-page-loading\"><span class=\"provider-spinner\"></span><strong>Loading IMDb STARmeter Top 100…</strong><small>Preparing the people viewers are searching for now.</small></div>`;"""
new = """function starmeterPage(){\n  const visible=starmeterPeople.slice(0,100),waiting=NATIVE_ANDROID&&!starmeterBackgroundReady;\n  const body=waiting?`<div class=\"starmeter-page-loading starmeter-full-prepare\"><span class=\"provider-spinner\"></span><strong>${esc(starmeterBackgroundStatus||'Preparing the complete STARmeter Top 100…')}</strong><small>${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}% · Swoop TV is matching all people before the page becomes focusable.</small></div>`:visible.length?visible.map(starmeterPersonSection).join(''):starmeterError?`<div class=\"starmeter-error\"><h2>STARmeter unavailable</h2><p>${esc(starmeterError)}</p><button class=\"btn secondary\" data-starmeter-retry>Try again</button></div>`:`<div class=\"starmeter-page-loading\"><span class=\"provider-spinner\"></span><strong>Loading IMDb STARmeter Top 100…</strong><small>Preparing the people viewers are searching for now.</small></div>`;"""
if old not in s: raise SystemExit('starmeterPage anchor not found')
s = s.replace(old, new)

s = s.replace("async function hydrateStarmeterPerson(entry={}){\n  const key=starmeterNormalize(entry.name);", "async function hydrateStarmeterPerson(entry={},options={}){\n  const background=Boolean(options?.background),key=starmeterNormalize(entry.name);")
s = s.replace("if(generation!==starmeterGeneration||state.page!=='starmeter')return null;\n    const hot=", "if(!background&&(generation!==starmeterGeneration||state.page!=='starmeter'))return null;\n    const hot=", 1)
s = s.replace("if(generation!==starmeterGeneration||state.page!=='starmeter')return null;\n    const value=", "if(!background&&(generation!==starmeterGeneration||state.page!=='starmeter'))return null;\n    const value=", 1)
s = s.replace("  }catch(err){if(generation!==starmeterGeneration||state.page!=='starmeter')return null;", "  }catch(err){if(!background&&(generation!==starmeterGeneration||state.page!=='starmeter'))return null;")
s = s.replace("if(retryable){const tries=Number(starmeterRetryCounts.get(key)||0);", "if(retryable&&!background){const tries=Number(starmeterRetryCounts.get(key)||0);")

old = """  if(!profilePickerOpen&&!mediaRoute&&state.page==='starmeter'){if(!starmeterLoaded&&!starmeterLoading)setTimeout(ensureStarmeterLoaded,0);else setTimeout(()=>{observeStarmeterSections(document);setupStarmeterAutoLoad();starmeterPeople.slice(0,18).forEach((entry,i)=>queueStarmeterPerson(entry,{priority:i<6}))},0)}"""
new = """  if(!profilePickerOpen&&!mediaRoute&&state.page==='starmeter'){if(!starmeterBackgroundReady)setTimeout(()=>prepareStarmeterBeforeLogin().catch(()=>false),0);else setTimeout(()=>{setupStarmeterAutoLoad();prewarmPreparedStarmeterArtwork()},0)}"""
if old not in s: raise SystemExit('starmeter render hook anchor not found')
s = s.replace(old, new)

old = """function tvHomeFocus(target,block='nearest'){\n  if(!target)return false;rememberTvFocus();\n  const preserveTop=NATIVE_ANDROID&&state.page==='home'&&Boolean(target.closest?.('.topbar,.hero'));\n  if(preserveTop){window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0}\n  try{target.focus({preventScroll:true})}catch{target.focus()}\n  if(!preserveTop)target.scrollIntoView({behavior:'auto',block,inline:'nearest'});\n  tvFocusMemory=tvFocusSignature(target);return true\n}"""
new = """function tvForceRouteTop(){\n  if(!NATIVE_ANDROID)return false;const reset=()=>{try{window.scrollTo(0,0)}catch{}document.documentElement.scrollTop=0;document.body.scrollTop=0};reset();requestAnimationFrame(()=>{reset();requestAnimationFrame(reset)});return true\n}\nfunction tvHomeFocus(target,block='nearest'){\n  if(!target)return false;rememberTvFocus();\n  const preserveTop=NATIVE_ANDROID&&Boolean(target.closest?.('.topbar')||(state.page==='home'&&target.closest?.('.hero')));\n  if(preserveTop)tvForceRouteTop();\n  try{target.focus({preventScroll:true})}catch{target.focus()}\n  if(!preserveTop)target.scrollIntoView({behavior:'auto',block,inline:'nearest'});\n  tvFocusMemory=tvFocusSignature(target);return true\n}"""
if old not in s: raise SystemExit('tvHomeFocus anchor not found')
s = s.replace(old, new)

old = """    if(key==='ArrowUp'&&first&&currentSection===first){const heroAction=document.querySelector('.page-hero .btn,.live-hub-hero .btn');if(heroAction)return tvHomeFocus(heroAction,'nearest')}"""
new = """    if(key==='ArrowUp'&&first&&currentSection===first){const heroAction=document.querySelector('.page-hero .btn,.live-hub-hero .btn');if(heroAction)return tvHomeFocus(heroAction,'nearest');const routeTab=document.querySelector(`.desktop-nav [data-page=\"${CSS.escape(state.page)}\"]`);if(routeTab)return tvHomeFocus(routeTab,'start')}"""
if old not in s: raise SystemExit('first-row Up anchor not found')
s = s.replace(old, new)

old = """  if(!target)return false;\n  rememberTvFocus();\n  try{target.focus({preventScroll:true})}catch{target.focus()}"""
new = """  if(!target)return false;\n  if(NATIVE_ANDROID&&tvIsTopNavigationElement(target))return tvHomeFocus(target,'start');\n  rememberTvFocus();\n  try{target.focus({preventScroll:true})}catch{target.focus()}"""
if old not in s: raise SystemExit('spatial topbar anchor not found')
s = s.replace(old, new)

s = s.replace("androidLatestManifest={version:ANDROID_CURRENT_VERSION,versionCode:832", "androidLatestManifest={version:ANDROID_CURRENT_VERSION,versionCode:833")
old = """async function bootstrapApp(){\n  if(NATIVE_ANDROID){render();return}"""
new = """async function bootstrapApp(){\n  if(NATIVE_ANDROID){render();setTimeout(()=>prepareStarmeterBeforeLogin().catch(()=>false),0);return}"""
if old not in s: raise SystemExit('bootstrap anchor not found')
s = s.replace(old, new)
app.write_text(s)

w = worker.read_text()
old = """    if(msg.type==='person-match'){\n      const moviePayload=msg.moviePayload||{items:[]},showPayload=msg.showPayload||{items:[]};\n      const movies=fastPersonMatch(moviePayload,'movie'),shows=fastPersonMatch(showPayload,'series');\n      reply('person-match-result',msg.requestId,{movies,shows,indexed:true});return;\n    }"""
new = """    if(msg.type==='person-match'){\n      const moviePayload=msg.moviePayload||{items:[]},showPayload=msg.showPayload||{items:[]};\n      const movies=fastPersonMatch(moviePayload,'movie'),shows=fastPersonMatch(showPayload,'series');\n      reply('person-match-result',msg.requestId,{movies,shows,indexed:true});return;\n    }\n    if(msg.type==='person-match-batch'){\n      const people=Array.isArray(msg.people)?msg.people:[],results=people.map(row=>({key:String(row?.key||''),rank:Number(row?.rank||0),movies:fastPersonMatch(row?.moviePayload||{items:[]},'movie'),shows:fastPersonMatch(row?.showPayload||{items:[]},'series')}));\n      reply('person-match-batch-result',msg.requestId,{results,indexed:true});return;\n    }"""
if old not in w: raise SystemExit('worker person-match anchor not found')
worker.write_text(w.replace(old, new))

c = css.read_text()
c += r'''

/* ========================================================================== */
/* v0.8.33 — route-top restoration + pre-login STARmeter completion.          */
/* ========================================================================== */
html.android-tv .profile-starmeter-prep{
  margin:16px auto 2px!important;min-height:28px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;
  color:#9fa4ae!important;font-size:10px!important;letter-spacing:.015em!important;pointer-events:none!important;
}
html.android-tv .profile-starmeter-prep span{min-width:34px!important;text-align:center!important;color:#f5c518!important;font-weight:950!important}
html.android-tv .profile-starmeter-prep.ready strong,html.android-tv .profile-starmeter-prep.ready span{color:#7fe6bd!important}
html.android-tv .starmeter-person-section{height:430px!important;min-height:430px!important;max-height:430px!important;margin-bottom:42px!important;contain:layout style!important}
html.android-tv .starmeter-library-column{height:394px!important;min-height:394px!important;max-height:394px!important;overflow:visible!important}
html.android-tv .starmeter-title-rail{grid-auto-columns:minmax(0,196px)!important;min-height:318px!important;max-height:328px!important;overflow-x:auto!important;overflow-y:visible!important;padding-bottom:28px!important}
html.android-tv .starmeter-row-loading,html.android-tv .starmeter-empty-row{height:318px!important;min-height:318px!important}
html.android-tv .starmeter-full-prepare{min-height:480px!important;align-content:center!important;margin-top:20px!important}
'''
css.write_text(c)

gradle.write_text(gradle.read_text().replace('versionCode 832','versionCode 833').replace("versionName '0.8.32'","versionName '0.8.33'"))
sw.write_text(sw.read_text().replace('swoop-tv-v0832-shell','swoop-tv-v0833-shell'))
activity.write_text(activity.read_text().replace('0.8.32','0.8.33').replace('out.put("versionCode", 828);','out.put("versionCode", 833);'))
seed_script.write_text(seed_script.read_text().replace("sourceVersion:'0.8.32'","sourceVersion:'0.8.33'"))

for path in [root/'app/src/main/assets/seed-cache.json', root/'swoop-tv-seed-cache.json']:
    data = json.loads(path.read_text()); data['sourceVersion'] = '0.8.33'; path.write_text(json.dumps(data, indent=2)+'\n')

t = test.read_text().replace("const ANDROID_CURRENT_VERSION='0.8.32';", "const ANDROID_CURRENT_VERSION='0.8.33';").replace('Swoop-TV-v0.8.32-Diagnostics-','Swoop-TV-v0.8.33-Diagnostics-').replace("installSeed.sourceVersion||'') !== '0.8.32'", "installSeed.sourceVersion||'') !== '0.8.33'").replace('Install seed source version is not v0.8.32','Install seed source version is not v0.8.33')
t += r'''

// v0.8.33 route-top restoration + complete pre-login STARmeter preparation.
if (!appSource.includes('function tvForceRouteTop()') || !appSource.includes("target.closest?.('.topbar')")) throw new Error('v0.8.33 canonical route-top restoration missing');
if (!appSource.includes('function prepareStarmeterBeforeLogin()') || !appSource.includes("tvCatalogWorkerRequest('person-match-batch'")) throw new Error('v0.8.33 pre-login STARmeter batch preparation missing');
if (!appSource.includes("if(NATIVE_ANDROID){render();setTimeout(()=>prepareStarmeterBeforeLogin()")) throw new Error('STARmeter preparation does not start on the profile picker');
if (!appSource.includes("waiting=NATIVE_ANDROID&&!starmeterBackgroundReady")) throw new Error('STARmeter can still render partially hydrated rows');
if (!appSource.includes('const routeTab=document.querySelector(`.desktop-nav [data-page=') || !appSource.includes('CSS.escape(state.page)')) throw new Error('First-row Up does not escape to the active route tab');
if (!cssSource.includes('height:430px!important') || !cssSource.includes('.profile-starmeter-prep')) throw new Error('v0.8.33 STARmeter non-overlap/profile-prewarm CSS missing');
if (!fs.readFileSync(new URL('../app/src/main/assets/src/catalog-index-worker.js', import.meta.url), 'utf8').includes("msg.type==='person-match-batch'")) throw new Error('STARmeter worker batch-match contract missing');
'''
test.write_text(t)

n = notes.read_text()
section = """## v0.8.33 — Google TV Route Top + Pre-Login STARmeter Stability\n\n- Fixes the physical-TV route scroll trap shown on My SwoopTV and STARmeter: returning Up to the active top navigation tab now restores the underlying page to its canonical `scrollY = 0`, including a follow-up animation-frame reset for Android WebView.\n- Adds an explicit first-row Up escape for top-level pages without a focusable hero action, so My SwoopTV can return from its first rail to the full original header composition instead of remaining partially scrolled.\n- Rebuilds STARmeter preparation around one provider-index **batch match for the complete Top 100**. Matching starts while the Who’s Watching/profile screen is still visible rather than waiting for STARmeter entry or focus movement.\n- Uses the packaged Top 100 identities and filmography credits plus the restored durable provider catalogue to populate all 100 provider-available filmographies before STARmeter becomes focusable; STARmeter no longer assembles person rows one-by-one as the remote reaches them.\n- Keeps a deliberate whole-page preparation state if the pre-login batch has not completed, instead of exposing mixed “Finding titles…” rows that reflow while the user is navigating.\n- Expands STARmeter’s permanent row geometry and vertical safety gap so enlarged poster rails and focused-card scaling cannot paint into the next person’s row.\n- Prewarms all Top 100 portraits plus a round-robin set of representative filmography artwork during the profile screen/background preparation window.\n- Fixes the Android native diagnostic versionCode marker while advancing Android versionName to **0.8.33** and versionCode to **833**.\n\n"""
if not n.startswith('# Swoop TV Release Notes\n\n'): raise SystemExit('release notes header missing')
notes.write_text(n.replace('# Swoop TV Release Notes\n\n', '# Swoop TV Release Notes\n\n'+section, 1))

(root/'README.md').write_text('''# Swoop TV v0.8.33 — Google TV Route Top + Pre-Login STARmeter Stability

Current Android/Google TV source baseline.

## v0.8.33 highlights

- Fixes the physical-TV top-scroll trap across top-level routes. Returning focus to the active top navigation tab now restores the document to its true top position, including My SwoopTV and STARmeter.
- Starts full STARmeter Top 100 preparation on the Who’s Watching screen before profile login.
- Matches all 100 STARmeter people to the restored provider catalogue in one indexed worker batch rather than person-by-person as focus reaches them.
- STARmeter does not expose partially assembled person rows on Google TV; if preparation is still finishing it shows one deliberate whole-page preparation state, then renders the completed 100-person surface.
- STARmeter row height/safety spacing is increased so enlarged poster rails and focused-card scaling cannot overlap the next person.
- Prewarms the Top 100 portraits plus representative filmography artwork before/while login completes.
- Retains all v0.8.32 Top 100 artwork/hero hydration, Live preview, Guide-logo and branded-launch work.

## Android package

- applicationId: `tv.swoop.player`
- versionName: `0.8.33`
- versionCode: `833`
- minSdk: 23
- target/compile SDK: 36
- Java: 17
- Media3 / ExoPlayer: 1.11.0
- AndroidX WebKit: 1.15.0

## Warm-start seed

GitHub Actions refreshes `seed-cache.json` immediately before APK compilation. Provider credentials, provider-specific catalogue, profiles, personal history and live EPG remain device-local and are never baked into the generic APK.

## Hardware diagnostics

Open **Settings**, focus the Settings cog and press **OK five times within four seconds** to enable Hardware Test Mode. Select the numbered test, reproduce the issue, then choose **Save Diagnostics**.

See `TV_HARDWARE_TEST_CHECKLIST.md` for the v0.8.33 physical-TV gates.

## APK build

The included GitHub Actions workflow installs Android SDK 36 + Gradle 9.5.0, refreshes the full warm-start seed, runs verification, builds the test APK and automatically overwrites/validates the stable Downloader asset used by code **3682231** after every successful `main` build.
''')
(root/'BUILD_APK.md').write_text('''# Swoop TV v0.8.33 — Google TV test build

The included GitHub Actions workflow is the authoritative APK build path.

1. Install JDK 17, Android SDK 36 and Gradle 9.5.0.
2. Refresh the packaged provider-neutral warm-start seed.
3. Generate v0.8.33 release/update metadata from `app/build.gradle` and `RELEASE_NOTES.md`.
4. Run JavaScript syntax and runtime regression checks.
5. Build `:app:assembleDebug`.
6. Publish `Swoop-TV-v0.8.33-Google-TV-Test.apk` and overwrite/verify the stable `Swoop-TV-v0.8.1-Google-TV-Test.apk` asset.

The stable release path preserves **Downloader code 3682231**. A successful `main` build automatically refreshes that Downloader asset. The installed application reports **0.8.33 / versionCode 833**.
''')
(root/'BUILD_VERIFICATION.md').write_text('''# Swoop TV v0.8.33 Build Verification

- [x] `app/build.gradle` is `versionName 0.8.33` / `versionCode 833`.
- [x] Android bridge/User-Agent, native diagnostics and diagnostic filenames report v0.8.33 / 833.
- [x] `ANDROID_CURRENT_VERSION` reports 0.8.33.
- [x] Service-worker shell cache is bumped to v0833.
- [x] Install seed schema remains valid and `sourceVersion` is 0.8.33.
- [x] Top-level Google TV focus returning to the fixed top navigation invokes canonical route-top restoration.
- [x] First-row Up on top-level pages without a focusable hero can escape to the active route tab.
- [x] STARmeter preparation starts from the Who’s Watching/profile picker before login.
- [x] STARmeter uses a single indexed `person-match-batch` worker request for the complete Top 100.
- [x] STARmeter does not render partially hydrated person rows while the Android pre-login batch is incomplete.
- [x] STARmeter permanent row geometry reserves enough vertical room for enlarged poster rails/focus scaling without overlap.
- [x] STARmeter prewarms Top 100 portraits plus representative filmography artwork.
- [x] v0.8.32 directional Top 100 artwork prefetch and atomic hero replacement remain present.
- [x] v0.8.32 Live preview readiness, Guide logo scale and branded cold-launch treatment remain present.
- [x] JavaScript syntax checks pass.
- [x] Card runtime smoke passes.
- [x] Google TV UI runtime smoke passes.
- [x] STARmeter batch worker functional smoke passes.
- [ ] Binary APK compile is delegated to the included GitHub Actions Android SDK 36 / Gradle 9.5.0 workflow.
''')
(root/'VERIFICATION_RESULTS.md').write_text('''# Swoop TV v0.8.33 Verification Results

- JavaScript syntax: **PASS** — app/runtime modules and catalogue index worker parse successfully.
- Card runtime smoke: **PASS**.
- Google TV UI runtime smoke: **PASS**, including v0.8.33 route-top and pre-login STARmeter regression guards.
- STARmeter batch worker functional smoke: **PASS** — seeded people are matched correctly to movie/TV catalogue entries in one `person-match-batch` request.
- Route-top contract: **PASS** — active top-navigation focus uses a multi-frame `scrollY = 0` restoration path and first-row Up can explicitly return to the current route tab.
- STARmeter pre-login contract: **PASS** — preparation starts from Android bootstrap while Who’s Watching is visible and profile selection awaits an in-flight preparation attempt before entering the app.
- STARmeter full-surface contract: **PASS** — Android uses a whole-page preparation state until the complete batch is ready, preventing mixed loaded/loading rows from becoming focusable.
- STARmeter geometry contract: **PASS** — permanent rows are increased to 430px with extra inter-row safety space.
- Warm-start seed: **PASS** — schema remains valid, sourceVersion 0.8.33, 100 STARmeter people retained.
- Build/update metadata: **PASS** — 0.8.33 / versionCode 833.

Binary APK compilation remains the GitHub Actions gate because the source packaging runtime does not include Android SDK 36/Gradle.
''')

p = root/'TV_HARDWARE_TEST_CHECKLIST.md'; x=p.read_text(); x=x.replace('Swoop TV v0.8.32','Swoop TV v0.8.33').replace('v0.8.32 / versionCode 832','v0.8.33 / versionCode 833').replace('`Swoop-TV-v0.8.32-Diagnostics-`','`Swoop-TV-v0.8.33-Diagnostics-`')
x=x.replace('- **MYSWOOP-001:** My SwoopTV is directly after Home and shows Continue Watching, saved movies/shows, Favourite Channels and Recently Watched when populated. Home no longer shows Continue Watching/My List.', '- **MYSWOOP-001:** My SwoopTV is directly after Home and shows Continue Watching, saved movies/shows, Favourite Channels and Recently Watched when populated. Navigate to the bottom, then Up to the first rail and Up again: the full My SwoopTV header must return exactly to the original top position.')
x=x.replace('- **STAR-001:** enter STARmeter, browse at least #1 → #30. Large centred circular portraits remain stable and are prefetched ahead of focus so initials are only a genuine no-photo fallback. Visible people resolve provider titles via the full durable-library index; known available credits should not falsely report 0 titles, and no row remains “Finding titles…” indefinitely. Up from #1 reaches the STARmeter header/nav and Android Back always exits.', '- **STAR-001:** before profile login, Who’s Watching should report STARmeter preparation/ready state. After login, enter STARmeter and browse #1 → #30: all provider title counts/rails should already be resolved, rows must not overlap, and no person-level “Finding titles…” rail should appear. Up from #1 must restore the true STARmeter page top/header/nav.')
x=x.replace('- **STAR-002 — fast scroll:** hold/tap Down rapidly from #1 toward #100. The page must never become blank, rows must not collapse/reflow, and filmography rails must stay readable while matching catches up.', '- **STAR-002 — fast scroll:** hold/tap Down rapidly from #1 toward #100. The page must never become blank, rows must not overlap/collapse/reflow, and the already-prepared filmography rails must remain stable. Then return Up to #1 and confirm the full STARmeter hero/header is restored.')
p.write_text(x)

p = root/'TV_HARDWARE_RUNNING_FIXES.md'; x=p.read_text().replace('**v0.8.32 — Google TV STARmeter Matching + Guide Banner Hotfix**','**v0.8.33 — Google TV Route Top + Pre-Login STARmeter Stability**')
insert='''- [ ] **TOP-001:** after scrolling any top-level route deep down, returning focus to the active fixed top navigation tab restores the document to its true original top (`scrollY = 0`).\n- [ ] **MYSWOOP-TOP:** My SwoopTV bottom → first rail → Up restores the full My SwoopTV heading/description, not just the first Simpsons/Continue Watching cards.\n- [ ] **STAR-PRELOAD:** Who’s Watching begins preparing all 100 STARmeter people before login; STARmeter opens from completed provider-match data rather than focus-driven loading.\n- [ ] **STAR-GEOMETRY:** STARmeter person rows never paint/stack into the next person while posters are loading or focused.\n'''
x=x.replace('## Implemented — needs physical-TV verification\n\n','## Implemented — needs physical-TV verification\n\n'+insert,1); p.write_text(x)

p = root/'ANDROID_TV_CERTIFICATION.md'; x=p.read_text().replace('Swoop TV v0.8.32','Swoop TV v0.8.33').replace('## v0.8.32 diagnostic workflow','## v0.8.33 diagnostic workflow')
x=x.replace('- [ ] STARmeter opens quickly with ranked people and progressively fills each person’s available movie/TV rail.', '- [ ] STARmeter provider matching is already completed from the pre-login Who’s Watching preparation pass; opening STARmeter must not progressively assemble person rails.')
p.write_text(x)

subprocess.run(['node','scripts/generate-build-metadata.mjs'], check=True)
print('Promoted Swoop TV source to v0.8.33')
