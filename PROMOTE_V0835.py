from pathlib import Path
import re
r=Path.cwd()
def txt(p): return (r/p).read_text()
def put(p,s): (r/p).write_text(s)
def sub(p,a,b,n=1):
 s=txt(p)
 if a not in s: raise RuntimeError(f'missing marker {p}: {a[:60]}')
 put(p,s.replace(a,b,n))

# version markers
sub('app/build.gradle','versionCode 834','versionCode 835')
sub('app/build.gradle',"versionName '0.8.34'","versionName '0.8.35'")
p='app/src/main/java/tv/swoop/player/MainActivity.java'; put(p,txt(p).replace('0.8.34','0.8.35').replace('"versionCode", 834','"versionCode", 835'))
sub('app/src/main/assets/sw.js','swoop-tv-v0833-shell','swoop-tv-v0835-shell')
for p in ['app/src/main/assets/seed-cache.json','swoop-tv-seed-cache.json']:
 put(p,txt(p).replace('"sourceVersion": "0.8.34"','"sourceVersion": "0.8.35"'))

p='app/src/main/assets/app.js'; s=txt(p)
s=s.replace("const ANDROID_CURRENT_VERSION='0.8.34';","const ANDROID_CURRENT_VERSION='0.8.35';",1).replace('versionCode:834,changes:[...ANDROID_CURRENT_CHANGELOG]','versionCode:835,changes:[...ANDROID_CURRENT_CHANGELOG]',1)
a="""const ANDROID_CURRENT_CHANGELOG=[
  'Fixes the STARmeter 28% startup failure by splitting provider matching into smaller indexed worker batches instead of one all-100 request.',
  'STARmeter preparation is now best-effort and fail-open: profile login and the STARmeter page can never be trapped behind a failed background batch.',
  'Completed STARmeter people are cached incrementally, while unfinished people continue matching from visible-row hydration and scheduled background retries.',
  'Retains v0.8.33 route-top restoration, permanent STARmeter row geometry and pre-login portrait/artwork warming.'
];"""
b="""const ANDROID_CURRENT_CHANGELOG=[
  'Fixes the physical-TV STARmeter duplicate/ghost row rendering seen while rapidly navigating the Top 100.',
  'Keeps each STARmeter person identity column permanently mounted and only updates provider-title content after D-pad focus has settled.',
  'Defers async STARmeter row/portrait patches while a row is focused and removes full-page rerenders when background matching finishes or retries.',
  'Adds paint containment and vertical clipping to stop Android WebView compositor trails while retaining v0.8.34 fail-open matching.'
];"""
if a not in s: raise RuntimeError('changelog marker missing')
s=s.replace(a,b,1)
a="""const starmeterPersonCache=new Map(),starmeterHotCache=new Map(),starmeterHydratePending=new Map(),starmeterRetryCounts=new Map();
const starmeterHydrateQueue=[];let starmeterHydrateBusy=0,starmeterGeneration=0;
let starmeterBackgroundPreparePromise=null,starmeterBackgroundReady=false,starmeterBackgroundComplete=false,starmeterBackgroundProgress=0,starmeterBackgroundStatus='Preparing STARmeter…',starmeterPreparedProviderSignature='',starmeterBackgroundRetryTimer=null;
const STARMETER_PRELOGIN_BATCH_SIZE=12;"""
b="""const starmeterPersonCache=new Map(),starmeterHotCache=new Map(),starmeterHydratePending=new Map(),starmeterRetryCounts=new Map();
const starmeterHydrateQueue=[];let starmeterHydrateBusy=0,starmeterGeneration=0;
const starmeterDeferredPatches=new Set(),starmeterDeferredIdentityPatches=new Map();let starmeterPatchTimer=null,starmeterLastFocusMoveAt=0;
let starmeterBackgroundPreparePromise=null,starmeterBackgroundReady=false,starmeterBackgroundComplete=false,starmeterBackgroundProgress=0,starmeterBackgroundStatus='Preparing STARmeter…',starmeterPreparedProviderSignature='',starmeterBackgroundRetryTimer=null;
const STARMETER_PRELOGIN_BATCH_SIZE=12;"""
if a not in s: raise RuntimeError('state marker missing')
s=s.replace(a,b,1)
s=s.replace("function cancelStarmeterWork(){starmeterGeneration++;starmeterHydrateQueue.length=0;starmeterHydrateBusy=0;starmeterObserver?.disconnect?.();starmeterObserver=null;starmeterAutoLoadObserver?.disconnect?.();starmeterAutoLoadObserver=null;}","function cancelStarmeterWork(){starmeterGeneration++;starmeterHydrateQueue.length=0;starmeterHydrateBusy=0;starmeterObserver?.disconnect?.();starmeterObserver=null;starmeterAutoLoadObserver?.disconnect?.();starmeterAutoLoadObserver=null;clearTimeout(starmeterPatchTimer);starmeterPatchTimer=null;starmeterDeferredPatches.clear();starmeterDeferredIdentityPatches.clear();}",1)
s=s.replace("personLibraryCache.set(`${value.person.id||''}|${String(value.person.name||'').toLowerCase()}`,value);applied++}","personLibraryCache.set(`${value.person.id||''}|${String(value.person.name||'').toLowerCase()}`,value);if(state.page==='starmeter')scheduleStarmeterPersonPatch(source.rank);applied++}",1)
s=s.replace("      if(state.page==='starmeter'&&!profilePickerOpen&&!detailItem&&!personView)render();return true;","      return true;",1).replace("      if(state.page==='starmeter'&&!profilePickerOpen&&!detailItem&&!personView)render();scheduleStarmeterBackgroundRetry(5000);return false;","      scheduleStarmeterBackgroundRetry(5000);return false;",1)
s=s.replace("personLibraryCache.set(`${value.person.id||''}|${String(value.person.name||entry.name).toLowerCase()}`,value);patchStarmeterPerson(entry.rank);return value;","personLibraryCache.set(`${value.person.id||''}|${String(value.person.name||entry.name).toLowerCase()}`,value);scheduleStarmeterPersonPatch(entry.rank);return value;",1).replace("starmeterPersonCache.set(key,value);patchStarmeterPerson(entry.rank);if(retryable&&!background)","starmeterPersonCache.set(key,value);scheduleStarmeterPersonPatch(entry.rank);if(retryable&&!background)",1)
s=s.replace("const key=starmeterNormalize(entry.name),cached=starmeterPersonCache.get(key),person=cached?.person||starmeterPersonSeed(entry),titles=starmeterPersonTitles(cached);","const key=starmeterNormalize(entry.name),cached=starmeterPersonCache.get(key),person=cached?.person||starmeterPersonSeed(entry),titles=starmeterPersonTitles(cached),renderKey=starmeterLibraryRenderKey(entry);",1).replace('<div class="starmeter-library-column"><div class="section-head">','<div class="starmeter-library-column" data-starmeter-render-key="${esc(renderKey)}"><div class="section-head">',1)
start=s.find('function patchStarmeterIdentity(rank,person={})'); end=s.find('function restoreFocusSignatureIn',start)
if start<0 or end<0: raise RuntimeError('patch markers missing')
block=r'''function starmeterSectionIsActive(section){return Boolean(section&&document.activeElement&&section.contains(document.activeElement))}
function patchStarmeterIdentityNow(rank,person={}){
  if(state.page!=='starmeter')return false;const section=document.querySelector(`[data-starmeter-rank="${Number(rank)}"]`);if(!section||starmeterSectionIsActive(section))return false;const cardEl=section.querySelector('.starmeter-person-card');if(!cardEl)return false;
  cardEl.dataset.personId=person.id||'';cardEl.dataset.personProfile=person.profile||'';cardEl.dataset.personDepartment=person.knownForDepartment||'Person';const nameEl=cardEl.querySelector('strong');if(nameEl&&person.name)nameEl.textContent=person.name;
  if(person.profile){const old=cardEl.querySelector('img,.starmeter-person-fallback');if(old?.tagName==='IMG'&&old.dataset.swoopArt===person.profile)return true;const fresh=document.createElement('img');fresh.alt=person.name||'';fresh.dataset.swoopArt=person.profile;old?.replaceWith(fresh);loadArtwork(fresh,{priority:'high'})}return true;
}
function patchStarmeterIdentity(rank,person={}){
  const value=Number(rank||0);if(!value)return false;const section=document.querySelector(`[data-starmeter-rank="${value}"]`);if(state.page!=='starmeter'||starmeterSectionIsActive(section)||performance.now()-starmeterLastFocusMoveAt<180){starmeterDeferredIdentityPatches.set(value,person);scheduleStarmeterPatchFlush();return false}return patchStarmeterIdentityNow(value,person);
}
function starmeterLibraryRenderKey(entry={}){
  const cached=starmeterPersonCache.get(starmeterNormalize(entry.name)),titles=starmeterPersonTitles(cached);return `${cached?'ready':'loading'}|${cached?.retryable?'retry':'done'}|${titles.length}|${titles.slice(0,STARMETER_TITLE_RENDER_LIMIT).map(x=>String(x?.id||x?._nativeSourceId||x?.name||'')).join(',')}`;
}
function patchStarmeterPersonNow(rank){
  if(state.page!=='starmeter'||detailItem||personView)return false;const entry=starmeterPeople.find(x=>Number(x.rank)===Number(rank)),section=document.querySelector(`[data-starmeter-rank="${Number(rank)}"]`);if(!entry||!section||starmeterSectionIsActive(section))return false;
  const oldLibrary=section.querySelector('.starmeter-library-column');if(!oldLibrary)return false;const renderKey=starmeterLibraryRenderKey(entry);if(oldLibrary.dataset.starmeterRenderKey===renderKey)return true;
  const wrap=document.createElement('div');wrap.innerHTML=starmeterPersonSection(entry);const newLibrary=wrap.firstElementChild?.querySelector('.starmeter-library-column');if(!newLibrary)return false;
  oldLibrary.replaceChildren(...[...newLibrary.childNodes]);oldLibrary.dataset.starmeterRenderKey=renderKey;hydrateArtwork(oldLibrary);hydrateVisibleImdbRatings(oldLibrary);bindDynamicCards(oldLibrary);return true;
}
function scheduleStarmeterPatchFlush(delay=180){if(starmeterPatchTimer||state.page!=='starmeter')return;starmeterPatchTimer=setTimeout(flushStarmeterDeferredPatches,Math.max(80,Number(delay||180)))}
function scheduleStarmeterPersonPatch(rank,delay=180){const value=Number(rank||0);if(!value||state.page!=='starmeter')return false;starmeterDeferredPatches.add(value);scheduleStarmeterPatchFlush(delay);return true}
function flushStarmeterDeferredPatches(){
  clearTimeout(starmeterPatchTimer);starmeterPatchTimer=null;if(state.page!=='starmeter'||detailItem||personView){starmeterDeferredPatches.clear();starmeterDeferredIdentityPatches.clear();return}
  if(performance.now()-starmeterLastFocusMoveAt<180){scheduleStarmeterPatchFlush(180);return}const activeRank=Number(document.activeElement?.closest?.('[data-starmeter-rank]')?.dataset?.starmeterRank||0);
  for(const [rank,person] of [...starmeterDeferredIdentityPatches]){if(rank===activeRank)continue;if(patchStarmeterIdentityNow(rank,person))starmeterDeferredIdentityPatches.delete(rank)}
  for(const rank of [...starmeterDeferredPatches]){if(rank===activeRank)continue;if(patchStarmeterPersonNow(rank))starmeterDeferredPatches.delete(rank)}
  if(starmeterDeferredPatches.size||starmeterDeferredIdentityPatches.size)scheduleStarmeterPatchFlush(220)
}
function patchStarmeterPerson(rank){return scheduleStarmeterPersonPatch(rank)}
'''
s=s[:start]+block+s[end:]
a="if(state.page==='starmeter'){const personSection=el.closest?.('[data-starmeter-rank]')"
b="if(state.page==='starmeter'){starmeterLastFocusMoveAt=performance.now();const personSection=el.closest?.('[data-starmeter-rank]')"
if a not in s: raise RuntimeError('focus marker missing')
s=s.replace(a,b,1)
s=s.replace("}}}\n    if(state.page==='guide')maybeAutoLoadGuideFromFocus(el);","}}if(starmeterDeferredPatches.size||starmeterDeferredIdentityPatches.size)scheduleStarmeterPatchFlush(220)}\n    if(state.page==='guide')maybeAutoLoadGuideFromFocus(el);",1)
put(p,s)

