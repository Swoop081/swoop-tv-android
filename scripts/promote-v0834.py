from pathlib import Path
import json, subprocess

root=Path.cwd()
app=root/'app/src/main/assets/app.js'
gradle=root/'app/build.gradle'
activity=root/'app/src/main/java/tv/swoop/player/MainActivity.java'
seed_script=root/'scripts/refresh-seed-cache.mjs'
test=root/'tests/tv-ui-runtime-smoke.mjs'
workflow=root/'.github/workflows/android-tv-apk.yml'

current=gradle.read_text()
if "versionName '0.8.34'" in current and "const ANDROID_CURRENT_VERSION='0.8.34';" in app.read_text():
    print('v0.8.34 source promotion already applied')
    raise SystemExit(0)
if "versionName '0.8.33'" not in current:
    raise SystemExit('v0.8.34 promotion expected the v0.8.33 source baseline')

s=app.read_text()
s=s.replace("const ANDROID_CURRENT_VERSION='0.8.33';","const ANDROID_CURRENT_VERSION='0.8.34';")
s=s.replace("  'Restores every main Google TV route to its true top position when D-pad focus returns to the selected top navigation tab.',\n  'Prepares the full STARmeter Top 100 against the connected provider catalogue before profile login using one indexed batch match instead of focus-driven person jobs.',\n  'Keeps STARmeter rows in permanent non-overlapping TV geometry and renders the page only from completed provider-match results.',\n  'Prewarms STARmeter portraits and representative filmography artwork while the Who’s Watching screen is still visible.'",
"  'Fixes the STARmeter 28% startup failure by splitting provider matching into smaller indexed worker batches instead of one all-100 request.',\n  'STARmeter preparation is now best-effort and fail-open: profile login and the STARmeter page can never be trapped behind a failed background batch.',\n  'Completed STARmeter people are cached incrementally, while unfinished people continue matching from visible-row hydration and scheduled background retries.',\n  'Retains v0.8.33 route-top restoration, permanent STARmeter row geometry and pre-login portrait/artwork warming.'")
s=s.replace("let starmeterBackgroundPreparePromise=null,starmeterBackgroundReady=false,starmeterBackgroundProgress=0,starmeterBackgroundStatus='Preparing STARmeter…',starmeterPreparedProviderSignature='';",
"let starmeterBackgroundPreparePromise=null,starmeterBackgroundReady=false,starmeterBackgroundComplete=false,starmeterBackgroundProgress=0,starmeterBackgroundStatus='Preparing STARmeter…',starmeterPreparedProviderSignature='',starmeterBackgroundRetryTimer=null;\nconst STARMETER_PRELOGIN_BATCH_SIZE=12;")
s=s.replace("  if(NATIVE_ANDROID&&!starmeterBackgroundReady)await prepareStarmeterBeforeLogin().catch(()=>false);",
"  if(NATIVE_ANDROID&&!starmeterBackgroundComplete)void prepareStarmeterBeforeLogin().catch(()=>false);")
old="""function patchProfileStarmeterPrep(){
  if(!NATIVE_ANDROID||!profilePickerOpen)return;const el=document.querySelector('[data-profile-starmeter-prep]');if(!el)return;
  el.classList.toggle('ready',starmeterBackgroundReady);const value=el.querySelector('span'),copy=el.querySelector('strong');
  if(value)value.textContent=starmeterBackgroundReady?'✓':`${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%`;
  if(copy)copy.textContent=starmeterBackgroundReady?'STARmeter Top 100 ready':starmeterBackgroundStatus;
}
"""
new="""function patchProfileStarmeterPrep(){
  if(!NATIVE_ANDROID||!profilePickerOpen)return;const el=document.querySelector('[data-profile-starmeter-prep]');if(!el)return;
  el.classList.toggle('ready',starmeterBackgroundComplete);const value=el.querySelector('span'),copy=el.querySelector('strong');
  if(value)value.textContent=starmeterBackgroundComplete?'✓':`${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%`;
  if(copy)copy.textContent=starmeterBackgroundComplete?'STARmeter Top 100 ready':starmeterBackgroundStatus;
}
"""
if old not in s: raise SystemExit('profile STARmeter prep block not found')
s=s.replace(old,new)
start=s.index('async function prepareStarmeterBeforeLogin(){')
end=s.index('function starmeterPersonSeed',start)
new_func="""function scheduleStarmeterBackgroundRetry(delay=5000){
  if(!NATIVE_ANDROID||starmeterBackgroundComplete||starmeterBackgroundRetryTimer)return;
  starmeterBackgroundRetryTimer=setTimeout(()=>{starmeterBackgroundRetryTimer=null;prepareStarmeterBeforeLogin().catch(()=>false)},Math.max(1500,Number(delay||5000)));
}
function applyPreparedStarmeterResults(people=[],results=[]){
  const byKey=new Map(people.map(row=>[row.key,row]));let applied=0;
  for(const row of results){const source=byKey.get(row?.key);if(!source)continue;const value={person:source.person,movies:Array.isArray(row.movies)?sortPersonLibraryItems(row.movies):[],shows:Array.isArray(row.shows)?sortPersonLibraryItems(row.shows):[],loadedAt:Date.now(),prelogin:true};starmeterPersonCache.set(row.key,value);starmeterHotCache.set(row.key,{...(starmeterHotCache.get(row.key)||{}),...value});personLibraryCache.set(`${value.person.id||''}|${String(value.person.name||'').toLowerCase()}`,value);applied++}
  return applied;
}
async function prepareStarmeterBeforeLogin(){
  if(!NATIVE_ANDROID)return false;
  const currentSignature=starmeterProviderSignature();
  if(starmeterBackgroundComplete&&currentSignature&&currentSignature===starmeterPreparedProviderSignature)return true;
  if(starmeterBackgroundPreparePromise)return starmeterBackgroundPreparePromise;
  starmeterBackgroundPreparePromise=(async()=>{
    let matched=0,total=0;
    try{
      setStarmeterBackgroundProgress(4,'Preparing STARmeter Top 100…');
      await ensureStarmeterLoaded();if(!starmeterPeople.length)throw new Error('STARmeter list unavailable');
      setStarmeterBackgroundProgress(10,'Restoring your provider catalogue…');
      if(!state.catalog.length||tvHomeSnapshotActive)await ensureDurableLibraryRestored().catch(()=>false);
      if(!state.catalog.length){starmeterBackgroundReady=true;starmeterBackgroundComplete=false;setStarmeterBackgroundProgress(100,'STARmeter is ready and will match titles after a provider is connected.');return false}
      setStarmeterBackgroundProgress(18,'Indexing your connected movies and TV shows…');
      const workerReady=await ensureTvCatalogWorkerReady(18000);if(!workerReady)throw new Error('Provider availability index unavailable');
      const people=starmeterPeople.map(entry=>{const key=starmeterNormalize(entry.name),hot=starmeterHotCache.get(key),person=hot?.person||starmeterPersonSeed(entry),credits=Array.isArray(hot?.credits)?hot.credits:[];return {key,rank:Number(entry.rank||0),person,moviePayload:personCreditPayload(credits,'movie'),showPayload:personCreditPayload(credits,'series')}});total=people.length;
      starmeterBackgroundReady=true;starmeterBackgroundComplete=false;
      setStarmeterBackgroundProgress(28,'Matching STARmeter people to your providers…');
      for(let offset=0;offset<people.length;offset+=STARMETER_PRELOGIN_BATCH_SIZE){
        const chunk=people.slice(offset,offset+STARMETER_PRELOGIN_BATCH_SIZE),batch=await tvCatalogWorkerRequest('person-match-batch',{people:chunk},12000),results=Array.isArray(batch?.results)?batch.results:[];
        const applied=applyPreparedStarmeterResults(chunk,results);matched+=applied;
        setStarmeterBackgroundProgress(28+(matched/Math.max(1,total))*62,`Matched ${matched} of ${total} STARmeter people…`);
        if(applied!==chunk.length)throw new Error(`STARmeter background match paused at ${matched} of ${total}`);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      starmeterBackgroundComplete=true;starmeterPreparedProviderSignature=starmeterProviderSignature();setStarmeterBackgroundProgress(100,'STARmeter Top 100 ready');prewarmPreparedStarmeterArtwork();
      if(state.page==='starmeter'&&!profilePickerOpen&&!detailItem&&!personView)render();return true;
    }catch(err){
      starmeterBackgroundReady=true;starmeterBackgroundComplete=false;starmeterPreparedProviderSignature='';
      const count=Math.max(matched,[...starmeterPeople].filter(entry=>starmeterPersonCache.has(starmeterNormalize(entry.name))).length),denom=Math.max(1,total||starmeterPeople.length||100);
      setStarmeterBackgroundProgress(Math.max(starmeterBackgroundProgress,28+(count/denom)*62),count?`STARmeter is usable now · ${count} of ${denom} pre-matched; finishing in background.`:'STARmeter is usable now · provider matching will retry in the background.');
      if(state.page==='starmeter'&&!profilePickerOpen&&!detailItem&&!personView)render();scheduleStarmeterBackgroundRetry(5000);return false;
    }finally{starmeterBackgroundPreparePromise=null}
  })();
  return starmeterBackgroundPreparePromise;
}
"""
s=s[:start]+new_func+s[end:]
old_page="""function starmeterPage(){
  const visible=starmeterPeople.slice(0,100),waiting=NATIVE_ANDROID&&!starmeterBackgroundReady;
  const body=waiting?`<div class=\"starmeter-page-loading starmeter-full-prepare\"><span class=\"provider-spinner\"></span><strong>${esc(starmeterBackgroundStatus||'Preparing the complete STARmeter Top 100…')}</strong><small>${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}% · Swoop TV is matching all people before the page becomes focusable.</small></div>`:visible.length?visible.map(starmeterPersonSection).join(''):starmeterError?`<div class=\"starmeter-error\"><h2>STARmeter unavailable</h2><p>${esc(starmeterError)}</p><button class=\"btn secondary\" data-starmeter-retry>Try again</button></div>`:`<div class=\"starmeter-page-loading\"><span class=\"provider-spinner\"></span><strong>Loading IMDb STARmeter Top 100…</strong><small>Preparing the people viewers are searching for now.</small></div>`;
"""
new_page="""function starmeterPage(){
  const visible=starmeterPeople.slice(0,100);
  const body=visible.length?visible.map(starmeterPersonSection).join(''):starmeterError?`<div class=\"starmeter-error\"><h2>STARmeter unavailable</h2><p>${esc(starmeterError)}</p><button class=\"btn secondary\" data-starmeter-retry>Try again</button></div>`:`<div class=\"starmeter-page-loading\"><span class=\"provider-spinner\"></span><strong>Loading IMDb STARmeter Top 100…</strong><small>Preparing the people viewers are searching for now.</small></div>`;
"""
if old_page not in s: raise SystemExit('STARmeter page gate block not found')
s=s.replace(old_page,new_page)
s=s.replace('versionCode:833,changes:[...ANDROID_CURRENT_CHANGELOG]','versionCode:834,changes:[...ANDROID_CURRENT_CHANGELOG]')
app.write_text(s)