p='app/src/main/assets/styles.css'; s=txt(p)
if 'v0.8.35 — STARmeter stable-row paint' not in s:s+='''\n\n/* v0.8.35 — STARmeter stable-row paint + deferred hydration hotfix. */\nhtml.android-tv .starmeter-person-section{contain:layout paint style!important;overflow:hidden!important;isolation:isolate!important;background:#050505!important}\nhtml.android-tv .starmeter-person-column,html.android-tv .starmeter-library-column{contain:layout paint!important;overflow:hidden!important}\nhtml.android-tv .starmeter-title-rail{contain:layout paint!important;overflow-x:auto!important;overflow-y:hidden!important}\nhtml.android-tv .starmeter-person-card{transition:none!important}\n'''
put(p,s)

# tests/version guards
p='tests/tv-ui-runtime-smoke.mjs'; s=txt(p).replace("const ANDROID_CURRENT_VERSION='0.8.34';","const ANDROID_CURRENT_VERSION='0.8.35';",1).replace('Swoop-TV-v0.8.34-Diagnostics-','Swoop-TV-v0.8.35-Diagnostics-',1).replace("String(installSeed.sourceVersion||'') !== '0.8.34'","String(installSeed.sourceVersion||'') !== '0.8.35'",1).replace('Install seed source version is not v0.8.34','Install seed source version is not v0.8.35',1)
if 'v0.8.35 stable-row guard' not in s:s+='''\n// v0.8.35 stable-row guard\nif(!appSource.includes('const starmeterDeferredPatches=new Set(),starmeterDeferredIdentityPatches=new Map()'))throw new Error('v0.8.35 deferred STARmeter patch queues missing');\nif(!appSource.includes('function flushStarmeterDeferredPatches()')||!appSource.includes('performance.now()-starmeterLastFocusMoveAt<180'))throw new Error('v0.8.35 D-pad settle guard missing');\nconst v835s=appSource.indexOf('function patchStarmeterPersonNow(rank)'),v835e=appSource.indexOf('function restoreFocusSignatureIn',v835s),v835b=appSource.slice(v835s,v835e);\nif(!v835b.includes("querySelector('.starmeter-library-column')")||!v835b.includes('oldLibrary.replaceChildren')||v835b.includes('oldPerson.replaceWith'))throw new Error('v0.8.35 stable library-only patch path missing');\nif(!cssSource.includes('contain:layout paint style!important')||!cssSource.includes('overflow-y:hidden!important'))throw new Error('v0.8.35 STARmeter paint containment missing');\n'''
put(p,s)

# release notes drive generated release metadata
p='RELEASE_NOTES.md'; s=txt(p); h='# Swoop TV Release Notes\n\n'; sec='''## v0.8.35 — STARmeter Stable Row Rendering Hotfix\n\n- Fixes the physical-TV STARmeter duplicate/ghost rendering where ranks, portraits, names and provider-title content could be painted multiple times during rapid D-pad scrolling.\n- Keeps every STARmeter rank/portrait/name identity column permanently mounted after the Top 100 page is created.\n- Defers async STARmeter hydration until D-pad focus settles for 180 ms and never mutates the currently focused person row.\n- Restricts async row updates to the provider-title library column and removes background full-page rerenders.\n- Adds Android WebView paint containment, isolation and vertical clipping to prevent stale compositor layers bleeding into adjacent people.\n- Retains v0.8.34 fail-open 12-person indexed matching, automatic retry and non-blocking profile selection.\n- Android versionName is **0.8.35** and versionCode is **835**.\n\n'''
if '## v0.8.35 — STARmeter Stable Row Rendering Hotfix' not in s:s=h+sec+s[len(h):]
put(p,s)
for p,a,b in [('README.md','# Swoop TV v0.8.34 — STARmeter Fail-Open Batch Recovery Hotfix','# Swoop TV v0.8.35 — STARmeter Stable Row Rendering Hotfix'),('TV_HARDWARE_RUNNING_FIXES.md','**v0.8.34 — STARmeter Fail-Open Batch Recovery Hotfix**','**v0.8.35 — STARmeter Stable Row Rendering Hotfix**'),('TV_HARDWARE_TEST_CHECKLIST.md','# Swoop TV v0.8.34 — Google TV Hardware Test Checklist','# Swoop TV v0.8.35 — Google TV Hardware Test Checklist')]:
 put(p,txt(p).replace(a,b,1).replace('Current test build: **v0.8.34 / versionCode 834**','Current test build: **v0.8.35 / versionCode 835**',1).replace('`Swoop-TV-v0.8.34-Diagnostics-`','`Swoop-TV-v0.8.35-Diagnostics-`',1))

# make refresh script permanent v0.8.35 and remove temporary hook/import
p='scripts/refresh-seed-cache.mjs'; s=txt(p).replace("sourceVersion:'0.8.34'","sourceVersion:'0.8.35'")
s=re.sub(r'// V0835_PROMOTION_BEGIN\n.*?// V0835_PROMOTION_END\n','',s,flags=re.S).replace("import {execSync} from 'node:child_process';\n",'')
put(p,s)
(r/'PROMOTE_V0835.py').unlink(missing_ok=True)
print('v0.8.35 promotion applied')