gradle.write_text(gradle.read_text().replace('versionCode 833','versionCode 834').replace("versionName '0.8.33'","versionName '0.8.34'"))
activity.write_text(activity.read_text().replace('0.8.33','0.8.34').replace('out.put("versionCode", 833);','out.put("versionCode", 834);'))
seed_script.write_text(seed_script.read_text().replace("sourceVersion:'0.8.33'","sourceVersion:'0.8.34'"))
for name in ['app/src/main/assets/seed-cache.json','swoop-tv-seed-cache.json']:
    path=root/name; data=json.loads(path.read_text()); data['sourceVersion']='0.8.34'; path.write_text(json.dumps(data,indent=2)+'\n')

s=test.read_text().replace("const ANDROID_CURRENT_VERSION='0.8.33';","const ANDROID_CURRENT_VERSION='0.8.34';").replace('Swoop-TV-v0.8.33-Diagnostics-','Swoop-TV-v0.8.34-Diagnostics-').replace("installSeed.sourceVersion||'') !== '0.8.33'","installSeed.sourceVersion||'') !== '0.8.34'").replace('Install seed source version is not v0.8.33','Install seed source version is not v0.8.34')
s=s.replace("if (!appSource.includes(\"waiting=NATIVE_ANDROID&&!starmeterBackgroundReady\")) throw new Error('STARmeter can still render partially hydrated rows');\n",'')
if '// v0.8.34 STARmeter fail-open chunked pre-login matching hotfix.' not in s:
    s += """\n// v0.8.34 STARmeter fail-open chunked pre-login matching hotfix.\nif (!appSource.includes('const STARMETER_PRELOGIN_BATCH_SIZE=12')) throw new Error('v0.8.34 STARmeter chunk size missing');\nif (!appSource.includes('offset+=STARMETER_PRELOGIN_BATCH_SIZE') || !appSource.includes(\"tvCatalogWorkerRequest('person-match-batch',{people:chunk},12000)\")) throw new Error('v0.8.34 chunked STARmeter matching missing');\nif (appSource.includes(\"tvCatalogWorkerRequest('person-match-batch',{people},24000)\")) throw new Error('All-100 STARmeter worker request regression returned');\nif (!appSource.includes('void prepareStarmeterBeforeLogin().catch(()=>false)')) throw new Error('Profile selection still blocks on STARmeter preparation');\nif (!appSource.includes(\"STARmeter is usable now · provider matching will retry in the background.\")) throw new Error('STARmeter fail-open recovery state missing');\nif (!appSource.includes('const body=visible.length?visible.map(starmeterPersonSection).join')) throw new Error('STARmeter page is still hard-gated by background matching');\n"""
test.write_text(s)

notes=root/'RELEASE_NOTES.md'; s=notes.read_text(); section='''## v0.8.34 — STARmeter Fail-Open Batch Recovery Hotfix\n\n- Fixes the physical-TV STARmeter startup failure captured at **28%** where the v0.8.33 all-100 provider-match request could exceed its 24-second worker deadline and leave the whole page permanently blocked behind “STARmeter batch match did not complete.”\n- Replaces the single 100-person request with **12-person indexed worker batches**. Each completed batch is committed immediately to the in-memory STARmeter/provider cache instead of discarding all progress if a later batch is slow.\n- Makes profile selection non-blocking: Who’s Watching still starts STARmeter preparation before login, but selecting a profile never waits for STARmeter matching to finish.\n- Makes the STARmeter route **fail-open**. The fixed 100-person surface remains navigable even if background preparation is incomplete; unmatched rows use the existing bounded visible-row hydration path and fill in without replacing/reflowing the page.\n- A timed-out/partial pre-match now reports a usable background state, schedules an automatic retry, and can never strand the viewer on a full-page loading/error gate.\n- Retains v0.8.33 route-top restoration and permanent non-overlapping STARmeter row geometry.\n- Android versionName is **0.8.34** and versionCode is **834**.\n\n'''
if '## v0.8.34' not in s: s=s.replace('# Swoop TV Release Notes\n\n','# Swoop TV Release Notes\n\n'+section,1)
notes.write_text(s)

readme=root/'README.md'; s=readme.read_text(); idx=s.index('## Android package'); s='''# Swoop TV v0.8.34 — STARmeter Fail-Open Batch Recovery Hotfix\n\nCurrent Android/Google TV source baseline.\n\n## v0.8.34 highlights\n\n- Fixes the v0.8.33 physical-TV STARmeter failure captured at 28%.\n- Replaces one all-100 provider match with 12-person indexed worker batches and commits each completed batch immediately.\n- Keeps pre-login STARmeter warming, but profile selection no longer waits for it.\n- Removes the full-page STARmeter completion gate: the 100-person page remains navigable and unfinished rows hydrate safely in place.\n- Partial/time-out preparation automatically retries in the background instead of trapping focus behind an error loader.\n- Retains v0.8.33 route-top restoration, fixed row geometry, portrait prewarming and all v0.8.32 performance work.\n\n'''+s[idx:]
s=s.replace('versionName: `0.8.33`','versionName: `0.8.34`').replace('versionCode: `833`','versionCode: `834`').replace('v0.8.33 physical-TV gates','v0.8.34 physical-TV gates'); readme.write_text(s)

running=root/'TV_HARDWARE_RUNNING_FIXES.md'; s=running.read_text().replace('**v0.8.33 — Google TV Route Top + Pre-Login STARmeter Stability**','**v0.8.34 — STARmeter Fail-Open Batch Recovery Hotfix**',1); needle='## Implemented — needs physical-TV verification\n\n'; extra='- [ ] **STAR-STARTUP-001:** STARmeter can no longer stop at 28% with “batch match did not complete”; profile selection remains immediate and STARmeter opens to a usable 100-person surface even while background matching continues.\n- [ ] **STAR-BATCH-001:** pre-login provider matching progresses in small batches, preserves completed people if a later batch is slow, and automatically retries unfinished work.\n'; s=s.replace(needle,needle+extra,1); running.write_text(s)

check=root/'TV_HARDWARE_TEST_CHECKLIST.md'; check.write_text(check.read_text().replace('v0.8.33','v0.8.34').replace('versionCode 833','versionCode 834'))
for name in ['BUILD_APK.md','BUILD_VERIFICATION.md','VERIFICATION_RESULTS.md','ANDROID_TV_CERTIFICATION.md']:
    path=root/name
    if path.exists(): path.write_text(path.read_text().replace('0.8.33','0.8.34').replace('versionCode 833','versionCode 834').replace('/ 833','/ 834'))

w=workflow.read_text()
marker_start='      - name: Promote v0.8.34 STARmeter fail-open hotfix\n'
if marker_start in w:
    start=w.index(marker_start)
    end=w.index('      - name: Set up JDK 17\n',start)
    w=w[:start]+w[end:]
w=w.replace('--target "$GITHUB_SHA"','--target "$(git rev-parse HEAD)"')
workflow.write_text(w)

subprocess.run(['node','scripts/generate-build-metadata.mjs'],check=True)
subprocess.run(['node','--check','app/src/main/assets/app.js'],check=True)
subprocess.run(['node','tests/card-runtime-smoke.mjs'],check=True)
subprocess.run(['node','tests/tv-ui-runtime-smoke.mjs'],check=True)
subprocess.run(['python','-m','json.tool','app/src/main/assets/seed-cache.json'],stdout=subprocess.DEVNULL,check=True)
subprocess.run(['python','-m','json.tool','swoop-tv-seed-cache.json'],stdout=subprocess.DEVNULL,check=True)

Path(__file__).unlink()
print('v0.8.34 promotion applied and verified')
