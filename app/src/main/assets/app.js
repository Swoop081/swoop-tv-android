import {parseM3U} from './src/m3u.js';
import {parseXMLTV} from './src/xmltv.js';
import {testXtream, importXtream, fetchXtreamAssetBlob, fetchXtreamSeriesInfo, fetchXtreamVodInfo, fetchXtreamShortEpg, fetchXtreamSimpleEpg, fetchXtreamLiveCategories, fetchXtreamVodCategories, fetchXtreamSeriesCategories, fetchXtreamXmltvText, buildXtreamXmltvUrl, buildXtreamSeriesStreamUrl} from './src/xtream.js';
import {isNativeWindows, isNativeAndroid, nativePlay, nativeStop, nativeFetchText, nativeFetchXmltvIndex, nativeDiagnostics, nativeSaveDiagnostics, nativeClearDiagnostics, nativeControl, nativeSwitchLive, nativePreviewLive, nativeStopPreview} from './src/native.js';
import {nativeCatalogStatus,nativeCatalogReplaceProvider,nativeCatalogRemoveProvider,nativeCatalogQuery,nativeCatalogSearch,nativeCatalogCategories,nativeCatalogGet,nativeCatalogSources,nativeCatalogMatchPayload} from './src/nativeCatalog.js';
import {getMDBListItems, getMDBListOfficialItems, getMDBListStreamingChart, matchMDBListToCatalog, normalizeMediaTitle} from './src/mdblist.js';
import {fetchTitleMetadata, fetchTitleImdbRating, fetchPersonCredits, fetchEpisodeMetadata, searchPeople, metadataServiceUrl} from './src/tmdb.js';
import {fetchSwoopDiscovery, fetchSwoopCuratedList} from './src/discovery.js';
import {loadInstallSeedCache, installSeedFresh, installSeedAgeHours, installSeedDiscovery, installSeedPerson, searchInstallSeedPeople, installSeedTitleMetadata, installSeedEpisodeMetadata} from './src/seedCache.js';
import {buildMovieStackIndex, collapseMovieSources, cleanDisplayTitle, rankSources, sourceTraits, qualityLabel} from './src/sourceStack.js';
import {buildLiveStackIndex, selectLiveSource} from './src/liveStack.js';
import {PROFILE_AVATARS, avatarById, makeProfile, normalizeProfile, profileAllowsMedia, profileGenreAffinity, smartRankRows} from './src/profiles.js';
import {SWOOP_THEMES, themeById} from './src/themes.js';
import {loadState, loadBulkState, loadBulkPreview, loadHomeSnapshot, saveHomeSnapshot, saveState, saveBulkState, loadProviderProfile, saveProviderProfile, clearProviderProfile, loadProviderProfiles, saveProviderProfiles, clearProviderProfiles, clearState, loadAuxState, loadEpgCache, saveEpgCache, retireBrowserCatalog} from './src/storage.js';

const NATIVE_WINDOWS=isNativeWindows();
const NATIVE_ANDROID=isNativeAndroid();
const NATIVE_PLAYBACK=NATIVE_WINDOWS||NATIVE_ANDROID;
if(NATIVE_ANDROID)document.documentElement.classList.add('android-tv');
let tvHomeSnapshotActive=false,tvBackgroundRestoreStarted=false,tvSnapshotSaveTimer=null,tvMovieStackWorker=null,tvMovieStackedCache=null,tvMovieStackBuild=[],tvCatalogWorkerReady=false,tvCatalogWorkerSeq=0;
let tvLastFocusedElement=null,tvLastActivationAt=0,androidLaunchChecksScheduled=false,androidLaunchChecksRunning=false,androidProviderLaunchCheckRunning=false,androidAppUpdateAvailable=null,androidLatestManifest=null;
let tvVerticalQueue=0,tvVerticalFrame=0,tvVerticalProcessing=false;
const tvRowColumnMemory=new Map();
let livePreviewTimer=null,livePreviewItemId='',livePreviewActive=false,livePreviewPageToken=0;
const ANDROID_PROVIDER_AUTO_REFRESH_MS=24*60*60*1000;
const ANDROID_UPDATE_RELEASE_TAG='google-tv-test-v0.8.1';
const ANDROID_CURRENT_VERSION='0.8.34';
function updateAndroidTvViewportProfile(){
  if(!NATIVE_ANDROID)return;
  const w=Math.max(1,Number(globalThis.innerWidth||1920)),h=Math.max(1,Number(globalThis.innerHeight||1080));
  const density=(w<1180||h<620)?'tight':(w<1550||h<790)?'compact':'standard';
  document.documentElement.dataset.tvDensity=density;
  document.documentElement.style.setProperty('--tv-vw',String(w));
  document.documentElement.style.setProperty('--tv-vh',String(h));
}
if(NATIVE_ANDROID){updateAndroidTvViewportProfile();globalThis.addEventListener?.('resize',()=>requestAnimationFrame(updateAndroidTvViewportProfile),{passive:true});}

const ANDROID_CURRENT_CHANGELOG=[
  'Fixes the STARmeter 28% startup failure by splitting provider matching into smaller indexed worker batches instead of one all-100 request.',
  'STARmeter preparation is now best-effort and fail-open: profile login and the STARmeter page can never be trapped behind a failed background batch.',
  'Completed STARmeter people are cached incrementally, while unfinished people continue matching from visible-row hydration and scheduled background retries.',
  'Retains v0.8.33 route-top restoration, permanent STARmeter row geometry and pre-login portrait/artwork warming.'
];
let installSeedCache=null;
const installSeedPromise=loadInstallSeedCache().then(seed=>{installSeedCache=seed;return seed}).catch(()=>null);
async function getInstallSeedCache(){return installSeedCache||(installSeedCache=await installSeedPromise)||null}

const tvCatalogWorkerPending=new Map();
let nativeCatalogMode=false,nativeCatalogStats=null,nativeCatalogMigration=false;
const nativeItemCache=new Map();
const nativePageCache={movie:{key:'',items:[],total:0,loading:false},series:{key:'',items:[],total:0,loading:false},live:{key:'',items:[],total:0,loading:false}};
const nativeCategoryCache={movie:[],series:[],live:[]};
const nativeHomeRowCache=new Map();let nativeHomePrimeBusy=false;
const NATIVE_HOME_SEARCH={
'action-movies':['movie','action'],'comedy-movies':['movie','comedy'],'drama-movies':['movie','drama'],'horror-movies':['movie','horror'],'thriller-movies':['movie','thriller'],'scifi-movies':['movie','sci fi'],'family-movies':['movie','family'],'animation-movies':['movie','animation'],'romance-movies':['movie','romance'],'adventure-movies':['movie','adventure'],'fantasy-movies':['movie','fantasy'],'mystery-movies':['movie','mystery'],'western-movies':['movie','western'],'war-movies':['movie','war'],'music-movies':['movie','music'],
'drama-shows':['series','drama'],'crime-shows':['series','crime'],'comedy-shows':['series','comedy'],'reality-shows':['series','reality'],'action-shows':['series','action'],'scifi-shows':['series','sci fi'],'mystery-shows':['series','mystery'],'thriller-shows':['series','thriller'],'animation-shows':['series','animation'],'family-shows':['series','family']};
async function loadNativeHomeRow(id){
  if(!nativeCatalogMode||nativeHomeRowCache.has(id))return nativeHomeRowCache.get(id)||[];let result=[];
  if(String(id).startsWith('cat:')){const parts=String(id).split(':'),kind=parts[1],group=decodeURIComponent(parts.slice(2).join(':'));result=(await nativeCatalogQuery({kind,providerIds:nativeEnabledProviderIds(),group,limit:HOME_STANDARD_ROW_LIMIT,sort:'recent'})).items||[]}
  else if(id==='new-movies')result=(await nativeCatalogQuery({kind:'movie',providerIds:nativeEnabledProviderIds(),limit:HOME_STANDARD_ROW_LIMIT,sort:'provider-added'})).items||[];
  else if(id==='new-shows')result=(await nativeCatalogQuery({kind:'series',providerIds:nativeEnabledProviderIds(),limit:HOME_STANDARD_ROW_LIMIT,sort:'provider-added'})).items||[];
  else if(id==='movies')result=(await nativeCatalogQuery({kind:'movie',providerIds:nativeEnabledProviderIds(),limit:HOME_STANDARD_ROW_LIMIT,sort:'recent'})).items||[];
  else if(id==='shows')result=(await nativeCatalogQuery({kind:'series',providerIds:nativeEnabledProviderIds(),limit:HOME_STANDARD_ROW_LIMIT,sort:'recent'})).items||[];
  else if(id==='live-now')result=(await nativeCatalogQuery({kind:'live',providerIds:nativeEnabledProviderIds(),limit:HOME_STANDARD_ROW_LIMIT,sort:'name'})).items||[];
  else if(id==='top-rated-movies')result=(await nativeCatalogQuery({kind:'movie',providerIds:nativeEnabledProviderIds(),limit:HOME_STANDARD_ROW_LIMIT,sort:'rating'})).items||[];
  else if(id==='top-rated-shows')result=(await nativeCatalogQuery({kind:'series',providerIds:nativeEnabledProviderIds(),limit:HOME_STANDARD_ROW_LIMIT,sort:'rating'})).items||[];
  else if(id==='documentary'){const a=await nativeCatalogSearch('documentary',{providerIds:nativeEnabledProviderIds(),limit:HOME_STANDARD_ROW_LIMIT,kinds:['movie','series']});result=a.items||[]}
  else if(NATIVE_HOME_SEARCH[id]){const [kind,term]=NATIVE_HOME_SEARCH[id],a=await nativeCatalogSearch(term,{providerIds:nativeEnabledProviderIds(),limit:HOME_STANDARD_ROW_LIMIT,kinds:[kind]});result=a.items||[]}
  result=cacheNativeItems(result);nativeHomeRowCache.set(id,result);return result;
}
async function primeNativeHomeRows(){if(!nativeCatalogMode||nativeHomePrimeBusy||state.page!=='home')return;const skip=new Set(['continue','recently-watched','recommended','recent-live','mylist']);const ids=selectedHomeRows().map(x=>x.id).filter(id=>(!WEB_ROW_IDS.has(id)||SNOAK_CURATED_ROWS.has(id))&&!String(id).startsWith('custom:')&&!skip.has(id)&&!nativeHomeRowCache.has(id)).slice(0,10);if(!ids.length)return;nativeHomePrimeBusy=true;try{for(const id of ids){await loadNativeHomeRow(id).catch(()=>[]);if(state.page==='home'&&!modal&&!detailItem&&!playerItem)patchMountedHomeRows([id]);await new Promise(r=>setTimeout(r,0))}}finally{nativeHomePrimeBusy=false}}
function cacheNativeItems(list=[]){
  list=(list||[]).filter(item=>!isDemoItem(item));
  for(const item of list){
    if(!item?.id)continue;
    nativeItemCache.set(item.id,item);
    if(item._nativeSourceId)nativeItemCache.set(String(item._nativeSourceId),item);
    for(const alias of Array.isArray(item._nativeSourceIds)?item._nativeSourceIds:[])if(alias)nativeItemCache.set(String(alias),item);
  }
  return list;
}
function nativeEnabledProviderIds(){return state?.providers?.filter(p=>p.enabled!==false&&!isLegacyDemoProvider(p)).map(p=>p.id)||[]}
function nativeTotal(kind,raw=false){if(!nativeCatalogStats)return 0;const enabled=new Set(nativeEnabledProviderIds());if(!enabled.size)return 0;const rows=(nativeCatalogStats.providers||[]).filter(x=>x.kind===kind&&enabled.has(x.provider_id));return rows.reduce((n,r)=>n+Number(r?.[raw?'raw_count':'unique_count']||0),0)}
function tvSavedKindTotal(kind){return (state?.providers||[]).filter(p=>p.enabled!==false&&!isLegacyDemoProvider(p)).reduce((n,p)=>n+Number(p?.counts?.[kind]||0),0)}
function catalogLogicalTotal(){if(NATIVE_ANDROID&&tvHomeSnapshotActive){const total=['live','movie','series'].reduce((n,k)=>n+tvSavedKindTotal(k),0);if(total)return total}return nativeCatalogMode?['live','movie','series'].reduce((n,k)=>n+nativeTotal(k),0):activeCatalog().length}
function catalogRawTotal(){return nativeCatalogMode?['live','movie','series'].reduce((n,k)=>n+nativeTotal(k,true),0):state.catalog.filter(x=>!isDemoItem(x)).length}
function nativeProviderCounts(id){const rows=(nativeCatalogStats?.providers||[]).filter(x=>x.provider_id===id),out={live:0,movie:0,series:0,total:0};for(const r of rows){out[r.kind]=Number(r.unique_count||0);out.total+=Number(r.raw_count||0)}return out}
async function hydrateNativeProfileItems(){if(!nativeCatalogMode)return;const ids=[...(state.myList||[]),...(state.recentLive||[]),...(state.continueWatching||[]).flatMap(x=>[x?.id||x,x?.item?.parentSeriesId]).filter(Boolean),...(state.watchHistory||[]).flatMap(x=>[x?.id||x,x?.item?.parentSeriesId]).filter(Boolean)];const unique=[...new Set(ids.filter(x=>typeof x==='string'&&x))].slice(0,300);if(!unique.length)return;try{const result=await nativeCatalogGet(unique);cacheNativeItems(result?.items||[])}catch{}}
async function refreshNativeCatalogStats(){if(!NATIVE_WINDOWS)return null;try{nativeCatalogStats=await nativeCatalogStatus();return nativeCatalogStats}catch{return null}}
async function activateNativeCatalogIfAvailable(){
  if(!NATIVE_WINDOWS)return false;let status=await refreshNativeCatalogStats();if(!status?.rowCount)return false;
  if((status.providers||[]).some(x=>String(x.provider_id||'')==='demo')){await nativeCatalogRemoveProvider('demo').catch(()=>{});status=await refreshNativeCatalogStats();}
  const enabledIds=nativeEnabledProviderIds();if(!enabledIds.length){nativeCatalogMode=false;state.catalog=[];return false}
  nativeCatalogMode=true;
  const aux=await loadAuxState().catch(()=>null);if(aux){if(!invalidateDiscovery&&aux.webDiscovery)state.webDiscovery=aux.webDiscovery;if(!invalidateMetadataArtwork&&aux.metadataCache)state.metadataCache=sanitizeImdbMetadataCache(aux.metadataCache);metadataRevision++;if(Array.isArray(aux.mdblistRows)&&aux.mdblistRows.length){const compact=new Map((state.mdblistRows||[]).map(r=>[r.uid,r]));state.mdblistRows=aux.mdblistRows.map(r=>({...compact.get(r.uid),...r}))}}
  const [movies,series,live,catsM,catsS,catsL]=await Promise.all([
    nativeCatalogQuery({kind:'movie',providerIds:enabledIds,limit:144,sort:'recent'}),nativeCatalogQuery({kind:'series',providerIds:enabledIds,limit:96,sort:'recent'}),nativeCatalogQuery({kind:'live',providerIds:enabledIds,limit:144,sort:'name'}),
    nativeCatalogCategories('movie',{providerIds:enabledIds,limit:200}),nativeCatalogCategories('series',{providerIds:enabledIds,limit:200}),nativeCatalogCategories('live',{providerIds:enabledIds,limit:200})
  ]);
  state.catalog=[...cacheNativeItems(movies?.items||[]),...cacheNativeItems(series?.items||[]),...cacheNativeItems(live?.items||[])];
  nativeCategoryCache.movie=catsM?.items||[];nativeCategoryCache.series=catsS?.items||[];nativeCategoryCache.live=catsL?.items||[];
  for(const p of state.providers)p.counts=nativeProviderCounts(p.id);
  resetMovieStackIndex();libraryRestored=true;await hydrateNativeProfileItems();return true;
}
async function migrateCatalogToNative(){
  if(!NATIVE_WINDOWS||nativeCatalogMigration||!state.catalog.length)return false;nativeCatalogMigration=true;
  try{
    const byProvider=new Map();for(const item of state.catalog){const id=item.providerId||state.provider?.id||'legacy';if(!byProvider.has(id))byProvider.set(id,[]);byProvider.get(id).push(item)}
    let done=0,total=state.catalog.length;
    for(const [providerId,list] of byProvider){await nativeCatalogReplaceProvider(providerId,list,{onProgress:info=>updateRestoreProgress({phase:'sqlite',loaded:done+info.loaded,total,items:done+info.loaded})});done+=list.length}
    await refreshNativeCatalogStats();return true;
  }finally{nativeCatalogMigration=false}
}
async function ensureNativePage(kind,{force=false}={}){
  if(!nativeCatalogMode)return null;const cache=nativePageCache[kind],limit=viewLimits[kind]||(kind==='live'?96:72),group=kind==='live'?liveCategory:(pageCategory[kind]||''),key=`${providerFilter}|${group}|${limit}`;if(!force&&cache.key===key&&cache.items.length)return cache;if(cache.loading)return cache;cache.loading=true;
  try{const result=await nativeCatalogQuery({kind,providerId:providerFilter,providerIds:providerFilter==='all'?nativeEnabledProviderIds():[],group,limit,offset:0,sort:kind==='live'?'name':'recent'});cache.key=key;cache.items=cacheNativeItems(result?.items||[]);cache.total=Number(result?.total||cache.items.length);return cache}finally{cache.loading=false}
}
function scheduleNativePage(kind,force=false){if(!nativeCatalogMode)return;const cache=nativePageCache[kind],group=kind==='live'?liveCategory:(pageCategory[kind]||''),want=`${providerFilter}|${group}|${viewLimits[kind]||(kind==='live'?96:72)}`;if(!force&&cache.key===want&&cache.items.length)return;setTimeout(async()=>{const before=cache.key;await ensureNativePage(kind,{force});if((before!==cache.key||force)&&((state.page==='movies'&&kind==='movie')||(state.page==='series'&&kind==='series')||(state.page==='live'&&kind==='live')))render()},0)}
const PINNED_HOME_ROWS=['top20-movies','top20-shows'];
const PRIMARY_HOME_ROWS=['new-movies','new-shows'];
const CURATED_SNOAK_HOME_ORDER=[
  'snoak-latest-netflix-shows','snoak-latest-amazon-prime-shows','snoak-latest-apple-tv-shows','snoak-latest-hbo-max-shows-a','snoak-latest-disney-shows','snoak-latest-hbo-max-shows-b','snoak-latest-miniseries-shows','snoak-popular-kdrama-shows','snoak-trending-anime-shows',
  'snoak-popular-action-movies','snoak-popular-action-shows','snoak-popular-animated-movies','snoak-popular-animated-shows','snoak-popular-comedy-movies','snoak-popular-comedy-shows','snoak-popular-documentary-movies','snoak-popular-documentary-shows','snoak-popular-drama-movies','snoak-popular-drama-shows','snoak-popular-horror-movies','snoak-popular-horror-shows','snoak-popular-reality-shows','snoak-popular-romance-movies','snoak-popular-romance-shows','snoak-popular-scifi-movies','snoak-popular-scifi-shows','snoak-popular-thriller-movies','snoak-popular-thriller-shows'
];
const BOTTOM_HOME_ROWS=['recommended'];
const HOME_REMOVED_ROWS=new Set(['continue','mylist','recently-watched','recent-live','trending-movies','trending-shows','live-now','top-rated-movies','top-rated-shows','action-movies','comedy-movies','drama-shows','new-hot-movies','new-hot-shows']);
function normalizeHomeRows(rows=[]){const source=Array.isArray(rows)?rows:[],rest=[];for(const id of source){if(!id||id==='because-you-watched'||PINNED_HOME_ROWS.includes(id)||rest.includes(id))continue;rest.push(id)}return [...PINNED_HOME_ROWS,...rest]}
function reconcileCuratedHomeRows(rows=[]){
  const source=normalizeHomeRows(rows),locked=new Set([...PINNED_HOME_ROWS,...PRIMARY_HOME_ROWS,...CURATED_SNOAK_HOME_ORDER,...BOTTOM_HOME_ROWS]);
  const retained=source.filter(id=>!HOME_REMOVED_ROWS.has(id)&&!locked.has(id));
  // The curated Home contract is authoritative: always restore every agreed core/Snoak row,
  // preserve unrelated optional/custom rows and keep Recommended at the bottom; personal rows live in My SwoopTV.
  return normalizeHomeRows([...PRIMARY_HOME_ROWS,...CURATED_SNOAK_HOME_ORDER,...retained,...BOTTOM_HOME_ROWS]);
}
const migrateCuratedHomeRows=reconcileCuratedHomeRows;
const DEFAULT_HOME_ROWS=normalizeHomeRows([...PRIMARY_HOME_ROWS,...CURATED_SNOAK_HOME_ORDER,...BOTTOM_HOME_ROWS]);
const DEFAULT_STATE={page:'home',catalog:[],provider:null,providers:[],myList:[],favourites:[],liveFavourites:[],continueWatching:[],watchHistory:[],recentLive:[],profiles:[],activeProfileId:'',mdblistRows:[],webDiscovery:{},metadataCache:{},settings:{mdblistApiKey:'',xtreamRelayUrl:'',xtreamRelayToken:'',metadataServiceUrl:'',themeId:'swoop',backgroundColor:'#030306',backgroundOverride:false,movieSourcePreferences:{},homeRows:[...DEFAULT_HOME_ROWS],smartHomeOrder:true,performanceMode:'auto',lastWhatsNewVersion:''}};
const loaded=loadState()||{};
let savedProviderProfiles=(loadProviderProfiles()||[]).filter(p=>!isLegacyDemoProvider(p));
let savedProviderProfile=savedProviderProfiles[0]||loadProviderProfile()||null;if(savedProviderProfile&&isLegacyDemoProvider(savedProviderProfile))savedProviderProfile=null;
const state=Object.assign({},DEFAULT_STATE,loaded,{settings:{...DEFAULT_STATE.settings,...(loaded.settings||{})},webDiscovery:{...(loaded.webDiscovery||{})},metadataCache:{...(loaded.metadataCache||{})}});
// v0.8.13 — restore Chill as the cinematic black/red theme and move the
// v0.8.11–0.8.12 canonical neon look onto its permanent `swoop` id.
const PROFILE_THEME_SCHEMA=2;
if(Number(state.settings.profileThemeSchemaVersion||0)<PROFILE_THEME_SCHEMA){
  const migrateThemeId=id=>id==='chill'||id==='vice'?'swoop':(id||'swoop');
  state.settings.themeId=migrateThemeId(state.settings.themeId);
  if(Array.isArray(state.profiles))state.profiles=state.profiles.map(profile=>({...profile,profileSettings:{...(profile?.profileSettings||{}),themeId:migrateThemeId(profile?.profileSettings?.themeId)}}));
  state.settings.profileThemeSchemaVersion=PROFILE_THEME_SCHEMA;
}
if(Array.isArray(state.catalog))state.catalog=state.catalog.filter(item=>!isDemoItem(item));
if(NATIVE_ANDROID&&!state.catalog.length){
  const snap=loadHomeSnapshot();
  if(Array.isArray(snap?.catalog)&&snap.catalog.length){state.catalog=snap.catalog.filter(item=>!isDemoItem(item));state.webDiscovery={...(snap.webDiscovery||{}),...state.webDiscovery};tvHomeSnapshotActive=Boolean(state.catalog.length);}
}

if(!Array.isArray(state.providers))state.providers=[];
if(!state.providers.length&&state.provider?.id){state.providers=[{...state.provider,enabled:true,priority:0,status:'connected',lastRefreshed:Date.now(),counts:{}}];}
if(!state.providers.length&&savedProviderProfiles.length){state.providers=savedProviderProfiles.map((p,i)=>({id:p.id||`${p.type||'provider'}-${Math.abs(hash(`${p.server||p.url||p.name||i}|${p.username||''}`))}`,type:p.type||'xtream',name:p.name||`Provider ${i+1}`,server:p.server||'',url:p.url||'',epgUrl:p.epgUrl||'',relayUrl:p.relayUrl||'',enabled:p.enabled!==false,priority:Number.isFinite(Number(p.priority))?Number(p.priority):i,status:'saved',lastRefreshed:Number(p.lastRefreshed||0),counts:p.counts||{},expiresAt:Number(p.expiresAt||0),expiryNever:Boolean(p.expiryNever)}));}
state.providers=state.providers.filter(p=>!isLegacyDemoProvider(p)).map((p,i)=>({...p,enabled:p.enabled!==false,priority:Number.isFinite(Number(p.priority))?Number(p.priority):i,status:p.status||'connected',counts:p.counts||{}})).sort((a,b)=>Number(a.priority)-Number(b.priority));
function syncLegacyProvider(){const enabled=state.providers.filter(p=>p.enabled!==false).sort((a,b)=>Number(a.priority)-Number(b.priority));state.provider=enabled[0]||null;return state.provider}
syncLegacyProvider();
if(!Array.isArray(state.settings.homeRows)||!state.settings.homeRows.length)state.settings.homeRows=[...DEFAULT_HOME_ROWS];
state.settings.homeRows=normalizeHomeRows(state.settings.homeRows);
if(Number(state.settings.personalizationSchemaVersion||0)<2){for(const id of ['recommended','recently-watched','recent-live'])if(!state.settings.homeRows.includes(id))state.settings.homeRows.push(id);state.settings.homeRows=normalizeHomeRows(state.settings.homeRows);state.settings.personalizationSchemaVersion=2;}
const HOME_LAYOUT_SCHEMA=7;
if(Number(state.settings.homeLayoutSchemaVersion||0)<HOME_LAYOUT_SCHEMA){
  state.settings.homeRows=migrateCuratedHomeRows(state.settings.homeRows);
  if(Array.isArray(state.profiles))state.profiles=state.profiles.map(p=>({...p,profileSettings:{...(p?.profileSettings||{}),homeRows:migrateCuratedHomeRows(p?.profileSettings?.homeRows||DEFAULT_HOME_ROWS)}}));
  state.settings.homeLayoutSchemaVersion=HOME_LAYOUT_SCHEMA;
}
// Repair partial/stale per-profile Home layouts even when an older build incorrectly marked the schema current.
state.settings.homeRows=reconcileCuratedHomeRows(state.settings.homeRows);
if(Array.isArray(state.profiles))state.profiles=state.profiles.map(p=>({...p,profileSettings:{...(p?.profileSettings||{}),homeRows:reconcileCuratedHomeRows(p?.profileSettings?.homeRows||DEFAULT_HOME_ROWS)}}));
const DISCOVERY_MATCH_SCHEMA=6;
const invalidateDiscovery=Number(state.settings.discoverySchemaVersion||0)!==DISCOVERY_MATCH_SCHEMA;
if(invalidateDiscovery){state.webDiscovery={};state.settings.discoverySchemaVersion=DISCOVERY_MATCH_SCHEMA;}
const METADATA_ARTWORK_SCHEMA=4;
const invalidateMetadataArtwork=Number(state.settings.metadataArtworkSchemaVersion||0)!==METADATA_ARTWORK_SCHEMA;
if(invalidateMetadataArtwork){state.metadataCache={};state.settings.metadataArtworkSchemaVersion=METADATA_ARTWORK_SCHEMA;}
const TITLE_LOOKUP_SCHEMA=4;
function needsTitleLookupPrefixRepair(item={}){
  const raw=String(item?.name||'').trim();
  // v0.7.34: provider catalogues commonly chain quality + service markers, e.g.
  // `4K-MAX - Lanterns`, `4K-NF - Outer Banks`, `4K-AMZ - Reacher`, or
  // `D+ - Lucky Luke`. These were missed by the earlier one-prefix repair.
  return /^\s*[-–—|:•·]*\s*(?:(?:8K|4K|UHD|FHD|HD|SD)\s*[-–—|:•·]+\s*)?(?:MAX|HMAX|HBO\s+MAX|AMZ|AMAZON|PRIME(?:\s+VIDEO)?|NF|NETFLIX|A\+|ATV|APPLE\s*TV\+?|APPLETV\+|APL|DSNP|D\+|DPLUS|DISNEY\+?|CR|CRUNCHYROLL|CRUNCHY\s+ROLL|PMTP|PARAMOUNT\+?)\s*(?:\||:|[-–—])/i.test(raw);
}
const IMDB_RATING_SCHEMA=2;
const invalidateImdbRatings=Number(state.settings.imdbRatingSchemaVersion||0)!==IMDB_RATING_SCHEMA;
function sanitizeImdbMetadataCache(cache={}){
  if(!cache||typeof cache!=='object')return {};
  if(invalidateImdbRatings){for(const meta of Object.values(cache)){if(!meta||typeof meta!=='object')continue;const valid=tenPointRating(meta.imdbRating);if(valid){meta.imdbRating=valid;meta.imdbRatingCheckedAt=Number(meta.imdbRatingCheckedAt||Date.now())}else{delete meta.imdbRating;delete meta.imdbRatingCheckedAt;}}}
  return cache;
}
state.metadataCache=sanitizeImdbMetadataCache(state.metadataCache);
state.settings.imdbRatingSchemaVersion=IMDB_RATING_SCHEMA;
if(!Array.isArray(state.myList)||!state.myList.length) state.myList=Array.isArray(state.favourites)?[...state.favourites]:[];
if(!Array.isArray(state.continueWatching)) state.continueWatching=[];
if(!Array.isArray(state.watchHistory)) state.watchHistory=[];
if(!Array.isArray(state.recentLive)) state.recentLive=[];
if(!Array.isArray(state.liveFavourites)) state.liveFavourites=[];
if(!state.settings.movieSourcePreferences||typeof state.settings.movieSourcePreferences!=='object')state.settings.movieSourcePreferences={};
if(!Array.isArray(state.mdblistRows))state.mdblistRows=[];
sanitizeLegacyDemoRefs(state);
state.mdblistRows.forEach((r,i)=>{if(!r.uid)r.uid=`legacy-${Math.abs(hash(String(r.name||'row')+i))}`;});
if(!loaded.settings?.homeRows&&state.mdblistRows.length)state.settings.homeRows.push(...state.mdblistRows.map(r=>`custom:${r.uid}`));

const PROFILE_SETTING_KEYS=['themeId','backgroundColor','backgroundOverride','movieSourcePreferences','homeRows','smartHomeOrder','lastWhatsNewVersion'];
function profileSettingsSnapshot(){const out={};for(const key of PROFILE_SETTING_KEYS){const value=state.settings?.[key];out[key]=Array.isArray(value)?[...value]:value&&typeof value==='object'?{...value}:value}return out}
function currentProfileSnapshot(base={}){return normalizeProfile({...base,id:base.id||state.activeProfileId,name:base.name||'Swoop TV',avatar:base.avatar||'lion',kids:Boolean(base.kids),pinHash:base.pinHash||'',pinSalt:base.pinSalt||'',myList:[...(state.myList||[])],continueWatching:[...(state.continueWatching||[])],watchHistory:[...(state.watchHistory||[])],recentLive:[...(state.recentLive||[])],liveFavourites:[...(state.liveFavourites||[])],profileSettings:profileSettingsSnapshot()})}
function activeProfile(){return state.profiles.find(p=>p.id===state.activeProfileId)||state.profiles[0]||null}
function ensureProfiles(){
  if(!Array.isArray(state.profiles)||!state.profiles.length){
    const first=makeProfile({id:'profile-main',name:'Swoop TV',avatar:'lion',myList:state.myList,continueWatching:state.continueWatching,watchHistory:state.watchHistory,recentLive:state.recentLive,liveFavourites:state.liveFavourites,profileSettings:profileSettingsSnapshot()});
    state.profiles=[first];state.activeProfileId=first.id;
  }else{
    state.profiles=state.profiles.map((p,i)=>sanitizeLegacyDemoRefs(normalizeProfile(p,{name:p?.name||`Profile ${i+1}`,avatar:p?.avatar||PROFILE_AVATARS[i%PROFILE_AVATARS.length].id,profileSettings:{themeId:'swoop',backgroundColor:'#030306',backgroundOverride:false,movieSourcePreferences:{},homeRows:[...DEFAULT_HOME_ROWS],smartHomeOrder:true}})));
    if(!state.profiles.some(p=>p.id===state.activeProfileId))state.activeProfileId=state.profiles[0].id;
  }
}
function syncActiveProfileFromState(){const i=state.profiles.findIndex(p=>p.id===state.activeProfileId);if(i<0)return;state.profiles[i]=currentProfileSnapshot(state.profiles[i])}
function applyProfileToState(profile){if(!profile)return;profile=sanitizeLegacyDemoRefs(profile);state.myList=[...(profile.myList||[])];state.continueWatching=[...(profile.continueWatching||[])];state.watchHistory=[...(profile.watchHistory||[])];state.recentLive=[...(profile.recentLive||[])];state.liveFavourites=[...(profile.liveFavourites||[])];const ps=profile.profileSettings||{},legacyBg=ps.backgroundColor||'#050505';state.settings.themeId=themeById(ps.themeId||'swoop').id;state.settings.backgroundColor=legacyBg;state.settings.backgroundOverride=typeof ps.backgroundOverride==='boolean'?ps.backgroundOverride:Boolean(!ps.themeId&&String(legacyBg).toLowerCase()!=='#050505');state.settings.movieSourcePreferences={...(ps.movieSourcePreferences||{})};state.settings.homeRows=reconcileCuratedHomeRows(Array.isArray(ps.homeRows)&&ps.homeRows.length?[...ps.homeRows]:[...DEFAULT_HOME_ROWS]);state.settings.smartHomeOrder=ps.smartHomeOrder!==false;state.settings.lastWhatsNewVersion=String(ps.lastWhatsNewVersion||state.settings.lastWhatsNewVersion||'')}
ensureProfiles();
applyProfileToState(activeProfile());

let modal=null,continueOptionsTarget=null,toastTimer=null,playerItem=null,playerUiHidden=false,activeHls=null,trailerKey='',trailerTitle='',sourceChoiceItem=null;
let profilePickerOpen=true,profileEditId='',pendingProfileId='',profilePinError='';
let playbackMonitorTimer=null,lastPlaybackPersist=0,playerStartedAt=0,upNextTimer=null,upNextSeconds=0,upNextItem=null;
let liveMiniGuideToken=0,channelNumberBuffer='',channelNumberTimer=null;
let heroRotationIndex=0,heroRotationTimer=null;
const HERO_ROTATION_MS=8000;
const LARGE_LIBRARY_THRESHOLD=12000;
const HOME_EAGER_ROWS=5;
const HOME_EAGER_CARDS=12;
const HOME_RANKED_ROW_LIMIT=100;
const HOME_STANDARD_ROW_LIMIT=100;
const ANDROID_TV_HOME_EAGER_ROWS=5;
const ANDROID_TV_HOME_DATA_STANDARD_LIMIT=100;
const ANDROID_TV_HOME_DATA_RANKED_LIMIT=100;
const ANDROID_TV_HOME_INITIAL_RENDER=48;
const ANDROID_TV_HOME_EXPAND_CHUNK=32;
const ANDROID_DYNAMIC_HOME_ROWS=new Set(['continue','recently-watched','recommended','recent-live','mylist']);
let androidLibraryLoading=false,tvForceHomeTop=false;
let androidStartupGateComplete=false,androidStartupGatePromise=null,androidPreparedHomeReady=false;
const androidPreparedHomeRows=new Map();
function clearAndroidPreparedHome(){androidPreparedHomeReady=false;androidPreparedHomeRows.clear()}
let androidFastCatalogRef=null,androidFastCatalogContext='',androidFastCatalogCache=null;
let lazyHomeObserver=null,searchDebounceTimer=null,peopleSearchSeq=0;
function largeLibraryMode(){return state.settings.performanceMode!=='cinematic'&&catalogLogicalTotal()>=LARGE_LIBRARY_THRESHOLD}
function androidFastHomeMode(){return NATIVE_ANDROID&&!nativeCatalogMode&&state.page==='home'&&(tvHomeSnapshotActive||catalogLogicalTotal()>=LARGE_LIBRARY_THRESHOLD)}
function resetAndroidFastCatalog(){androidFastCatalogRef=null;androidFastCatalogContext='';androidFastCatalogCache=null;clearAndroidPreparedHome()}
function androidFastCatalog(){
  const cat=activeCatalog(),context=activeCatalogContext;
  if(androidFastCatalogRef===cat&&androidFastCatalogContext===context&&androidFastCatalogCache)return androidFastCatalogCache;
  const movie=[],series=[],live=[],byId=new Map();
  for(const item of cat){if(!item?.id)continue;byId.set(String(item.id),item);if(item.kind==='movie')movie.push(item);else if(item.kind==='series')series.push(item);else if(item.kind==='live')live.push(item)}
  androidFastCatalogRef=cat;androidFastCatalogContext=context;androidFastCatalogCache={movie,series,live,byId};return androidFastCatalogCache;
}
function androidFastSavedItem(id){
  const key=String(id||'');if(!key)return null;
  const hit=androidFastCatalog().byId.get(key);if(hit)return hit;
  return state.continueWatching.find(x=>String(x?.id||'')===key)?.item||state.watchHistory.find(x=>String(x?.id||'')===key)?.item||detailEpisodeItems.get(key)||null;
}
function androidFastSortAdded(list=[],limit=ANDROID_TV_HOME_DATA_STANDARD_LIMIT){return [...list].sort((a,b)=>providerAddedNumber(b)-providerAddedNumber(a)||String(a?.name||'').localeCompare(String(b?.name||''))).slice(0,limit)}
function homeVisibleTitleKey(item={}){return normalizeMediaTitle(cleanDisplayTitle(item)||item?.name||'')}
function appendUniqueHomeTitle(out,item,seenIds,seenExternal,seenTitles){
  if(!item)return false;
  const id=String(item.id||'');if(id&&seenIds.has(id))return false;
  const kind=String(item.kind||''),tmdb=String(item.tmdbId||item.tmdb||'').trim(),imdb=String(item.imdbId||item.imdb||'').trim().toLowerCase();
  const external=tmdb?`${kind}|tmdb:${tmdb}`:imdb?`${kind}|imdb:${imdb}`:'';
  if(external&&seenExternal.has(external))return false;
  const title=homeVisibleTitleKey(item),year=yearNumber(item);
  if(title){const titleKey=`${kind}|${title}`,years=seenTitles.get(titleKey);if(years&&(!year||years.has(0)||years.has(year)))return false;if(years&&year&&years.has(0))return false}
  if(id)seenIds.add(id);if(external)seenExternal.add(external);
  if(title){const titleKey=`${kind}|${title}`,years=seenTitles.get(titleKey)||new Set();years.add(year||0);seenTitles.set(titleKey,years)}
  out.push(item);return true;
}
function dedupeHomeTitles(list=[]){const out=[],seenIds=new Set(),seenExternal=new Set(),seenTitles=new Map();for(const item of list||[])appendUniqueHomeTitle(out,item,seenIds,seenExternal,seenTitles);return out}
function androidFastRowItems(id){
  const fast=androidFastCatalog(),limit=String(id).startsWith('top20-')?ANDROID_TV_HOME_DATA_RANKED_LIMIT:ANDROID_TV_HOME_DATA_STANDARD_LIMIT;
  const cached=state.webDiscovery?.[id];
  if(WEB_ROW_IDS.has(id)&&cached){
    const source=Array.isArray(cached.items)&&cached.items.length?cached.items:(cached.itemIds||[]).map(androidFastSavedItem).filter(Boolean);
    if(source.length)return source.filter(x=>!isDemoItem(x)).slice(0,limit);
  }
  if(String(id).startsWith('custom:')){const uid=String(id).slice(7),row=state.mdblistRows.find(x=>String(x.uid)===uid);return (row?.items||[]).filter(x=>!isDemoItem(x)).slice(0,limit)}
  if(id==='continue')return state.continueWatching.slice().sort((a,b)=>(b.lastPlayed||0)-(a.lastPlayed||0)).map(x=>androidFastSavedItem(x.id)||x.item).filter(Boolean).slice(0,limit);
  if(id==='recently-watched')return state.watchHistory.slice().sort((a,b)=>(b.lastPlayed||0)-(a.lastPlayed||0)).map(x=>androidFastSavedItem(x.id)||x.item).filter(Boolean).slice(0,limit);
  if(id==='recent-live')return state.recentLive.map(androidFastSavedItem).filter(Boolean).slice(0,limit);
  if(id==='mylist')return state.myList.map(androidFastSavedItem).filter(Boolean).slice(0,limit);
  if(id==='recommended'){
    const history=state.watchHistory.slice(0,8).map(x=>androidFastSavedItem(x.id)||x.item).filter(Boolean),terms=new Set();
    for(const item of history)for(const g of mediaGenres(item))terms.add(g);
    if(!terms.size)return [];
    const out=[];for(const item of [...fast.movie,...fast.series]){const text=mediaSearchText(item);if([...terms].some(g=>text.includes(g))){out.push(item);if(out.length>=limit)break}}return out;
  }
  if(id==='top20-movies'||id==='top20-shows')return [];
  if(id==='live-now')return fast.live.slice(0,limit);
  if(id==='movies')return fast.movie.slice(0,limit);
  if(id==='shows')return fast.series.slice(0,limit);
  if(id==='new-movies')return androidFastSortAdded(fast.movie,limit);
  if(id==='new-shows')return androidFastSortAdded(fast.series,limit);
  if(id==='top-rated-movies')return fast.movie.filter(x=>ratingNumber(x)>0).sort((a,b)=>ratingNumber(b)-ratingNumber(a)).slice(0,limit);
  if(id==='top-rated-shows')return fast.series.filter(x=>ratingNumber(x)>0).sort((a,b)=>ratingNumber(b)-ratingNumber(a)).slice(0,limit);
  if(String(id).startsWith('cat:')){const parts=String(id).split(':'),kind=parts[1],name=decodeURIComponent(parts.slice(2).join(':'));return (fast[kind]||[]).filter(x=>x.group===name).slice(0,limit)}
  const search=NATIVE_HOME_SEARCH[id];if(search){const [kind,term]=search,source=fast[kind]||[];return source.filter(x=>mediaSearchText(x).includes(term)).slice(0,limit)}
  if(id==='documentary')return [...fast.movie,...fast.series].filter(x=>/documentary|docuseries/.test(mediaSearchText(x))).slice(0,limit);
  return [];
}
function androidFastHeroCandidates(){
  const fast=androidFastCatalog(),out=[],seen=new Set();
  for(const id of ['top20-movies','top20-shows','new-movies','new-shows'])for(const item of androidFastRowItems(id)){if(item&&!seen.has(item.id)&&(item.backdrop||item.logo)){seen.add(item.id);out.push(item);if(out.length>=10)return out}}
  for(const item of [...fast.movie,...fast.series]){if(item&&!seen.has(item.id)&&(item.backdrop||item.logo)){seen.add(item.id);out.push(item);if(out.length>=10)break}}
  return out;
}
function forceAndroidHomeEntry(){
  if(!NATIVE_ANDROID)return;tvForceHomeTop=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(state.page!=='home'||profilePickerOpen)return;window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;
    const target=document.querySelector('.hero-actions button,[data-home-row-mounted] .card,.library-manage,.desktop-nav [data-page="home"]');
    if(target){try{target.focus({preventScroll:true})}catch{target.focus()}}tvForceHomeTop=false;scheduleAndroidLaunchChecks();
  }));
}

function tvCompactHomeItem(item={}){
  const copy={...item};
  if(Array.isArray(copy.sources)&&copy.sources.length>2)copy.sources=copy.sources.slice(0,2);
  delete copy.raw;delete copy._raw;delete copy.epg;delete copy.programmes;
  return copy;
}
function buildTvHomeSnapshot(){
  if(!NATIVE_ANDROID||!Array.isArray(state.catalog)||!state.catalog.length)return null;
  const out=[],seen=new Set(),take=item=>{if(!item?.id||isDemoItem(item)||seen.has(String(item.id))||out.length>=760)return;seen.add(String(item.id));out.push(tvCompactHomeItem(item))};
  const quotas={live:100,movie:150,series:150},used={live:0,movie:0,series:0};
  for(const item of state.catalog){const kind=item?.kind;if(kind in quotas&&used[kind]<quotas[kind]){take(item);used[kind]++}if(used.live>=quotas.live&&used.movie>=quotas.movie&&used.series>=quotas.series)break}
  const refs=new Set([...(state.myList||[]),...(state.recentLive||[]),...(state.continueWatching||[]).map(x=>x?.id||x),...(state.watchHistory||[]).map(x=>x?.id||x)].filter(Boolean).map(String));
  if(refs.size)for(const item of state.catalog){if(refs.has(String(item?.id||'')))take(item)}
  const webDiscovery={};
  for(const [id,cache] of Object.entries(state.webDiscovery||{})){
    if(!cache||typeof cache!=='object')continue;
    const items=(Array.isArray(cache.items)?cache.items:[]).filter(x=>x&&!isDemoItem(x)).slice(0,ANDROID_TV_HOME_DATA_RANKED_LIMIT);
    for(const item of items)take(item);
    webDiscovery[id]={...cache,items:items.map(tvCompactHomeItem),itemIds:(cache.itemIds||items.map(x=>x.id)).slice(0,ANDROID_TV_HOME_DATA_RANKED_LIMIT)};
  }
  return {schema:1,savedAt:Date.now(),catalog:out,webDiscovery};
}
function scheduleTvHomeSnapshotSave(delay=500){
  if(!NATIVE_ANDROID||!state.catalog.length)return;
  if(tvSnapshotSaveTimer)clearTimeout(tvSnapshotSaveTimer);
  tvSnapshotSaveTimer=setTimeout(()=>{tvSnapshotSaveTimer=null;const run=()=>{const snap=buildTvHomeSnapshot();if(snap)saveHomeSnapshot(snap)};if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:1800});else setTimeout(run,0)},delay);
}
function tvCatalogWorkerRequest(type,payload={},timeout=9000){
  if(!NATIVE_ANDROID||!tvMovieStackWorker||!tvCatalogWorkerReady)return Promise.resolve(null);
  const requestId=`tv-${++tvCatalogWorkerSeq}-${Date.now()}`;
  return new Promise(resolve=>{
    const timer=setTimeout(()=>{tvCatalogWorkerPending.delete(requestId);resolve(null)},timeout);
    tvCatalogWorkerPending.set(requestId,{resolve,value:null,timer});
    try{tvMovieStackWorker.postMessage({type,requestId,...payload})}catch{clearTimeout(timer);tvCatalogWorkerPending.delete(requestId);resolve(null)}
  });
}
function stopTvCatalogWorker(){
  if(tvMovieStackWorker){try{tvMovieStackWorker.terminate()}catch{}}
  tvMovieStackWorker=null;tvCatalogWorkerReady=false;tvMovieStackBuild=[];
  for(const pending of tvCatalogWorkerPending.values()){clearTimeout(pending.timer);pending.resolve(null)}tvCatalogWorkerPending.clear();
}
function startTvMovieStackWorker(immediate=false,onInitProgress=null){
  if(!NATIVE_ANDROID||tvMovieStackWorker||!state.catalog.length)return;
  const run=()=>{try{
    const worker=new Worker(new URL('./src/catalog-index-worker.js',import.meta.url),{type:'module'});tvMovieStackWorker=worker;tvCatalogWorkerReady=false;
    worker.onmessage=e=>{const data=e.data||{};
      if(data.type==='movie-stack-chunk'&&Array.isArray(data.items)){if(Number(data.offset||0)===0)tvMovieStackBuild=[];tvMovieStackBuild.push(...data.items)}
      if(data.type==='movie-stack-end'){tvMovieStackedCache=tvMovieStackBuild;tvMovieStackBuild=[]}
      if(data.type==='worker-ready')tvCatalogWorkerReady=true;
      if(data.requestId&&tvCatalogWorkerPending.has(data.requestId)){const pending=tvCatalogWorkerPending.get(data.requestId);clearTimeout(pending.timer);tvCatalogWorkerPending.delete(data.requestId);pending.resolve(data.type==='worker-error'?null:data)}
    };
    worker.onerror=()=>stopTvCatalogWorker();
    const catalogRef=state.catalog,chunkSize=1500,total=Math.max(1,catalogRef.length);worker.postMessage({type:'init-start',providerPriority:providerPriorityMap(),enabledProviderIds:enabledProviders().map(p=>p.id)});
    let offset=0;const sendNext=()=>{if(worker!==tvMovieStackWorker||catalogRef!==state.catalog)return;const chunk=catalogRef.slice(offset,offset+chunkSize);if(chunk.length){worker.postMessage({type:'init-chunk',catalog:chunk});offset+=chunk.length;try{onInitProgress?.({loaded:Math.min(offset,total),total});}catch{}const again=()=>sendNext();if(immediate)setTimeout(again,0);else if('requestIdleCallback'in window)requestIdleCallback(again,{timeout:900});else setTimeout(again,12)}else worker.postMessage({type:'init-end'})};sendNext();
  }catch{stopTvCatalogWorker()}};
  if(immediate)run();else if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:5000});else setTimeout(run,1800);
}
async function ensureTvCatalogWorkerReady(timeout=30000,onProgress=null){
  if(!NATIVE_ANDROID||!state.catalog.length)return false;
  if(tvCatalogWorkerReady)return true;
  startTvMovieStackWorker(true,onProgress);
  const started=Date.now();
  while(Date.now()-started<timeout){if(tvCatalogWorkerReady)return true;if(!tvMovieStackWorker)return false;await new Promise(r=>setTimeout(r,80))}
  return tvCatalogWorkerReady;
}

function startAndroidBackgroundRestore(){
  if(!NATIVE_ANDROID||tvBackgroundRestoreStarted||libraryRestored||!state.providers.length)return;
  tvBackgroundRestoreStarted=true;
  setTimeout(async()=>{
    try{
      if(!state.catalog.length){const preview=await loadBulkPreview();if(Array.isArray(preview?.catalog)&&preview.catalog.length){state.catalog=preview.catalog.filter(item=>!isDemoItem(item));state.webDiscovery={...(preview.webDiscovery||{}),...state.webDiscovery};tvHomeSnapshotActive=true;resetMovieStackIndex();}}
      await ensureDurableLibraryRestored();
      scheduleTvHomeSnapshotSave(1000);startTvMovieStackWorker();
    }catch{}finally{tvBackgroundRestoreStarted=false}
  },40);
}
function tvFastItems(kind){
  const fast=androidFastCatalog();
  if(kind==='movie')return tvMovieStackedCache||fast.movie;
  if(kind==='live')return fast.live;
  return fast.series;
}

function performanceLabel(){return largeLibraryMode()?'Optimized for large library':'Full cinematic rendering'}
let discoveryRefreshing=false,discoveryMessage='';
let longTask=null,longTaskTicker=null,longTaskClearTimer=null,longTaskSeq=0;
const metadataPending=new Map();
const visibleMetadataQueue=[];
const visibleMetadataQueued=new Set();
const visibleArtworkRepairIds=new Set();
let visibleMetadataActive=0,visibleMetadataObserver=null;
const DISCOVERY_REFRESH_MS=4*60*60*1000;
const DISCOVERY_FAST_REFRESH_MS=90*60*1000;
const TOP100_RANKING_SCHEMA=3;
const discoveryBundleMemory=new Map();
let detailItem=null,detailPayload=null,detailLoading=false,detailError='',detailSeason='';
let personView=null,personLoading=false,personError='',personMovies=[],personShows=[],personProgress=0,personStatus='',personScrollTop=0,personOpenToken=0;
let starmeterPeople=[],starmeterLoaded=false,starmeterLoading=false,starmeterError='',starmeterObserver=null,starmeterPrewarmTimer=null,starmeterVisibleCount=5,starmeterAutoLoadObserver=null;
const starmeterPersonCache=new Map(),starmeterHotCache=new Map(),starmeterHydratePending=new Map(),starmeterRetryCounts=new Map();
const starmeterHydrateQueue=[];let starmeterHydrateBusy=0,starmeterGeneration=0;
let starmeterBackgroundPreparePromise=null,starmeterBackgroundReady=false,starmeterBackgroundComplete=false,starmeterBackgroundProgress=0,starmeterBackgroundStatus='Preparing STARmeter…',starmeterPreparedProviderSignature='',starmeterBackgroundRetryTimer=null;
const STARMETER_PRELOGIN_BATCH_SIZE=12;
function withTimeout(promise,ms=6000,label='Operation timed out'){return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>setTimeout(()=>reject(new Error(label)),ms))])}
function cancelStarmeterWork(){starmeterGeneration++;starmeterHydrateQueue.length=0;starmeterHydrateBusy=0;starmeterObserver?.disconnect?.();starmeterObserver=null;starmeterAutoLoadObserver?.disconnect?.();starmeterAutoLoadObserver=null;}
const episodeMetadataCache=new Map(),episodeMetadataPending=new Map();
let suspendedBaseView=null,suspendedDetailView=null,suspendedPersonView=null;
const persistentPageViews=new Map();
const PERSISTENT_PAGE_IDS=new Set(['home','myswoop','live','guide','starmeter','movies','series','mylist','search','settings']);
const ANDROID_HEAVY_NONPERSISTENT_PAGES=new Set(['live','starmeter','movies','series']);
let browseWarmupTimer=null,browseWarmupRunning=false;
const detailCache=new Map();
const personLibraryCache=new Map();
const detailPrefetchPending=new Map();
const detailEpisodeItems=new Map();
const viewLimits={live:100,movie:100,series:100};
let guideLimit=48,guideCategory='',liveCategory='',providerFilter='all',pageCategory={movie:'',series:''},guideAutoLoadPending=false;
const LONG_RAIL_BATCH_SIZE=100,LONG_RAIL_INITIAL_RENDER=24,LONG_RAIL_RENDER_CHUNK=24,LONG_RAIL_PREFETCH_THRESHOLD=24;
const LIVE_RAIL_CHANNEL_LIMIT=100,LIVE_RAIL_CATEGORY_BATCH=3;
const MEDIA_RAIL_ITEM_LIMIT=100,MEDIA_RAIL_CATEGORY_BATCH=6;
const STARMETER_INITIAL_VISIBLE=100,STARMETER_APPEND_BATCH=100,STARMETER_HYDRATE_CONCURRENCY=3,STARMETER_PREFETCH_AHEAD=18,STARMETER_TITLE_RENDER_LIMIT=24;
let liveRailCategoryLimit=LIVE_RAIL_CATEGORY_BATCH;
const mediaRailCategoryLimit={movie:MEDIA_RAIL_CATEGORY_BATCH,series:MEDIA_RAIL_CATEGORY_BATCH};
const liveRailCache=new Map(),liveRailRequests=new Map(),liveRailRenderLimits=new Map();
const mediaRailCache=new Map(),mediaRailRequests=new Map(),mediaRailRenderLimits=new Map(),mediaRailBrowserFullCache=new Map();

// Google TV hardware diagnostics are deliberately dormant in normal use. Enable the hidden
// test mode by pressing OK on the Settings cog five times within four seconds.
const TV_DIAGNOSTIC_MAX_EVENTS=600;
const TV_HARDWARE_TESTS=[
  {id:'NAV-001',label:'Top 100 Movies · Right 1 → 100'},
  {id:'NAV-002',label:'Top 100 TV Shows · Right 1 → 100'},
  {id:'NAV-003',label:'Down preserves visual column'},
  {id:'PERF-001',label:'Rapid Up / Down remote stress'},
  {id:'LIVE-001',label:'Live TV Recent-size cards + preview'},
  {id:'STAR-001',label:'STARmeter #1 → #30 indexed hydration + escape'},
  {id:'MYSWOOP-001',label:'My SwoopTV personal rails + navigation'},
  {id:'PROFILE-001',label:'Who’s Watching · first profile focused'},
  {id:'DETAIL-001',label:'Series · seasons + episode focus path'},
  {id:'ROUTE-001',label:'Person detail teardown across primary tabs'},
  {id:'GUIDE-001',label:'Guide cached EPG + focus diagnostics'},
  {id:'STAB-001',label:'Five-minute mixed-screen stability'}
];
let tvHardwareTestMode=false,tvHardwareSettingsTapCount=0,tvHardwareSettingsTapAt=0,tvHardwareOverlayTimer=0,tvHardwareNativePollAt=0,tvHardwareNativeSnapshot={},tvHardwareCurrentTest='',tvLastDiagnosticsPath='',tvDiagnosticPersistTimer=0;
const tvDiagnosticEvents=[];
try{tvHardwareTestMode=localStorage.getItem('swoop-tv-hardware-test-mode')==='1';tvHardwareCurrentTest=localStorage.getItem('swoop-tv-hardware-test-id')||'';const recovered=JSON.parse(localStorage.getItem('swoop-tv-hardware-test-events')||'[]');if(tvHardwareTestMode&&Array.isArray(recovered))tvDiagnosticEvents.push(...recovered.slice(-120))}catch{}
function tvDiagnosticElement(el){
  if(!el||!el.isConnected)return null;
  const guideCategoryEl=el.closest?.('[data-guide-category]'),guideRowEl=el.closest?.('[data-guide-row]'),guideProgramEl=el.closest?.('.guide-program'),guideChannelEl=el.closest?.('.guide-channel');
  if(guideCategoryEl){const all=[...document.querySelectorAll('[data-guide-category]')];return {tag:el.tagName||'',id:el.id||'',label:String(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,80),row:'guide:categories',index:all.indexOf(guideCategoryEl)+1,rowItems:all.length,longRail:'',loaded:all.length,total:all.length}}
  if(guideRowEl&&(guideProgramEl||guideChannelEl)){const rows=[...document.querySelectorAll('[data-guide-row]')],programs=[...guideRowEl.querySelectorAll('.guide-program')],index=guideProgramEl?programs.indexOf(guideProgramEl):rows.indexOf(guideRowEl);return {tag:el.tagName||'',id:el.id||'',label:String(el.getAttribute?.('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,80),row:guideProgramEl?`guide:program:${guideRowEl.dataset.guideRow||''}`:'guide:channels',index:index+1,rowItems:guideProgramEl?programs.length:rows.length,longRail:'',loaded:rows.length,total:Number(guideChannelSnapshot()?.total||rows.length)}}
  const section=tvRailSection(el),cards=tvRailCards(section),card=el.closest?.('.card,.live-rail-card,button'),index=card&&cards.length?cards.indexOf(card):-1,track=el.closest?.('[data-long-rail]');
  return {tag:el.tagName||'',id:el.id||'',label:String(el.getAttribute?.('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,80),row:section?tvRailSectionKey(section):'',index:index>=0?index+1:0,rowItems:cards.length,longRail:track?.dataset?.longRail||'',loaded:Number(track?.dataset?.longRailLoaded||0),total:Number(track?.dataset?.longRailTotal||0)};
}
function tvDiagRecord(type,data={}){
  if(!NATIVE_ANDROID||(!tvHardwareTestMode&&!['error','rejection','renderer'].includes(type)))return;
  const event={t:Date.now(),ms:Math.round(performance.now()),type,page:state?.page||'',test:tvHardwareCurrentTest||'',...data};
  tvDiagnosticEvents.push(event);if(tvDiagnosticEvents.length>TV_DIAGNOSTIC_MAX_EVENTS)tvDiagnosticEvents.splice(0,tvDiagnosticEvents.length-TV_DIAGNOSTIC_MAX_EVENTS);
  if(tvHardwareTestMode&&!tvDiagnosticPersistTimer){tvDiagnosticPersistTimer=setTimeout(()=>{tvDiagnosticPersistTimer=0;try{localStorage.setItem('swoop-tv-hardware-test-events',JSON.stringify(tvDiagnosticEvents.slice(-120)))}catch{}},1000)}
}
function tvDiagnosticPending(){return {mediaRequests:mediaRailRequests.size,liveRequests:liveRailRequests.size,starmeterPending:starmeterHydratePending.size,verticalQueue:tvVerticalQueue,catalogWorkerPending:tvCatalogWorkerPending.size,guideRequests:guideChannelRequests?.size||0};}
function tvDiagnosticSnapshotSync(){
  const active=(document.activeElement&&document.activeElement!==document.body)?document.activeElement:tvLastFocusedElement,focus=tvDiagnosticElement(active),mem=performance?.memory||null;
  const seed=installSeedCache?{sourceVersion:String(installSeedCache.sourceVersion||''),builtAt:String(installSeedCache.builtAt||''),ageHours:Math.round(installSeedAgeHours(installSeedCache)*10)/10,fresh:installSeedFresh(installSeedCache),people:Number(installSeedCache?.starmeter?.people?.length||0),titles:Number(installSeedCache?.titleMetadata?.length||0),discovery:Object.keys(installSeedCache?.discovery||{})}:null;return {version:ANDROID_CURRENT_VERSION,at:new Date().toISOString(),page:state?.page||'',test:tvHardwareCurrentTest||'',focus,scrollY:Math.round(window.scrollY||document.documentElement.scrollTop||0),viewport:{width:innerWidth,height:innerHeight,density:document.documentElement.dataset.tvDensity||''},dom:{nodes:document.getElementsByTagName('*').length,buttons:document.querySelectorAll('button').length,cards:document.querySelectorAll('.card,.live-rail-card').length,images:document.images.length},pending:tvDiagnosticPending(),seed,modal:modal||'',detail:Boolean(detailItem),person:Boolean(personView),livePreview:{active:livePreviewActive,itemId:livePreviewItemId},jsHeap:mem?{used:mem.usedJSHeapSize,total:mem.totalJSHeapSize,limit:mem.jsHeapSizeLimit}:null,native:tvHardwareNativeSnapshot,events:[...tvDiagnosticEvents]};
}
async function tvRefreshNativeDiagnostics(){if(!NATIVE_ANDROID||Date.now()-tvHardwareNativePollAt<2800)return;tvHardwareNativePollAt=Date.now();try{tvHardwareNativeSnapshot=await nativeDiagnostics()||{}}catch{}}
function updateTvHardwareOverlay(){
  if(!tvHardwareTestMode){document.querySelector('#tvHardwareOverlay')?.remove();return}
  let el=document.querySelector('#tvHardwareOverlay');if(!el){el=document.createElement('div');el.id='tvHardwareOverlay';el.className='tv-hardware-overlay';el.setAttribute('aria-hidden','true');document.body.appendChild(el)}
  tvRefreshNativeDiagnostics();const snap=tvDiagnosticSnapshotSync(),f=snap.focus||{},p=snap.pending||{},n=snap.native||{},row=f.row?`${f.row} ${f.index||'-'}/${f.rowItems||'-'}`:'none',heap=snap.jsHeap?`${Math.round(snap.jsHeap.used/1048576)}MB`:'n/a';
  const seed=snap.seed;el.innerHTML=`<b>HW TEST · v${esc(ANDROID_CURRENT_VERSION)}${snap.test?` · ${esc(snap.test)}`:''}</b><span>${esc(snap.page)} · focus ${esc(row)}</span><span>scroll ${snap.scrollY} · DOM ${snap.dom.nodes} · cards ${snap.dom.cards} · img ${snap.dom.images}</span><span>pending M${p.mediaRequests}/L${p.liveRequests}/S${p.starmeterPending} · ↑↓ ${p.verticalQueue} · JS ${heap}</span>${seed?`<span>seed ${seed.ageHours}h · P${seed.people}/T${seed.titles} · ${seed.discovery.join('+')||'static'}</span>`:''}<span>renderer resets ${Number(n.rendererGoneCount||0)} · keys ${Number(n.nativeKeyEventCount||0)}</span>`;
}
function ensureTvHardwareOverlay(){if(!NATIVE_ANDROID)return;if(tvHardwareTestMode){updateTvHardwareOverlay();if(!tvHardwareOverlayTimer)tvHardwareOverlayTimer=setInterval(updateTvHardwareOverlay,1200)}else{document.querySelector('#tvHardwareOverlay')?.remove();if(tvHardwareOverlayTimer){clearInterval(tvHardwareOverlayTimer);tvHardwareOverlayTimer=0}}}
function setTvHardwareTestMode(enabled){const was=tvHardwareTestMode;tvHardwareTestMode=Boolean(enabled);if(tvHardwareTestMode&&!was){tvDiagnosticEvents.length=0;try{localStorage.removeItem('swoop-tv-hardware-test-events')}catch{}}try{localStorage.setItem('swoop-tv-hardware-test-mode',tvHardwareTestMode?'1':'0')}catch{}tvDiagRecord('hardware-mode',{enabled:tvHardwareTestMode});ensureTvHardwareOverlay();if(state.page==='settings')setTimeout(render,0)}
function noteTvHardwareSettingsTap(){if(!NATIVE_ANDROID)return false;const now=performance.now();if(now-tvHardwareSettingsTapAt>4000)tvHardwareSettingsTapCount=0;tvHardwareSettingsTapAt=now;tvHardwareSettingsTapCount++;if(tvHardwareSettingsTapCount<5)return false;tvHardwareSettingsTapCount=0;setTvHardwareTestMode(!tvHardwareTestMode);toast(tvHardwareTestMode?'Hardware Test Mode enabled':'Hardware Test Mode disabled');return true}
function setTvHardwareTest(id=''){tvHardwareCurrentTest=String(id||'');try{localStorage.setItem('swoop-tv-hardware-test-id',tvHardwareCurrentTest);localStorage.removeItem('swoop-tv-hardware-test-events')}catch{}tvDiagnosticEvents.length=0;nativeClearDiagnostics().catch(()=>null);tvHardwareNativeSnapshot={};tvHardwareNativePollAt=0;tvDiagRecord('test-start',{id:tvHardwareCurrentTest});ensureTvHardwareOverlay();toast(tvHardwareCurrentTest?`${tvHardwareCurrentTest} diagnostics started`:'Free-run diagnostics started')}
async function exportTvHardwareDiagnostics(){
  if(!NATIVE_ANDROID)return;try{tvHardwareNativeSnapshot=await nativeDiagnostics()||tvHardwareNativeSnapshot}catch{}
  const payload=tvDiagnosticSnapshotSync();payload.hardwareTests=TV_HARDWARE_TESTS;payload.lastRuntimeError=(()=>{try{return JSON.parse(sessionStorage.getItem('swoop-tv-last-runtime-error')||'null')}catch{return null}})();
  const result=await nativeSaveDiagnostics(payload);if(result?.ok){tvLastDiagnosticsPath=String(result.path||'');toast(`Diagnostics saved · ${tvLastDiagnosticsPath.split('/').pop()}`);tvDiagRecord('export',{path:tvLastDiagnosticsPath,bytes:Number(result.bytes||0)});if(state.page==='settings')render()}else toast(result?.error||'Could not save diagnostics');
}
function clearTvHardwareDiagnostics(){tvDiagnosticEvents.length=0;try{localStorage.removeItem('swoop-tv-hardware-test-events')}catch{}nativeClearDiagnostics().catch(()=>null);tvHardwareNativeSnapshot={};tvHardwareNativePollAt=0;tvDiagRecord('log-cleared');toast('Hardware diagnostic log cleared')}
if(NATIVE_ANDROID&&typeof PerformanceObserver!=='undefined'){
  try{const obs=new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.duration>=50)tvDiagRecord('longtask',{duration:Math.round(e.duration),start:Math.round(e.startTime)})});obs.observe({entryTypes:['longtask']})}catch{}
}
const mediaProviderCategoryCache={
  movie:{key:'',items:[],loadedAt:0,loading:null,loadingKey:''},
  series:{key:'',items:[],loadedAt:0,loading:null,loadingKey:''}
};
let guideStart=Math.floor(Date.now()/1800000)*1800000;
const epgCache=new Map();
let epgDurableRestored=false,epgDurableRestorePromise=null;
async function restoreDurableEpgCache(){
  if(!NATIVE_ANDROID||epgDurableRestored)return true;
  if(epgDurableRestorePromise)return epgDurableRestorePromise;
  epgDurableRestorePromise=(async()=>{try{
    const saved=await loadEpgCache();
    const rows=Array.isArray(saved?.entries)?saved.entries:[];
    for(const row of rows){if(!row||!row[0]||!row[1])continue;epgCache.set(String(row[0]),row[1]);}
    epgDurableRestored=true;return Boolean(rows.length);
  }catch{epgDurableRestored=true;return false}finally{epgDurableRestorePromise=null}})();
  return epgDurableRestorePromise;
}
function persistDurableEpgCache(){
  if(!NATIVE_ANDROID||!epgCache.size)return Promise.resolve(false);
  const cutoff=Date.now()-24*60*60*1000,entries=[];
  for(const [id,value] of epgCache){if(!value||Number(value.loadedAt||0)<cutoff)continue;entries.push([id,{loadedAt:Number(value.loadedAt||0),list:Array.isArray(value.list)?value.list:[]}]);}
  return saveEpgCache({schema:1,savedAt:Date.now(),entries});
}

const EPG_TTL_MS=NATIVE_ANDROID?6*60*60*1000:5*60*1000;
const guideChannelCache={key:'',items:[],total:0};
const guideChannelRequests=new Map();
const m3uGuideTextCache=new Map();
const xtreamGuideTextCache=new Map();
const guideProviderCategoryCache={key:'',names:[],loadedAt:0,loading:null};
let guideLoading=false,guideError='',guideLoadToken=0;
const sessionProviderConfigs=new Map();
function isLegacyDemoProvider(p={}){const text=`${p.url||''} ${p.server||''} ${p.epgUrl||''}`;return /(?:^|\/)\/?(?:www\.)?example\.com(?:[\/:]|$)/i.test(text)}
function providerExpiryMs(value){const raw=String(value??'').trim();if(!raw||raw==='0'||/^null$/i.test(raw))return 0;const numeric=Number(raw);if(Number.isFinite(numeric)&&numeric>0)return numeric>1e12?Math.trunc(numeric):Math.trunc(numeric*1000);const parsed=Date.parse(raw);return Number.isFinite(parsed)&&parsed>0?parsed:0}
function providerExpiryFromProfile(profile={}){const raw=profile?.user_info?.exp_date??profile?.user_info?.expires_at??profile?.user_info?.expiration??'';return providerExpiryMs(raw)}
function providerExpiryLabel(provider={}){if(provider.expiryNever)return'No expiry';const ms=providerExpiryMs(provider.expiresAt);if(!ms)return'Not provided';return new Date(ms).toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'})}
function providerProfileId(p={},fallback=''){if(p.id)return String(p.id);if(p.type==='m3u')return `m3u-${Math.abs(hash(String(p.url||p.name||fallback)))}`;return `xtream-${Math.abs(hash(`${p.server||''}|${p.username||''}`))}`}
for(const p of savedProviderProfiles){const id=providerProfileId(p);if(id)sessionProviderConfigs.set(id,{...p,id});}
function providerById(id=''){return state.providers.find(p=>p.id===id)||null}
function providerConfigById(id=''){const session=sessionProviderConfigs.get(id);if(session)return session;const saved=savedProviderProfiles.find(p=>providerProfileId(p)===id);if(saved)return saved;const p=providerById(id);return p?{...p}:null}
function providerConfigFor(itemOrId){const id=typeof itemOrId==='string'?itemOrId:itemOrId?.providerId;return providerConfigById(id)||providerConfigById(state.provider?.id)||{};}
function providerDisplayName(itemOrId){const id=typeof itemOrId==='string'?itemOrId:itemOrId?.providerId;return providerById(id)?.name||'TV Provider'}
function enabledProviders(){return state.providers.filter(p=>p.enabled!==false&&!isLegacyDemoProvider(p)).sort((a,b)=>Number(a.priority)-Number(b.priority))}
function providerSummaryName(){const list=enabledProviders();if(list.length>1)return `${list.length} Providers`;if(list.length===1)return list[0].name;return state.providers.length?'No Providers Enabled':'Your Library'}
function providerCatalogCounts(id){if(nativeCatalogMode&&nativeCatalogStats)return nativeProviderCounts(id);const list=state.catalog.filter(x=>x.providerId===id&&!isDemoItem(x));return {live:list.filter(x=>x.kind==='live').length,movie:list.filter(x=>x.kind==='movie').length,series:list.filter(x=>x.kind==='series').length,total:list.length}}
function syncProviderCounts(){for(const p of state.providers)p.counts=providerCatalogCounts(p.id)}
let sessionRelay={url:state.settings.xtreamRelayUrl||state.provider?.relayUrl||savedProviderProfile?.relayUrl||'',token:state.settings.xtreamRelayToken||state.provider?.relayToken||savedProviderProfile?.relayToken||''};
let sessionXtream=providerConfigById(state.provider?.id)||{server:'',username:'',password:'',relayUrl:'',relayToken:''};
let storageRestoring=false;
let startupRefreshActive=false;
let startupRefreshState={progress:2,title:'Updating your TV library…',detail:'Getting your TV library ready.',provider:'',summary:''};
let libraryRestored=Boolean(state.catalog.length&&!tvHomeSnapshotActive);
let libraryRestorePromise=null;
const artworkCache=new Map();
const artworkPrewarmPool=new Map();
const artworkRelayQueue=[]; let artworkRelayActive=0;
let artworkObserver=null;
let detailReturnScroll=0,detailScrollTop=0;
const $app=document.querySelector('#app');

function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function hash(s=''){let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h)+s.charCodeAt(i)|0;return h}
function clearPersistentPageViews(pages=null){
  const targets=pages==null?[...persistentPageViews.keys()]:Array.isArray(pages)?pages:[pages];
  for(const page of targets){const snap=persistentPageViews.get(page);if(snap?.main?.remove)snap.main.remove();persistentPageViews.delete(page)}
}
function cacheCurrentPageView(){
  if(profilePickerOpen||startupRefreshActive||storageRestoring||detailItem||personView||modal||!PERSISTENT_PAGE_IDS.has(state.page))return false;
  if(NATIVE_ANDROID&&ANDROID_HEAVY_NONPERSISTENT_PAGES.has(state.page)){starmeterObserver?.disconnect?.();starmeterObserver=null;starmeterAutoLoadObserver?.disconnect?.();starmeterAutoLoadObserver=null;return false;}
  const shell=$app?.querySelector?.('.app-shell'),main=shell?.querySelector?.(':scope > main');if(!shell||!main)return false;
  const prior=persistentPageViews.get(state.page);if(prior?.main&&prior.main!==main)prior.main.remove?.();
  persistentPageViews.set(state.page,{main,scrollY:window.scrollY||document.documentElement.scrollTop||0,savedAt:Date.now()});
  if(state.page==='home'&&heroRotationTimer){clearInterval(heroRotationTimer);heroRotationTimer=null}
  lazyHomeObserver?.disconnect?.();lazyHomeObserver=null;artworkObserver?.disconnect?.();artworkObserver=null;visibleMetadataObserver?.disconnect?.();visibleMetadataObserver=null;
  main.remove();return true;
}
function updateCachedNavState(page=state.page){
  document.querySelectorAll('.desktop-nav [data-page],.bottom-nav [data-page],.top-actions [data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
}
function resumePageWork(page,root=document){
  hydrateArtwork(root);hydrateVisibleImdbRatings(root);bindRailStability(root);
  if(page==='home'){mountLazyHomeRows(root);scheduleHeroRotation();if(nativeCatalogMode)setTimeout(primeNativeHomeRows,80);if(!androidFastHomeMode())setTimeout(()=>refreshDiscoveryRows(false),1800);}
  else if(page==='live')setTimeout(()=>{primeLiveCategoryRails();setupLiveCategoryAutoLoad()},40);
  else if(page==='movies')setTimeout(()=>primeMediaCategoryRails('movie'),40);
  else if(page==='series')setTimeout(()=>primeMediaCategoryRails('series'),40);
  else if(page==='starmeter')setTimeout(()=>{observeStarmeterSections(root);setupStarmeterAutoLoad()},40);
  else if(page==='guide')setTimeout(()=>loadGuideEpg(),250);
  if(state.catalog.length)setTimeout(scheduleMetadataEnrichment,450);
}
function restorePersistentPageView(page){
  const snap=persistentPageViews.get(page);if(!snap?.main)return false;
  persistentPageViews.delete(page);
  const shell=$app?.querySelector?.('.app-shell');if(!shell)return false;
  const current=shell.querySelector(':scope > main');current?.remove?.();
  const overlay=[...shell.children].find(el=>el!==snap.main&&(el.matches?.('.modal-backdrop,.source-choice-shell,.player-shell,.trailer-shell,.task-progress-hud')));
  if(overlay)shell.insertBefore(snap.main,overlay);else shell.appendChild(snap.main);
  applyTheme();updateCachedNavState(page);bind();bindHeroControls(document);resumePageWork(page,snap.main);
  requestAnimationFrame(()=>{window.scrollTo(0,snap.scrollY||0);requestAnimationFrame(()=>window.scrollTo(0,snap.scrollY||0))});
  return true;
}
function discardTransientMediaRoutes(){
  personOpenToken++;resetPersonState();detailItem=null;detailPayload=null;detailLoading=false;detailError='';detailSeason='';detailEpisodeItems.clear();detailScrollTop=0;personScrollTop=0;
  suspendedBaseView=null;suspendedDetailView=null;suspendedPersonView=null;sourceChoiceItem=null;tvVerticalQueue=0;if(tvVerticalFrame){cancelAnimationFrame(tvVerticalFrame);tvVerticalFrame=0}
}
function navigatePage(nextPage){
  nextPage=String(nextPage||'home');if(nextPage==='mylist')nextPage='myswoop';if(NATIVE_ANDROID)tvDiagRecord('route',{from:state.page,to:nextPage,detail:Boolean(detailItem),person:Boolean(personView)});
  if(nextPage!=='starmeter'){cancelStarmeterWork();}
  if(NATIVE_ANDROID&&nextPage!=='live')stopLiveHeroPreview();
  if(nextPage===state.page&&!detailItem&&!personView)return;
  if(detailItem||personView)discardTransientMediaRoutes();
  if(profilePickerOpen||startupRefreshActive||storageRestoring){state.page=nextPage;if(nextPage==='guide')guideStart=Math.floor(Date.now()/1800000)*1800000;render();return}
  cacheCurrentPageView();state.page=nextPage;if(nextPage==='guide'){guideStart=Math.floor(Date.now()/1800000)*1800000;clearPersistentPageViews('guide')}
  if(restorePersistentPageView(nextPage))return;render();
  if(NATIVE_ANDROID&&nextPage==='guide')requestAnimationFrame(()=>{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;requestAnimationFrame(()=>window.scrollTo(0,0))});
}
function artworkWarmEntry(url,size='w342'){
  const raw=String(url||'').trim();if(!raw)return'';
  return /image\.tmdb\.org\/t\/p\//i.test(raw)?raw.replace(/\/t\/p\/(?:original|w\d+)\//i,`/t/p/${size}/`):raw;
}
function rememberArtworkPrewarm(url){
  if(!url||artworkPrewarmPool.has(url))return;
  try{const img=new Image();img.decoding='async';img.onload=img.onerror=()=>{const hit=artworkPrewarmPool.get(url);if(hit)hit.loadedAt=Date.now()};img.src=url;artworkPrewarmPool.set(url,{img,loadedAt:0});while(artworkPrewarmPool.size>260)artworkPrewarmPool.delete(artworkPrewarmPool.keys().next().value)}catch{}
}
function prewarmArtworkUrls(items=[],limit=28){
  const urls=[];for(const raw of items){const item=visualItem(raw||{});for(const [value,size] of [[item?.logo,'w342'],[item?.backdrop,'w1280'],[item?.titleLogo,'w500']]){const url=artworkWarmEntry(value,size);if(url&&!urls.includes(url))urls.push(url);if(urls.length>=limit)break}if(urls.length>=limit)break}
  for(const url of urls){if(location.protocol==='https:'&&/^http:\/\//i.test(url)&&canRelayArtwork()){relayArtworkUrl(url,'normal').catch(()=>null);continue}rememberArtworkPrewarm(url)}
}
async function preloadCriticalArtwork(items=[],limit=36,timeoutMs=4200){
  const urls=[];for(const raw of items){const item=visualItem(raw||{});for(const [value,size] of [[item?.backdrop,'w1280'],[item?.logo,'w342'],[item?.titleLogo,'w500']]){const url=artworkWarmEntry(value,size);if(url&&!urls.includes(url))urls.push(url);if(urls.length>=limit)break}if(urls.length>=limit)break}
  if(!urls.length)return;
  let timer=null;const all=Promise.all(urls.map(url=>new Promise(resolve=>{try{if(artworkPrewarmPool.has(url)){resolve();return}const img=new Image();let done=false;const finish=()=>{if(done)return;done=true;artworkPrewarmPool.set(url,{img,loadedAt:Date.now()});resolve()};img.onload=()=>{if(typeof img.decode==='function')img.decode().then(finish).catch(finish);else finish()};img.onerror=finish;img.decoding='async';img.src=url;if(img.complete)finish();setTimeout(finish,timeoutMs)}catch{resolve()}})));
  await Promise.race([all,new Promise(resolve=>{timer=setTimeout(resolve,timeoutMs)})]);if(timer)clearTimeout(timer);
}
async function prewarmAndroidEntryArtwork(timeoutMs=1800){
  if(!NATIVE_ANDROID||!state.catalog.length)return;const warm=[];const feature=featureItem();if(feature)warm.push(feature);for(const def of selectedHomeRows().slice(0,5))warm.push(...homeRowItems(def.id).slice(0,14));await preloadCriticalArtwork(warm,72,timeoutMs);prewarmArtworkUrls(warm,96);
}
async function warmBrowseTabs(){
  if(browseWarmupRunning||!nativeCatalogMode||startupRefreshActive||storageRestoring||!state.catalog.length)return;
  browseWarmupRunning=true;
  try{
    await Promise.allSettled([ensureMediaProviderCategoryOrder('movie'),ensureMediaProviderCategoryOrder('series'),ensureGuideProviderCategoryOrder()]);
    const movieCats=mediaRailCategories('movie').slice(0,6).map(x=>x.name).filter(Boolean),seriesCats=mediaRailCategories('series').slice(0,6).map(x=>x.name).filter(Boolean),liveCats=liveRailCategories().slice(0,5).map(x=>x.name).filter(Boolean);
    const jobs=[...movieCats.map(name=>()=>ensureMediaCategoryRail('movie',name)),...seriesCats.map(name=>()=>ensureMediaCategoryRail('series',name)),...liveCats.map(name=>()=>ensureLiveCategoryRail(name))];
    let cursor=0;async function worker(){while(cursor<jobs.length){const job=jobs[cursor++];try{await job()}catch{}}}
    await Promise.all(Array.from({length:Math.min(5,jobs.length)},worker));
    const warmItems=[];for(const name of movieCats){const snap=mediaRailSnapshot('movie',name);warmItems.push(...(snap.items||[]).slice(0,6))}for(const name of seriesCats){const snap=mediaRailSnapshot('series',name);warmItems.push(...(snap.items||[]).slice(0,6))}for(const name of liveCats){const snap=liveRailSnapshot(name);warmItems.push(...(snap.items||[]).slice(0,4))}prewarmArtworkUrls(warmItems,42);
  }finally{browseWarmupRunning=false}
}
function scheduleBrowseWarmup(delay=900){if(browseWarmupTimer)clearTimeout(browseWarmupTimer);browseWarmupTimer=setTimeout(()=>{browseWarmupTimer=null;warmBrowseTabs().catch(()=>null)},delay)}
function suspendBaseViewForDetail(){
  // Callers such as People Search need a truthful success/failure signal.  The
  // old helper detached the current page but returned undefined, so openPerson()
  // interpreted a successful detach as failure and exited before rendering the
  // person route — leaving the app container completely black.
  if(suspendedBaseView||detailItem||!$app?.firstElementChild)return false;
  const shell=$app.firstElementChild,active=document.activeElement;
  suspendedBaseView={shell,page:state.page,scrollY:window.scrollY||document.documentElement.scrollTop||0,focusDetail:active?.dataset?.detail||'',focusPlay:active?.dataset?.play||'',focusPerson:active?.dataset?.personName||''};
  lazyHomeObserver?.disconnect?.();lazyHomeObserver=null;
  artworkObserver?.disconnect?.();artworkObserver=null;
  visibleMetadataObserver?.disconnect?.();visibleMetadataObserver=null;
  try{$app.removeChild(shell);return true}catch{ suspendedBaseView=null;return false }
}
function restoreSuspendedBaseView(){
  const snap=suspendedBaseView;suspendedBaseView=null;
  if(!snap||snap.page!==state.page||!snap.shell)return false;
  artworkObserver?.disconnect?.();artworkObserver=null;visibleMetadataObserver?.disconnect?.();visibleMetadataObserver=null;starmeterObserver?.disconnect?.();starmeterObserver=null;lazyHomeObserver?.disconnect?.();lazyHomeObserver=null;
  $app.replaceChildren(snap.shell);applyTheme();bind();bindHeroControls(document);hydrateArtwork(document);
  const restore=()=>{window.scrollTo(0,snap.scrollY||0);if(state.page==='home'){mountLazyHomeRows(document);scheduleHeroRotation();if(nativeCatalogMode)setTimeout(primeNativeHomeRows,180);if(!androidFastHomeMode())setTimeout(()=>refreshDiscoveryRows(false),1500);}if(!profilePickerOpen&&state.catalog.length)setTimeout(scheduleMetadataEnrichment,600);const target=[...document.querySelectorAll('[data-detail],[data-play],[data-person-name]')].find(el=>(snap.focusDetail&&el.dataset.detail===snap.focusDetail)||(snap.focusPlay&&el.dataset.play===snap.focusPlay)||(snap.focusPerson&&el.dataset.personName===snap.focusPerson));target?.focus?.({preventScroll:true});};
  requestAnimationFrame(()=>{restore();requestAnimationFrame(()=>window.scrollTo(0,snap.scrollY||0))});
  return true;
}
function clearSuspendedBaseView(){suspendedBaseView=null}
function suspendDetailViewForPerson(){
  if(suspendedDetailView||!detailItem||!$app?.firstElementChild)return false;
  const shell=$app.firstElementChild,active=document.activeElement,scroll=document.querySelector('.detail-scroll');
  suspendedDetailView={shell,scrollTop:scroll?.scrollTop||detailScrollTop||0,focusPerson:active?.dataset?.personName||''};
  artworkObserver?.disconnect?.();artworkObserver=null;visibleMetadataObserver?.disconnect?.();visibleMetadataObserver=null;
  $app.removeChild(shell);return true;
}
function restoreSuspendedDetailView(){
  const snap=suspendedDetailView;suspendedDetailView=null;if(!snap?.shell)return false;
  artworkObserver?.disconnect?.();artworkObserver=null;visibleMetadataObserver?.disconnect?.();visibleMetadataObserver=null;
  $app.replaceChildren(snap.shell);applyTheme();bind();bindHeroControls(document);hydrateArtwork(document);
  const scroll=document.querySelector('.detail-scroll');if(scroll)scroll.scrollTop=snap.scrollTop||0;detailScrollTop=snap.scrollTop||0;
  requestAnimationFrame(()=>{const target=[...document.querySelectorAll('[data-person-name]')].find(x=>x.dataset.personName===snap.focusPerson);target?.focus?.({preventScroll:true});});
  return true;
}
function resetPersonState(){personView=null;personLoading=false;personError='';personMovies=[];personShows=[];personProgress=0;personStatus='';personScrollTop=0}
function suspendPersonViewForDetail(){
  if(suspendedPersonView||!personView||!$app?.firstElementChild)return false;
  const shell=$app.firstElementChild,scroll=document.querySelector('.person-scroll');
  suspendedPersonView={shell,scrollTop:scroll?.scrollTop||personScrollTop||0,personView:{...personView},personLoading,personError,personMovies:[...personMovies],personShows:[...personShows],personProgress,personStatus,underlyingDetail:{item:detailItem,payload:detailPayload,loading:detailLoading,error:detailError,season:detailSeason,scrollTop:detailScrollTop,episodeItems:[...detailEpisodeItems.entries()]}};
  artworkObserver?.disconnect?.();artworkObserver=null;visibleMetadataObserver?.disconnect?.();visibleMetadataObserver=null;
  $app.removeChild(shell);return true;
}
function restoreSuspendedPersonView(){
  const snap=suspendedPersonView;suspendedPersonView=null;if(!snap?.shell)return false;
  detailItem=snap.underlyingDetail?.item||detailItem;detailPayload=snap.underlyingDetail?.payload||null;detailLoading=Boolean(snap.underlyingDetail?.loading);detailError=snap.underlyingDetail?.error||'';detailSeason=snap.underlyingDetail?.season||'';detailScrollTop=Number(snap.underlyingDetail?.scrollTop||0);detailEpisodeItems.clear();for(const [id,item] of (snap.underlyingDetail?.episodeItems||[]))detailEpisodeItems.set(id,item);
  personView=snap.personView;personLoading=snap.personLoading;personError=snap.personError;personMovies=snap.personMovies;personShows=snap.personShows;personProgress=snap.personProgress;personStatus=snap.personStatus;personScrollTop=snap.scrollTop||0;
  artworkObserver?.disconnect?.();artworkObserver=null;visibleMetadataObserver?.disconnect?.();visibleMetadataObserver=null;
  $app.replaceChildren(snap.shell);applyTheme();bind();bindHeroControls(document);hydrateArtwork(document);
  const scroll=document.querySelector('.person-scroll');if(scroll)scroll.scrollTop=personScrollTop;
  return true;
}
let activeCatalogSourceRef=null,activeCatalogContext='',activeCatalogCache=[],metadataRevision=0;
function activeCatalog(){
  const source=state.catalog,profile=activeProfile(),enabledKey=state.providers.length?enabledProviders().map(p=>p.id).join('|'):'none',context=`${enabledKey}|${profile?.kids?`${profile.id}:${metadataRevision}`:'standard'}`;
  if(activeCatalogSourceRef===source&&activeCatalogContext===context)return activeCatalogCache;
  let base=source.filter(item=>!isDemoItem(item));
  if(state.catalog.length&&state.providers.length){const enabled=new Set(enabledProviders().map(p=>p.id));base=base.filter(item=>!item.providerId||enabled.has(item.providerId));}
  activeCatalogCache=profile?.kids?base.filter(item=>profileAllowsMedia(profile,item,state.metadataCache?.[item.id]||{})):base;
  activeCatalogSourceRef=source;activeCatalogContext=context;return activeCatalogCache;
}
let movieStackCatalogRef=null,movieStackIndex=null,liveStackCatalogRef=null,liveStackIndex=null,movieStackPriorityKey='',liveStackPriorityKey='';
function getMovieStackIndex(){const catalog=activeCatalog(),priorityKey=state.providers.map(p=>`${p.id}:${p.priority}`).join('|');if(movieStackCatalogRef!==catalog||movieStackPriorityKey!==priorityKey||!movieStackIndex){movieStackCatalogRef=catalog;movieStackPriorityKey=priorityKey;movieStackIndex=buildMovieStackIndex(catalog,providerPriorityMap())}return movieStackIndex}
function providerPriorityMap(){return Object.fromEntries(state.providers.map((p,i)=>[p.id,Number.isFinite(Number(p.priority))?Number(p.priority):i]))}
function getLiveStackIndex(){const catalog=activeCatalog(),priorityKey=state.providers.map(p=>`${p.id}:${p.priority}`).join('|');if(liveStackCatalogRef!==catalog||liveStackPriorityKey!==priorityKey||!liveStackIndex){liveStackCatalogRef=catalog;liveStackPriorityKey=priorityKey;liveStackIndex=buildLiveStackIndex(catalog,providerPriorityMap())}return liveStackIndex}
function resetMovieStackIndex(){activeCatalogSourceRef=null;activeCatalogContext='';activeCatalogCache=[];resetAndroidFastCatalog();movieStackCatalogRef=null;movieStackIndex=null;movieStackPriorityKey='';liveStackCatalogRef=null;liveStackIndex=null;liveStackPriorityKey='';searchIndexKey='';searchIndexCache=[];clearPersistentPageViews();if(typeof nativeHomeRowCache!=='undefined')nativeHomeRowCache.clear();if(typeof liveRailCache!=='undefined')liveRailCache.clear();if(typeof liveRailRenderLimits!=='undefined')liveRailRenderLimits.clear();if(typeof mediaRailCache!=='undefined')mediaRailCache.clear();if(typeof mediaRailRenderLimits!=='undefined')mediaRailRenderLimits.clear();if(typeof mediaRailBrowserFullCache!=='undefined')mediaRailBrowserFullCache.clear();for(const kind of ['movie','series'])if(typeof mediaProviderCategoryCache!=='undefined'&&mediaProviderCategoryCache[kind]){mediaProviderCategoryCache[kind].key='';mediaProviderCategoryCache[kind].items=[];mediaProviderCategoryCache[kind].loadedAt=0;mediaProviderCategoryCache[kind].loadingKey=''}for(const k of ['movie','series','live'])if(nativePageCache?.[k]){nativePageCache[k].key='';nativePageCache[k].items=[];nativePageCache[k].total=0}}
function items(kind){if(NATIVE_ANDROID&&!nativeCatalogMode&&catalogLogicalTotal()>=LARGE_LIBRARY_THRESHOLD)return tvFastItems(kind);if(kind==='movie')return getMovieStackIndex().stacked;if(kind==='live')return getLiveStackIndex().stacked;return activeCatalog().filter(x=>x.kind===kind)}
function preferredLiveSource(item){if(item?.kind!=='live')return item;if(providerFilter!=='all'&&Array.isArray(item.sources)){const filtered=item.sources.filter(s=>s.providerId===providerFilter);if(filtered.length)return selectLiveSource({...item,sources:filtered},providerPriorityMap())}return selectLiveSource(item,providerPriorityMap())}
function logicalItemIds(item){
  if(!item)return[];
  return [...new Set([
    item.id,
    item._nativeSourceId,
    ...(Array.isArray(item._nativeSourceIds)?item._nativeSourceIds:[]),
    ...(Array.isArray(item.sources)?item.sources.map(x=>x.id):[])
  ].filter(Boolean).map(String))];
}
function isLiveFavourite(item){return Boolean(item?.id&&state.liveFavourites.includes(item.id))}
function toggleLiveFavourite(item){if(!item?.id||item.kind!=='live')return;const on=isLiveFavourite(item);state.liveFavourites=on?state.liveFavourites.filter(id=>id!==item.id):[item.id,...state.liveFavourites.filter(id=>id!==item.id)].slice(0,120);persist();toast(on?'Removed from Favourite Channels':'Added to Favourite Channels');render()}
function savedMovieSourcePreference(item){return item?.id?String(state.settings.movieSourcePreferences?.[item.id]||''):''}
function rememberMovieSourcePreference(item,sourceId){if(!item?.id||!sourceId)return;state.settings.movieSourcePreferences={...(state.settings.movieSourcePreferences||{}),[item.id]:sourceId};persist()}
function orderedMovieSources(item){if(!item||!Array.isArray(item.sources))return[];const preferred=savedMovieSourcePreference(item)||continueEntry(item.id)?.selectedSourceId||'';return rankSources(item.sources,preferred)}
function sourceTechSummary(source){const t=sourceTraits(source);return [t.quality,t.hdr,t.codec,t.audio].filter(Boolean).join(' · ')||'Provider default'}
function isInMyList(item){if(!item)return false;const ids=new Set(logicalItemIds(item));return state.myList.some(id=>ids.has(id))}
function continueEntry(id){if(androidFastHomeMode()){const direct=state.continueWatching.find(x=>String(x?.id||'')===String(id||''));if(direct)return direct}const item=savedItem(id),ids=new Set(item?logicalItemIds(item):[id]);return state.continueWatching.find(x=>ids.has(x?.id))}
function savedItem(id){const nativeHit=nativeItemCache.get(id);if(nativeHit)return isDemoItem(nativeHit)?null:nativeHit;if(NATIVE_ANDROID&&!nativeCatalogMode&&catalogLogicalTotal()>=LARGE_LIBRARY_THRESHOLD){const fast=androidFastSavedItem(id);if(fast)return isDemoItem(fast)?null:fast}const stack=getMovieStackIndex(),live=getLiveStackIndex(),found=stack.byStackId.get(id)||stack.bySourceId.get(id)||live.byStackId?.get(id)||live.bySourceId?.get(id)||activeCatalog().find(x=>x.id===id)||detailEpisodeItems.get(id)||state.continueWatching.find(x=>x?.id===id)?.item||null;return isDemoItem(found)?null:found}
function isDemoId(value){return /^demo(?::|$)/i.test(String(value||''))}
function isDemoItem(item){const url=String(item?.streamUrl||'');return Boolean(item&&(item.source==='demo'||item.providerId==='demo'||isDemoId(item.id)||/(?:^|\/)\/?(?:www\.)?example\.com(?:[\/:]|$)/i.test(url)))}
function sanitizeLegacyDemoRefs(target={}){
  const keepRef=value=>!isDemoId(typeof value==='string'?value:value?.id)&&!isDemoItem(value?.item||((value&&typeof value==='object')?value:null));
  for(const key of ['myList','favourites','liveFavourites','recentLive'])if(Array.isArray(target[key]))target[key]=target[key].filter(keepRef);
  for(const key of ['continueWatching','watchHistory'])if(Array.isArray(target[key]))target[key]=target[key].filter(keepRef);
  if(Array.isArray(target.catalog))target.catalog=target.catalog.filter(item=>!isDemoItem(item));
  if(Array.isArray(target.mdblistRows))for(const row of target.mdblistRows)if(Array.isArray(row?.items))row.items=row.items.filter(item=>!isDemoItem(item));
  if(target.webDiscovery&&typeof target.webDiscovery==='object')for(const cache of Object.values(target.webDiscovery)){if(Array.isArray(cache?.itemIds))cache.itemIds=cache.itemIds.filter(id=>!isDemoId(id));if(Array.isArray(cache?.items))cache.items=cache.items.filter(item=>!isDemoItem(item));}
  if(target.metadataCache&&typeof target.metadataCache==='object')for(const id of Object.keys(target.metadataCache))if(isDemoId(id))delete target.metadataCache[id];
  const prefs=target.profileSettings?.movieSourcePreferences||target.settings?.movieSourcePreferences;if(prefs&&typeof prefs==='object')for(const id of Object.keys(prefs))if(isDemoId(id))delete prefs[id];
  return target;
}
function visualItem(item){
  if(!item)return item;
  // Demo titles are intentionally fictional UI placeholders. Never let cached/remote metadata
  // turn a synthetic title into unrelated real-world artwork just because the names collide.
  if(isDemoItem(item))return {...item,logo:'',backdrop:'',titleLogo:'',plot:'',rating:'',imdbRating:'',tmdbId:'',imdbId:''};
  const meta=state.metadataCache?.[item.id]||{};
  return {...item,...(meta||{}),logo:meta.poster||item.logo||'',backdrop:meta.backdrop||item.backdrop||'',plot:meta.plot||item.plot||'',year:meta.year||item.year||'',rating:meta.rating||item.rating||'',imdbRating:meta.imdbRating||item.imdbRating||'',tmdbId:meta.tmdbId||item.tmdbId||'',imdbId:meta.imdbId||item.imdbId||''};
}
function validHex(value){return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).toLowerCase():'#050505'}
function applyTheme(){const theme=themeById(state.settings.themeId||'swoop'),root=document.documentElement,override=Boolean(state.settings.backgroundOverride),bg=override?validHex(state.settings.backgroundColor):theme.bg;root.dataset.theme=theme.id;root.style.setProperty('--bg',bg);root.style.setProperty('--swoop-bg',bg);root.style.setProperty('--surface',theme.surface);root.style.setProperty('--surface-2',theme.surface2);root.style.setProperty('--surface-3',theme.surface3);root.style.setProperty('--text',theme.text);root.style.setProperty('--muted',theme.muted);root.style.setProperty('--accent',theme.accent);root.style.setProperty('--accent-2',theme.accent2);root.style.setProperty('--theme-base-bg',theme.bg);document.querySelector('meta[name=theme-color]')?.setAttribute('content',bg);root.dataset.performance=largeLibraryMode()?'lean':'cinematic';}
function currentTheme(){return themeById(state.settings.themeId||'swoop')}
function profileTheme(profile){return themeById(profile?.profileSettings?.themeId||'swoop')}
function themePickerHtml(selectedId='swoop',name='themeId'){const selected=themeById(selectedId).id;return `<div class="theme-picker-grid">${SWOOP_THEMES.map(t=>`<button type="button" class="theme-choice ${t.id===selected?'active':''}" data-profile-theme="${esc(t.id)}" data-theme-value="${esc(t.id)}"><span class="theme-swatch" style="--theme-swatch:${esc(t.swatch)}"><i></i><b>${esc(t.name)}</b></span><span><strong>${esc(t.name)}</strong><small>${esc(t.tagline)}</small></span></button>`).join('')}</div><input type="hidden" name="${esc(name)}" value="${esc(selected)}" id="profileThemeValue">`}
async function enrichItemMetadata(item,{rerender=true,force=false}={}){
  if(!item||isDemoItem(item)||!['movie','series'].includes(item.kind))return null;
  if(metadataPending.has(item.id))return metadataPending.get(item.id);
  const cached=state.metadataCache?.[item.id]||{},now=Date.now();
  const lookupSchemaCurrent=!needsTitleLookupPrefixRepair(item)||Number(cached.titleLookupSchema||0)>=TITLE_LOOKUP_SCHEMA;
  const titleLogoKnown=Boolean(cached.titleLogo||cached.titleLogoCheckedAt);
  const metadataFresh=Boolean(lookupSchemaCurrent&&cached.checkedAt&&now-cached.checkedAt<7*86400000&&titleLogoKnown);
  const imdbFresh=Boolean(cached.imdbRatingCheckedAt&&now-cached.imdbRatingCheckedAt<30*86400000);
  if(metadataFresh&&!force){if(!imdbFresh)queueVisibleMetadata(item);return cached;}
  const task=(async()=>{
    try{
      const seed=await getInstallSeedCache(),seeded=installSeedTitleMetadata(seed,item);
      const metadata=(seeded&&installSeedFresh(seed))?seeded:(await fetchTitleMetadata({settings:state.settings,item}).catch(()=>seeded)),stamp=Date.now(),hasImdbField=Boolean(tenPointRating(metadata?.imdbRating));
      state.metadataCache[item.id]={...cached,...(metadata||{}),checkedAt:stamp,titleLogoCheckedAt:stamp,titleLookupSchema:TITLE_LOOKUP_SCHEMA,...(hasImdbField?{imdbRatingCheckedAt:stamp}:{})};metadataRevision++;
      if(metadata?.tmdbId&&!item.tmdbId)item.tmdbId=metadata.tmdbId;
      if(metadata?.imdbId&&!item.imdbId)item.imdbId=metadata.imdbId;
      persist('cache');
      if(!hasImdbField)queueVisibleMetadata(item);
      if(rerender&&(state.page==='home'||detailItem?.id===item.id||modal==='homeRows'))render();
      return state.metadataCache[item.id];
    }catch(err){const stamp=Date.now();state.metadataCache[item.id]={...cached,checkedAt:stamp,titleLogoCheckedAt:stamp,error:err.message||String(err)};metadataRevision++;persist('cache');return state.metadataCache[item.id];}
  })().finally(()=>metadataPending.delete(item.id));
  metadataPending.set(item.id,task);
  return task;
}
function scheduleMetadataEnrichment(){
  const queue=[];
  // Always hydrate the hero the user can actually see first. In large libraries the
  // old `first four candidates` shortcut meant later TV hero slides could sit on raw
  // provider names forever even after the user rotated to them.
  const activeHero=state.page==='home'?featureItem():null;if(activeHero){queue.push(activeHero);prefetchDetailPayload(activeHero).catch(()=>null);}
  for(const heroItem of heroCandidates().slice(0,largeLibraryMode()?6:10))if(heroItem)queue.push(heroItem);
  if(state.page==='home')for(const def of selectedHomeRows().slice(0,largeLibraryMode()?3:8))for(const item of homeRowItems(def.id).slice(0,largeLibraryMode()?3:5))queue.push(item);
  if(detailItem)queue.unshift(detailItem);
  for(const watched of watchHistoryItems().slice(0,largeLibraryMode()?2:6)){const source=watched.kind==='episode'?(savedItem(watched.parentSeriesId)||watched):watched;queue.push(source)}
  const unique=[...new Map(queue.filter(Boolean).map(x=>[x.id,x])).values()].filter(x=>!isDemoItem(x)&&['movie','series'].includes(x.kind)).slice(0,largeLibraryMode()?6:12);
  let i=0;const next=()=>{if(i>=unique.length)return;const target=unique[i++];enrichItemMetadata(target,{rerender:false}).then(()=>patchHomeHeroTitle(target)).finally(()=>setTimeout(next,largeLibraryMode()?450:140))};next();
}
function visibleMetadataLimit(){return largeLibraryMode()?4:7}
function visibleMetadataDelay(){return largeLibraryMode()?45:20}
function updateVisibleCardMetadata(itemId){
  const rating=displayImdbRating({id:itemId}),source=savedItem(itemId),visual=source?visualItem(source):null,poster=visual?.logo||'';
  for(const el of document.querySelectorAll('[data-imdb-item]')){
    if(el.dataset.imdbItem!==String(itemId))continue;
    let badge=el.querySelector('.card-imdb-rating');
    if(rating){if(!badge){badge=document.createElement('span');badge.className='card-imdb-rating';el.appendChild(badge)}badge.innerHTML=`<b>IMDb</b> ${rating}`;}else badge?.remove();
    if(poster){
      let img=el.querySelector('.card-art');
      const applyPosterTitleMode=()=>{if(!el.classList.contains('poster'))return;el.classList.add('poster-art-title');el.querySelector('.card-title')?.remove()};
      if(!img){img=document.createElement('img');img.className='card-art';img.alt='';img.dataset.swoopArt=poster;const bg=el.querySelector('.card-bg');bg?.after(img);img.addEventListener('load',applyPosterTitleMode,{once:true});loadArtwork(img,{priority:'high'});}
      else if(img.dataset.swoopArt!==poster){img.dataset.swoopArt=poster;delete img.dataset.swoopLoaded;delete img.dataset.swoopFailed;img.classList.remove('loaded','artwork-failed');img.removeAttribute('src');img.addEventListener('load',applyPosterTitleMode,{once:true});loadArtwork(img,{priority:'high'});}
      else if(img.classList.contains('loaded'))applyPosterTitleMode();
    }
    el.dataset.imdbHydrated='1';
  }
}
function updateVisibleImdbBadges(itemId){updateVisibleCardMetadata(itemId)}
async function enrichVisibleImdbRating(item){
  if(!item||isDemoItem(item)||!['movie','series'].includes(item.kind))return null;
  const cached=state.metadataCache?.[item.id]||{},now=Date.now();
  if(cached.imdbRatingCheckedAt&&now-cached.imdbRatingCheckedAt<30*86400000)return cached;
  try{
    let ratingMeta=null;
    try{ratingMeta=await fetchTitleImdbRating({settings:state.settings,item:{...item,tmdbId:cached.tmdbId||item.tmdbId||'',imdbId:cached.imdbId||item.imdbId||''}})}catch{}
    if(!ratingMeta||!Object.prototype.hasOwnProperty.call(ratingMeta,'imdbRating')){
      const full=await enrichItemMetadata(item,{rerender:false});
      return full||state.metadataCache?.[item.id]||null;
    }
    const stamp=Date.now();
    state.metadataCache[item.id]={...cached,...ratingMeta,imdbRatingCheckedAt:stamp};metadataRevision++;
    if(ratingMeta.tmdbId&&!item.tmdbId)item.tmdbId=ratingMeta.tmdbId;
    if(ratingMeta.imdbId&&!item.imdbId)item.imdbId=ratingMeta.imdbId;
    persist('cache');
    return state.metadataCache[item.id];
  }catch{return state.metadataCache?.[item.id]||null}
}
async function enrichVisibleCardMetadata(item){
  if(!item||isDemoItem(item)||!['movie','series'].includes(item.kind))return null;
  const visual=visualItem(item),needsPoster=!visual?.logo||visibleArtworkRepairIds.has(item.id);
  if(needsPoster){const result=await enrichItemMetadata(item,{rerender:false,force:visibleArtworkRepairIds.has(item.id)});visibleArtworkRepairIds.delete(item.id);return result;}
  return enrichVisibleImdbRating(item);
}
function pumpVisibleMetadata(){
  while(visibleMetadataActive<visibleMetadataLimit()&&visibleMetadataQueue.length){
    const item=visibleMetadataQueue.shift();if(!item)continue;visibleMetadataActive++;
    enrichVisibleCardMetadata(item).finally(()=>{updateVisibleCardMetadata(item.id);visibleMetadataQueued.delete(item.id);visibleMetadataActive--;setTimeout(pumpVisibleMetadata,visibleMetadataDelay())});
  }
}
function queueVisibleMetadata(item,{forceArtwork=false}={}){
  if(!item||isDemoItem(item)||!['movie','series'].includes(item.kind))return;
  if(forceArtwork)visibleArtworkRepairIds.add(item.id);
  if(visibleMetadataQueued.has(item.id))return;
  const visual=visualItem(item),cached=state.metadataCache?.[item.id]||{},now=Date.now(),posterMissing=!visual?.logo||visibleArtworkRepairIds.has(item.id);
  if(!posterMissing&&cached.imdbRatingCheckedAt&&now-cached.imdbRatingCheckedAt<30*86400000){updateVisibleCardMetadata(item.id);return}
  visibleMetadataQueued.add(item.id);visibleMetadataQueue.push(item);pumpVisibleMetadata();
}
function hydrateVisibleImdbRatings(root=document){
  const nodes=[...root.querySelectorAll('[data-imdb-item]')].filter(el=>el.dataset.imdbHydrated!=='1');if(!nodes.length)return;
  const activate=el=>{const id=el.dataset.imdbItem,item=savedItem(id);if(!item){el.dataset.imdbHydrated='1';return}const visual=visualItem(item),cached=state.metadataCache?.[id]||{};if(displayImdbRating({id})){updateVisibleCardMetadata(id);return}if(NATIVE_ANDROID){el.dataset.imdbHydrated='1';return}if(!visual?.logo){queueVisibleMetadata(item,{forceArtwork:false});return}if(cached.imdbRatingCheckedAt&&Date.now()-cached.imdbRatingCheckedAt<30*86400000){el.dataset.imdbHydrated='1';return}queueVisibleMetadata(item)};
  const near=el=>{const r=el.getBoundingClientRect();return r.bottom>=-500&&r.top<=innerHeight+700&&r.right>=-900&&r.left<=innerWidth+1400};
  const immediate=nodes.filter(near);immediate.forEach(activate);
  const deferred=nodes.filter(el=>!immediate.includes(el));if(!deferred.length)return;
  if(!('IntersectionObserver'in window)){deferred.forEach(activate);return}
  if(!visibleMetadataObserver)visibleMetadataObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){visibleMetadataObserver?.unobserve(entry.target);activate(entry.target)}},{rootMargin:largeLibraryMode()?'700px 1200px':'1000px 1800px',threshold:.01});
  deferred.forEach(el=>visibleMetadataObserver.observe(el));
}
function resolveProviderAsset(value='',providerId=''){
  const raw=Array.isArray(value)?value.find(Boolean)||'':String(value||'').trim();if(!raw)return'';const cfg=providerConfigById(providerId)||sessionXtream||{};
  try{return new URL(raw,`${String(cfg.server||'').replace(/\/+$/,'')}/`).href}catch{return raw}
}
function kindLabel(item){return item?.kind==='live'?'Live TV':item?.kind==='movie'?'Movie':item?.kind==='series'?'Series':item?.kind==='episode'?'Episode':'Title'}
const HOME_ROW_DEFS=[
  {id:'continue',label:'Continue Watching',group:'Your Swoop TV',poster:true},
  {id:'recently-watched',label:'Recently Watched',group:'Your Swoop TV',poster:true},
  {id:'recommended',label:'Recommended For You',group:'For You',poster:true},
  {id:'recent-live',label:'Recent Channels',group:'Your Swoop TV',poster:false,page:'live'},
  {id:'mylist',label:'My List',group:'Your Swoop TV',poster:true,page:'mylist'},
  {id:'top20-movies',label:'Top 100 Movies',group:'Discover',poster:true,web:true,ranked:true,description:'What is hot and trending right now, matched to your library'},
  {id:'top20-shows',label:'Top 100 TV Shows',group:'Discover',poster:true,web:true,ranked:true,description:'What is hot and trending right now, matched to your library'},
  {id:'trending-movies',label:'Trending Now — Movies',group:'Discover',poster:true,web:true,description:'Titles gaining momentum right now'},
  {id:'trending-shows',label:'Trending Now — TV Shows',group:'Discover',poster:true,web:true,description:'Titles gaining momentum right now'},
  {id:'new-hot-movies',label:'New & Hot Movies',group:'Discover',poster:true,web:true,description:'Recent releases available in your library'},
  {id:'new-hot-shows',label:'New & Hot TV Shows',group:'Discover',poster:true,web:true,description:'Recent TV releases available in your library'},
  {id:'streaming-movies',label:'Popular on Streaming — Movies',group:'Discover',poster:true,web:true,description:'Popular streaming picks available in your library'},
  {id:'streaming-shows',label:'Popular on Streaming — TV',group:'Discover',poster:true,web:true,description:'Popular streaming picks available in your library'},
  {id:'most-watched-movies',label:'Most Watched This Week — Movies',group:'Discover',poster:true,web:true,description:'Weekly viewing activity blended with current popularity'},
  {id:'most-watched-shows',label:'Most Watched This Week — TV',group:'Discover',poster:true,web:true,description:'Weekly viewing activity blended with current popularity'},
  {id:'box-office-movies',label:'Box Office Now',group:'Discover',poster:true,web:true,description:'Current theatrical and box-office titles available in your library'},
  {id:'live-now',label:'Live Now',group:'Your provider',poster:false,page:'live'},
  {id:'new-movies',label:'Recently Added Movies',group:'Your provider',poster:true,page:'movies',description:'Newest movie additions reported by your TV provider'},
  {id:'new-shows',label:'Recently Added TV Shows',group:'Your provider',poster:true,page:'series',description:'Newest TV additions or updates reported by your TV provider'},
  {id:'snoak-latest-netflix-shows',label:'Latest Netflix Shows',group:'Discover',poster:true,description:'Latest Netflix shows available in your library'},
  {id:'snoak-latest-amazon-prime-shows',label:'Latest Amazon Prime Shows',group:'Discover',poster:true,description:'Latest Prime Video shows available in your library'},
  {id:'snoak-latest-apple-tv-shows',label:'Latest Apple TV+ Shows',group:'Discover',poster:true,description:'Latest Apple TV+ shows available in your library'},
  {id:'snoak-latest-hbo-max-shows-a',label:'Latest HBO Max Shows',group:'Discover',poster:true,description:'Latest HBO Max shows available in your library'},
  {id:'snoak-latest-disney-shows',label:'Latest Disney+ Shows',group:'Discover',poster:true,description:'Latest Disney+ shows available in your library'},
  {id:'snoak-latest-hbo-max-shows-b',label:'Latest HBO Max Shows',group:'Discover',poster:true,description:'More recent HBO Max shows available in your library'},
  {id:'snoak-latest-miniseries-shows',label:'Latest Mini Series',group:'Discover',poster:true,description:'Latest miniseries available in your library'},
  {id:'snoak-popular-kdrama-shows',label:'Popular K-Drama Shows',group:'Discover',poster:true,description:'Popular K-Drama available in your library'},
  {id:'snoak-trending-anime-shows',label:'Trending Anime Shows',group:'Discover',poster:true,description:'Trending anime available in your library'},
  {id:'snoak-popular-action-movies',label:'Popular Action Movies',group:'Discover',poster:true},
  {id:'snoak-popular-action-shows',label:'Popular Action Shows',group:'Discover',poster:true},
  {id:'snoak-popular-animated-movies',label:'Popular Animated Movies',group:'Discover',poster:true},
  {id:'snoak-popular-animated-shows',label:'Popular Animated Shows',group:'Discover',poster:true},
  {id:'snoak-popular-comedy-movies',label:'Popular Comedy Movies',group:'Discover',poster:true},
  {id:'snoak-popular-comedy-shows',label:'Popular Comedy Shows',group:'Discover',poster:true},
  {id:'snoak-popular-documentary-movies',label:'Popular Documentary Movies',group:'Discover',poster:true},
  {id:'snoak-popular-documentary-shows',label:'Popular Documentary Shows',group:'Discover',poster:true},
  {id:'snoak-popular-drama-movies',label:'Popular Drama Movies',group:'Discover',poster:true},
  {id:'snoak-popular-drama-shows',label:'Popular Drama Shows',group:'Discover',poster:true},
  {id:'snoak-popular-horror-movies',label:'Popular Horror Movies',group:'Discover',poster:true},
  {id:'snoak-popular-horror-shows',label:'Popular Horror Shows',group:'Discover',poster:true},
  {id:'snoak-popular-reality-shows',label:'Popular Reality Shows',group:'Discover',poster:true},
  {id:'snoak-popular-romance-movies',label:'Popular Romance Movies',group:'Discover',poster:true},
  {id:'snoak-popular-romance-shows',label:'Popular Romance Shows',group:'Discover',poster:true},
  {id:'snoak-popular-scifi-movies',label:'Popular Sci-Fi Movies',group:'Discover',poster:true},
  {id:'snoak-popular-scifi-shows',label:'Popular Sci-Fi Shows',group:'Discover',poster:true},
  {id:'snoak-popular-thriller-movies',label:'Popular Thriller Movies',group:'Discover',poster:true},
  {id:'snoak-popular-thriller-shows',label:'Popular Thriller Shows',group:'Discover',poster:true},
  {id:'top-rated-movies',label:'Top Rated Movies',group:'Your provider',poster:true},
  {id:'top-rated-shows',label:'Top Rated TV Shows',group:'Your provider',poster:true},
  {id:'action-movies',label:'Action Movies',group:'Categories',poster:true},
  {id:'comedy-movies',label:'Comedy Movies',group:'Categories',poster:true},
  {id:'drama-movies',label:'Drama Movies',group:'Categories',poster:true},
  {id:'horror-movies',label:'Horror Movies',group:'Categories',poster:true},
  {id:'thriller-movies',label:'Thriller Movies',group:'Categories',poster:true},
  {id:'scifi-movies',label:'Sci-Fi & Fantasy Movies',group:'Categories',poster:true},
  {id:'family-movies',label:'Family Movies',group:'Categories',poster:true},
  {id:'animation-movies',label:'Animation Movies',group:'Categories',poster:true},
  {id:'romance-movies',label:'Romance Movies',group:'Categories',poster:true},
  {id:'adventure-movies',label:'Adventure Movies',group:'Categories',poster:true},
  {id:'fantasy-movies',label:'Fantasy Movies',group:'Categories',poster:true},
  {id:'mystery-movies',label:'Mystery Movies',group:'Categories',poster:true},
  {id:'western-movies',label:'Western Movies',group:'Categories',poster:true},
  {id:'war-movies',label:'War Movies',group:'Categories',poster:true},
  {id:'music-movies',label:'Music & Musical Movies',group:'Categories',poster:true},
  {id:'drama-shows',label:'Drama TV Shows',group:'Categories',poster:true},
  {id:'crime-shows',label:'Crime TV Shows',group:'Categories',poster:true},
  {id:'comedy-shows',label:'Comedy TV Shows',group:'Categories',poster:true},
  {id:'reality-shows',label:'Reality TV',group:'Categories',poster:true},
  {id:'action-shows',label:'Action & Adventure TV',group:'Categories',poster:true},
  {id:'scifi-shows',label:'Sci-Fi & Fantasy TV',group:'Categories',poster:true},
  {id:'mystery-shows',label:'Mystery TV',group:'Categories',poster:true},
  {id:'thriller-shows',label:'Thriller TV',group:'Categories',poster:true},
  {id:'animation-shows',label:'Animation TV',group:'Categories',poster:true},
  {id:'family-shows',label:'Family & Kids TV',group:'Categories',poster:true},
  {id:'documentary',label:'Documentaries',group:'Categories',poster:true},
  {id:'movies',label:'All Movies',group:'Your provider',poster:true,page:'movies'},
  {id:'shows',label:'All TV Shows',group:'Your provider',poster:true,page:'series'}
];
const SNOAK_CURATED_ROWS=new Map([
  ['snoak-latest-netflix-shows','latest-netflix-shows'],
  ['snoak-latest-amazon-prime-shows','latest-amazon-prime-shows'],
  ['snoak-latest-apple-tv-shows','latest-apple-tv-shows'],
  ['snoak-latest-hbo-max-shows-a','latest-hbo-max-shows'],
  ['snoak-latest-disney-shows','latest-disney-shows'],
  ['snoak-latest-hbo-max-shows-b','latest-hbo-max-shows'],
  ['snoak-latest-miniseries-shows','latest-miniseries'],
  ['snoak-popular-kdrama-shows','popular-kdrama-shows'],
  ['snoak-trending-anime-shows','trending-anime-shows'],
  ['snoak-popular-action-movies','genre-action-movies'],['snoak-popular-action-shows','genre-action-shows'],
  ['snoak-popular-animated-movies','genre-animation-movies'],['snoak-popular-animated-shows','genre-animation-shows'],
  ['snoak-popular-comedy-movies','genre-comedy-movies'],['snoak-popular-comedy-shows','genre-comedy-shows'],
  ['snoak-popular-documentary-movies','genre-documentary'],['snoak-popular-documentary-shows','genre-documentary-shows'],
  ['snoak-popular-drama-movies','genre-drama-movies'],['snoak-popular-drama-shows','genre-drama-shows'],
  ['snoak-popular-horror-movies','genre-horror-movies'],['snoak-popular-horror-shows','genre-horror-shows'],
  ['snoak-popular-reality-shows','genre-reality-shows'],
  ['snoak-popular-romance-movies','genre-romance-movies'],['snoak-popular-romance-shows','genre-romance-shows'],
  ['snoak-popular-scifi-movies','genre-scifi-movies'],['snoak-popular-scifi-shows','genre-scifi-shows'],
  ['snoak-popular-thriller-movies','genre-thriller-movies'],['snoak-popular-thriller-shows','genre-thriller-shows'],
  // Existing optional category rows keep Snoak backing when enabled manually.
  ['action-movies','genre-action-movies'],['action-shows','genre-action-shows'],
  ['animation-movies','genre-animation-movies'],['animation-shows','genre-animation-shows'],
  ['comedy-movies','genre-comedy-movies'],['comedy-shows','genre-comedy-shows'],
  ['crime-shows','genre-crime-shows'],
  ['drama-movies','genre-drama-movies'],['drama-shows','genre-drama-shows'],
  ['horror-movies','genre-horror-movies'],['reality-shows','genre-reality-shows'],
  ['romance-movies','genre-romance-movies'],['scifi-movies','genre-scifi-movies'],['scifi-shows','genre-scifi-shows'],
  ['thriller-movies','genre-thriller-movies'],['thriller-shows','genre-thriller-shows']
]);

const HOME_ROW_MAP=new Map(HOME_ROW_DEFS.map(x=>[x.id,x]));
const WEB_ROW_IDS=new Set([...HOME_ROW_DEFS.filter(x=>x.web).map(x=>x.id),...SNOAK_CURATED_ROWS.keys()]);
function providerCategoryDefs(){
  if(nativeCatalogMode){const make=(kind,label)=>(nativeCategoryCache[kind]||[]).filter(x=>Number(x.count)>=4).slice(0,28).map(x=>({id:`cat:${kind}:${encodeURIComponent(x.name)}`,label:x.name,group:label,poster:true,category:true,description:`${Number(x.count).toLocaleString()} titles available`}));return [...make('movie','Provider Movie Categories'),...make('series','Provider TV Categories')];}
  const make=(kind,label)=>{const counts=new Map();for(const item of items(kind)){const g=String(item.group||'').trim();if(g)counts.set(g,(counts.get(g)||0)+1)}return [...counts.entries()].filter(([,n])=>n>=4).sort((a,b)=>b[1]-a[1]).slice(0,28).map(([name,count])=>({id:`cat:${kind}:${encodeURIComponent(name)}`,label:name,group:label,poster:true,category:true,description:`${count.toLocaleString()} titles from your provider`}))};
  return [...make('movie','Provider Movie Categories'),...make('series','Provider TV Categories')];
}
function homeRowDef(id){
  if(String(id).startsWith('custom:')){
    const uid=String(id).slice(7),row=state.mdblistRows.find(x=>String(x.uid)===uid);
    return row?{id,label:row.name||'MDBList',group:'Custom MDBList',poster:true,custom:true,description:'Auto-refreshing MDBList row matched to your provider'}:null;
  }
  if(String(id).startsWith('cat:')){const parts=String(id).split(':');const kind=parts[1],name=decodeURIComponent(parts.slice(2).join(':'));return {id,label:name,group:kind==='movie'?'Provider Movie Categories':'Provider TV Categories',poster:true,category:true,description:`${items(kind).filter(x=>x.group===name).length.toLocaleString()} titles from your provider`};}
  return HOME_ROW_MAP.get(id)||null;
}
function allHomeRowDefs(){return [...HOME_ROW_DEFS.filter(x=>!HOME_REMOVED_ROWS.has(x.id)),...providerCategoryDefs(),...state.mdblistRows.map(r=>homeRowDef(`custom:${r.uid}`)).filter(Boolean)]}
function selectedHomeRows(){
  const normalized=normalizeHomeRows(state.settings.homeRows);
  const defs=normalized.map(homeRowDef).filter(Boolean),byId=new Map(defs.map(x=>[x.id,x]));
  const pinned=PINNED_HOME_ROWS.map(id=>byId.get(id)).filter(Boolean);
  const primary=PRIMARY_HOME_ROWS.map(id=>byId.get(id)).filter(Boolean);
  const snoak=CURATED_SNOAK_HOME_ORDER.map(id=>byId.get(id)).filter(Boolean);
  const bottom=BOTTOM_HOME_ROWS.map(id=>byId.get(id)).filter(Boolean);
  const locked=new Set([...PINNED_HOME_ROWS,...PRIMARY_HOME_ROWS,...CURATED_SNOAK_HOME_ORDER,...BOTTOM_HOME_ROWS]);
  let rest=defs.filter(x=>!locked.has(x.id));
  if(state.settings.smartHomeOrder!==false){
    const affinity=profileGenreAffinity(state.watchHistory,id=>savedItem(id),item=>[...mediaGenres(item)]);
    rest=smartRankRows(rest,affinity);
  }
  return [...pinned,...primary,...snoak,...rest,...bottom];
}
function mediaSearchText(item){return `${item?.genre||''} ${item?.group||''} ${item?.name||''}`.toLowerCase()}
function yearNumber(item){const m=String(item?.year||item?.name||'').match(/(?:19|20)\d{2}/);return m?Number(m[0]):0}
function providerAddedNumber(item){
  const direct=Number(item?.providerAddedAt||0);if(Number.isFinite(direct)&&direct>0)return direct;
  if(Array.isArray(item?.sources)){const sourceMax=Math.max(0,...item.sources.map(x=>Number(x?.providerAddedAt||0)).filter(Number.isFinite));if(sourceMax>0)return sourceMax}
  const sequence=Number(item?.streamId??item?.seriesId??0);return Number.isFinite(sequence)&&sequence>0?sequence:0;
}
function tenPointRating(value){const n=parseFloat(String(value??'').replace(',','.'));return Number.isFinite(n)&&n>0&&n<=10?n.toFixed(1):''}
function ratingNumber(item){const meta=state.metadataCache?.[item?.id]||{},trusted=tenPointRating(meta.rating)||tenPointRating(item?.rating);return trusted?Number(trusted):0}
function displayRating(item){const meta=state.metadataCache?.[item?.id]||{};return tenPointRating(meta.rating)}
function displayImdbRating(item){const meta=state.metadataCache?.[item?.id]||{};return tenPointRating(meta.imdbRating)}
function stableDailyOrder(list,key=''){const day=Math.floor(Date.now()/86400000);return [...list].sort((a,b)=>Math.abs(hash(`${day}|${key}|${a.id}`))-Math.abs(hash(`${day}|${key}|${b.id}`)))}
function watchHistoryItems(){const out=[],seen=new Set();for(const x of [...state.watchHistory].sort((a,b)=>(b.lastPlayed||0)-(a.lastPlayed||0))){const item=savedItem(x.id)||x.item;if(item&&!seen.has(item.id)){seen.add(item.id);out.push(item)}}return out}
function recentLiveItems(){return state.recentLive.map(savedItem).filter(Boolean)}
function mediaGenres(item){
  const meta=state.metadataCache?.[item?.id]||{};
  const raw=Array.isArray(meta.genres)?meta.genres.join(' '):`${meta.genres||''} ${item?.genre||''} ${item?.group||''}`;
  return new Set(String(raw).toLowerCase().split(/[,/|·]+|\s{2,}/).map(x=>x.trim()).filter(x=>x.length>2));
}
function matchTmdbRecommendations(recs=[],kind=''){
  const pool=activeCatalog().filter(x=>['movie','series'].includes(x.kind)&&(!kind||x.kind===kind));
  const byTmdb=new Map(pool.filter(x=>x.tmdbId).map(x=>[String(x.tmdbId),x]));
  const byTitle=new Map();
  for(const item of pool){const key=normalizeMediaTitle(item.name);if(key&&!byTitle.has(key))byTitle.set(key,item)}
  const out=[];
  for(const rec of recs||[]){
    let hit=rec?.tmdbId?byTmdb.get(String(rec.tmdbId)):null;
    if(!hit){const key=normalizeMediaTitle(rec?.title||rec?.name||'');if(key)hit=byTitle.get(key)}
    if(hit&&!out.some(x=>x.id===hit.id))out.push(hit);
  }
  return collapseMovieSources(out,activeCatalog());
}
function personalizedRecommendations(limit=HOME_STANDARD_ROW_LIMIT){
  const history=[...new Map(watchHistoryItems().map(x=>x.kind==='episode'?(savedItem(x.parentSeriesId)||x):x).map(x=>[x.id,x])).values()].slice(0,12),exclude=new Set(history.map(x=>x.id));
  if(!history.length)return[];
  const direct=[];
  for(const watched of history){
    const meta=state.metadataCache?.[watched.id];
    for(const hit of matchTmdbRecommendations(meta?.recommendations||[],watched.kind))if(!exclude.has(hit.id)&&!direct.some(x=>x.id===hit.id))direct.push(hit);
  }
  const recommendationGenres=item=>{const meta=state.metadataCache?.[item?.id]||{},raw=Array.isArray(meta.genres)?meta.genres.join(' '):`${meta.genres||''} ${item?.genre||''}`;return new Set(String(raw).toLowerCase().split(/[,/|·]+|\s{2,}/).map(x=>x.trim()).filter(x=>x.length>2))};
  const genreScores=new Map();
  for(const watched of history){for(const g of recommendationGenres(watched))genreScores.set(g,(genreScores.get(g)||0)+1)}
  const scored=activeCatalog().filter(x=>['movie','series'].includes(x.kind)&&!exclude.has(x.id)).map(item=>{
    let affinity=0;for(const g of recommendationGenres(item))affinity+=genreScores.get(g)||0;
    if(affinity<=0)return {item,score:0,tie:0};
    let score=affinity;
    if(history[0]?.kind===item.kind)score+=.5;
    if(state.myList.includes(item.id))score-=4;
    score+=Math.min(.75,ratingNumber(item)/12);
    return {item,score,tie:Math.abs(hash(`${Math.floor(Date.now()/86400000)}|rec|${item.id}`))};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.tie-b.tie).map(x=>x.item);
  return collapseMovieSources([...new Map([...direct,...scored].map(x=>[x.id,x])).values()],activeCatalog()).slice(0,limit);
}
function localHomeRowItems(id){
  const movies=items('movie'),shows=items('series'),live=items('live');
  const filter=(arr,words)=>stableDailyOrder(arr.filter(x=>words.some(w=>mediaSearchText(x).includes(w))),id);
  if(id==='continue')return continueItems();
  if(id==='recently-watched')return watchHistoryItems();
  if(id==='recommended')return personalizedRecommendations();
  if(id==='recent-live')return recentLiveItems();
  if(id==='mylist')return listItems();
  if(id==='live-now')return live;
  if(id==='movies')return movies;
  if(id==='shows')return shows;
  if(id==='new-movies')return [...movies].sort((a,b)=>providerAddedNumber(b)-providerAddedNumber(a)||String(a.name||'').localeCompare(String(b.name||'')));
  if(id==='new-shows')return [...shows].sort((a,b)=>providerAddedNumber(b)-providerAddedNumber(a)||String(a.name||'').localeCompare(String(b.name||'')));
  if(id==='top-rated-movies')return [...movies].filter(x=>ratingNumber(x)>0).sort((a,b)=>ratingNumber(b)-ratingNumber(a));
  if(id==='top-rated-shows')return [...shows].filter(x=>ratingNumber(x)>0).sort((a,b)=>ratingNumber(b)-ratingNumber(a));
  if(id==='action-movies')return filter(movies,['action']);
  if(id==='comedy-movies')return filter(movies,['comedy']);
  if(id==='drama-movies')return filter(movies,['drama']);
  if(id==='horror-movies')return filter(movies,['horror']);
  if(id==='thriller-movies')return filter(movies,['thriller','suspense']);
  if(id==='scifi-movies')return filter(movies,['sci-fi','sci fi','science fiction','fantasy']);
  if(id==='family-movies')return filter(movies,['family','kids','children']);
  if(id==='animation-movies')return filter(movies,['animation','animated','anime']);
  if(id==='romance-movies')return filter(movies,['romance','romantic']);
  if(id==='adventure-movies')return filter(movies,['adventure']);
  if(id==='fantasy-movies')return filter(movies,['fantasy']);
  if(id==='mystery-movies')return filter(movies,['mystery']);
  if(id==='western-movies')return filter(movies,['western']);
  if(id==='war-movies')return filter(movies,['war','military']);
  if(id==='music-movies')return filter(movies,['music','musical']);
  if(id==='drama-shows')return filter(shows,['drama']);
  if(id==='crime-shows')return filter(shows,['crime','detective']);
  if(id==='comedy-shows')return filter(shows,['comedy','sitcom']);
  if(id==='reality-shows')return filter(shows,['reality']);
  if(id==='action-shows')return filter(shows,['action','adventure']);
  if(id==='scifi-shows')return filter(shows,['sci-fi','sci fi','science fiction','fantasy']);
  if(id==='mystery-shows')return filter(shows,['mystery','detective']);
  if(id==='thriller-shows')return filter(shows,['thriller','suspense']);
  if(id==='animation-shows')return filter(shows,['animation','animated','anime']);
  if(id==='family-shows')return filter(shows,['family','kids','children']);
  if(id==='documentary')return stableDailyOrder([...movies,...shows].filter(x=>['documentary','docuseries'].some(w=>mediaSearchText(x).includes(w))),id);
  return [];
}
function cachedWebRowItems(id){const cache=state.webDiscovery?.[id];if(androidFastHomeMode()){const source=Array.isArray(cache?.items)&&cache.items.length?cache.items:(cache?.itemIds||[]).map(androidFastSavedItem).filter(Boolean);return source.slice(0,String(id).startsWith('top20-')?ANDROID_TV_HOME_DATA_RANKED_LIMIT:ANDROID_TV_HOME_DATA_STANDARD_LIMIT)}if(nativeCatalogMode&&Array.isArray(cache?.items))return cacheNativeItems(cache.items);return collapseMovieSources((cache?.itemIds||[]).map(savedItem).filter(Boolean),activeCatalog())}
function customHomeRowItems(id){const uid=String(id).slice(7),row=state.mdblistRows.find(x=>String(x.uid)===uid);if(androidFastHomeMode())return (row?.items||[]).slice(0,ANDROID_TV_HOME_DATA_STANDARD_LIMIT);return collapseMovieSources(row?.items||[],activeCatalog())}
function homeRowItems(id){
  const profile=activeProfile(),finish=list=>{const filtered=dedupeHomeTitles((list||[]).filter(item=>!isDemoItem(item)&&profileAllowsMedia(profile,item,state.metadataCache?.[item.id]||{})));return (id==='top20-movies'||id==='top20-shows')?completeTop100FromLibrary(id,filtered):filtered};
  if(NATIVE_ANDROID&&androidPreparedHomeReady&&!ANDROID_DYNAMIC_HOME_ROWS.has(String(id))&&androidPreparedHomeRows.has(String(id)))return finish(androidPreparedHomeRows.get(String(id))||[]);
  if(androidFastHomeMode())return finish(androidFastRowItems(id));let result;if(WEB_ROW_IDS.has(id)){result=cachedWebRowItems(id);if(!result.length&&SNOAK_CURATED_ROWS.has(id))result=nativeCatalogMode?(nativeHomeRowCache.get(id)||[]):localHomeRowItems(id);}else if(String(id).startsWith('custom:'))result=customHomeRowItems(id);else if(nativeCatalogMode&&nativeHomeRowCache.has(id))result=nativeHomeRowCache.get(id);else if(String(id).startsWith('cat:')){const parts=String(id).split(':'),kind=parts[1],name=decodeURIComponent(parts.slice(2).join(':'));result=stableDailyOrder(items(kind).filter(x=>x.group===name),id)}else result=localHomeRowItems(id);return finish(result)}
function relativeRefreshTime(ts){if(!ts)return'Not refreshed yet';const mins=Math.max(0,Math.floor((Date.now()-ts)/60000));if(mins<1)return'Updated just now';if(mins<60)return`Updated ${mins}m ago`;const hrs=Math.floor(mins/60);if(hrs<24)return`Updated ${hrs}h ago`;return`Updated ${Math.floor(hrs/24)}d ago`}
function discoveryMeta(id,data){
  if(id==='top20-movies'||id==='top20-shows')return '';
  if(WEB_ROW_IDS.has(id)||SNOAK_CURATED_ROWS.has(id)||String(id).startsWith('custom:'))return data.length?`${data.length.toLocaleString()} available`:'Updating…';
  if(id==='live-now')return`${data.length.toLocaleString()} channels`;
  if(id==='continue')return`${data.length} in progress`;
  if(id==='recently-watched')return`${data.length} recently played`;
  if(id==='recommended')return state.watchHistory.length?'Based on your viewing':'Start watching to personalize this row';
  if(id==='recent-live')return`${data.length} recent channels`;
  if(id==='mylist')return`${data.length} saved`;
  return`${data.length.toLocaleString()} available`;
}
function discoveryRowMediaType(id){return /shows|tv/i.test(String(id))?'show':'movie'}
function discoveryRowMode(id){if(SNOAK_CURATED_ROWS.has(id))return'snoak';if(String(id).startsWith('top20-'))return'hot';if(String(id).startsWith('trending-'))return'trending';if(String(id).startsWith('new-hot-'))return'newhot';if(String(id).startsWith('streaming-'))return'streaming';if(String(id).startsWith('most-watched-'))return'watched';if(id==='box-office-movies')return'boxoffice';return'trending'}
function discoveryRowTtl(id){return /^(top20-|trending|new-hot|streaming|box-office)/.test(String(id))?DISCOVERY_FAST_REFRESH_MS:DISCOVERY_REFRESH_MS}
async function discoveryBundle(mediaType,force=false){
  const key=mediaType==='show'?'tv':'movie',cached=discoveryBundleMemory.get(key),now=Date.now();
  if(!force&&cached&&now-cached.at<5*60*1000)return cached.data;
  const seed=await getInstallSeedCache(),seeded=installSeedDiscovery(seed,key);
  if(seeded&&(!cached||cached.seeded||force)){
    discoveryBundleMemory.set(key,{at:now,data:seeded,seeded:true});
    // A release build carries a current provider-neutral discovery snapshot. Use it now,
    // then replace it quietly with the latest network bundle without holding up Home.
    if(force||!installSeedFresh(seed))setTimeout(()=>fetchSwoopDiscovery({settings:state.settings,mediaType:key}).then(data=>{if(!data||typeof data!=='object')return;discoveryBundleMemory.set(key,{at:Date.now(),data,seeded:false});const id=key==='tv'?'top20-shows':'top20-movies';if(state.webDiscovery?.[id])state.webDiscovery[id].updatedAt=0;if(state.page==='home'&&!profilePickerOpen)setTimeout(()=>refreshDiscoveryRows(false,false,null,[id]).then(()=>patchMountedHomeRows([id])).catch(()=>{}),120)}).catch(()=>{}),0);
    return seeded;
  }
  const data=await fetchSwoopDiscovery({settings:state.settings,mediaType:key});
  discoveryBundleMemory.set(key,{at:now,data,seeded:false});return data;
}
async function androidMatchDiscoveryPayload(payload,mediaType,{sourceLimit=800,limit=100}={}){
  if(NATIVE_ANDROID&&tvCatalogWorkerReady){
    const result=await tvCatalogWorkerRequest('catalog-match',{payload,mediaType,sourceLimit,limit},20000);
    if(Array.isArray(result?.items))return result.items;
  }
  return matchMDBListToCatalog(payload,activeCatalog(),{sourceLimit,limit,mediaType});
}

function blendDiscoverySources(bundle,mediaType,mode='trending',limit=20){
  const kind=mediaType==='show'?'series':'movie',sources=bundle?.sources||{};
  const weights={
    trending:{snoakTrakt:2.05,snoakJustwatch:1.55,snoakTvStats:1.25,snoakImdb:.9,tmdbDay:.8,traktTrending:.7,justwatch:.6,tmdbWeek:.5},
    hot:{snoakTrakt:2.55,snoakJustwatch:2.05,snoakTvStats:1.7,tmdbDay:1.4,traktTrending:1.25,justwatch:.95,tmdbWeek:.8,snoakLatest:.65,snoakImdb:.55},
    top20:{snoakJustwatch:1.8,snoakTvStats:1.65,snoakImdb:1.5,snoakRotten:1.3,snoakTrakt:1.15,stable:.55,imdbPopular:.5,tmdbPopular:.45,tmdbWeek:.35},
    newhot:{snoakLatest:2.0,snoakTraktDigital:1.45,snoakTrakt:1.15,snoakJustwatch:1.0,fresh:.8,tmdbDay:.65,tmdbWeek:.35},
    streaming:{snoakJustwatch:2.0,snoakLatest:1.05,justwatch:.8,snoakTrakt:.7,stable:.35},
    watched:{mostWatched:1.7,snoakTvStats:1.45,snoakTrakt:1.0,snoakJustwatch:.65,tmdbWeek:.45},
    boxoffice:{boxOffice:1.8,fresh:1.2,snoakTvStats:.7,snoakTrakt:.55,tmdbDay:.45}
  }[mode]||{};
  const score=new Map(),sourceHits=new Map(),logicalById=new Map();
  for(const [name,weight] of Object.entries(weights)){
    const payload=sources[name];if(!payload||!(Array.isArray(payload)?payload.length:Object.keys(payload||{}).length))continue;
    const rankedFeed=mode==='top20'||mode==='hot',sourceLimit=rankedFeed?800:200,matchLimit=rankedFeed?HOME_RANKED_ROW_LIMIT:HOME_STANDARD_ROW_LIMIT;
    const matched=matchMDBListToCatalog(payload,activeCatalog(),{sourceLimit,limit:matchLimit,mediaType});
    matched.forEach((raw,rank)=>{
      const item=savedItem(raw.id)||raw,id=item.id;logicalById.set(id,item);
      const decay=1/(1+rank*.095),prior=score.get(id)||0;
      score.set(id,prior+weight*decay);sourceHits.set(id,(sourceHits.get(id)||0)+1);
    });
  }
  const currentYear=new Date().getFullYear();
  const ranked=[...score.entries()].map(([id,value])=>{const item=logicalById.get(id),year=yearNumber(item),hits=sourceHits.get(id)||1;let bonus=Math.min(.28,(hits-1)*.065);if((mode==='trending'||mode==='hot'||mode==='newhot')&&year===currentYear)bonus+=.18;if(mode==='newhot'&&year===currentYear-1)bonus+=.06;return {item,score:value+bonus,hits,tie:Math.abs(hash(`${mode}|${id}`))}}).filter(x=>x.item?.kind===kind).sort((a,b)=>b.score-a.score||b.hits-a.hits||a.tie-b.tie).map(x=>x.item);
  return collapseMovieSources(ranked,activeCatalog()).slice(0,limit);
}
async function blendDiscoverySourcesAndroid(bundle,mediaType,mode='trending',limit=20){
  const kind=mediaType==='show'?'series':'movie',sources=bundle?.sources||{};
  const weights={
    trending:{snoakTrakt:2.05,snoakJustwatch:1.55,snoakTvStats:1.25,snoakImdb:.9,tmdbDay:.8,traktTrending:.7,justwatch:.6,tmdbWeek:.5},
    hot:{snoakTrakt:2.55,snoakJustwatch:2.05,snoakTvStats:1.7,tmdbDay:1.4,traktTrending:1.25,justwatch:.95,tmdbWeek:.8,snoakLatest:.65,snoakImdb:.55},
    top20:{snoakJustwatch:1.8,snoakTvStats:1.65,snoakImdb:1.5,snoakRotten:1.3,snoakTrakt:1.15,stable:.55,imdbPopular:.5,tmdbPopular:.45,tmdbWeek:.35},
    newhot:{snoakLatest:2.0,snoakTraktDigital:1.45,snoakTrakt:1.15,snoakJustwatch:1.0,fresh:.8,tmdbDay:.65,tmdbWeek:.35},
    streaming:{snoakJustwatch:2.0,snoakLatest:1.05,justwatch:.8,snoakTrakt:.7,stable:.35},
    watched:{mostWatched:1.7,snoakTvStats:1.45,snoakTrakt:1.0,snoakJustwatch:.65,tmdbWeek:.45},
    boxoffice:{boxOffice:1.8,fresh:1.2,snoakTvStats:.7,snoakTrakt:.55,tmdbDay:.45}
  }[mode]||{};
  const score=new Map(),sourceHits=new Map(),logicalById=new Map();
  for(const [name,weight] of Object.entries(weights)){
    const payload=sources[name];if(!payload||!(Array.isArray(payload)?payload.length:Object.keys(payload||{}).length))continue;
    const rankedFeed=mode==='top20'||mode==='hot',sourceLimit=rankedFeed?800:200,matchLimit=rankedFeed?HOME_RANKED_ROW_LIMIT:HOME_STANDARD_ROW_LIMIT;
    const matched=await androidMatchDiscoveryPayload(payload,mediaType,{sourceLimit,limit:matchLimit});
    matched.forEach((raw,rank)=>{const item=androidFastSavedItem(raw.id)||raw,id=item.id;logicalById.set(id,item);const decay=1/(1+rank*.095);score.set(id,(score.get(id)||0)+weight*decay);sourceHits.set(id,(sourceHits.get(id)||0)+1)});
    await new Promise(r=>setTimeout(r,0));
  }
  const currentYear=new Date().getFullYear();
  return [...score.entries()].map(([id,value])=>{const item=logicalById.get(id),year=yearNumber(item),hits=sourceHits.get(id)||1;let bonus=Math.min(.28,(hits-1)*.065);if((mode==='trending'||mode==='hot'||mode==='newhot')&&year===currentYear)bonus+=.18;if(mode==='newhot'&&year===currentYear-1)bonus+=.06;return {item,score:value+bonus,hits,tie:Math.abs(hash(`${mode}|${id}`))}}).filter(x=>x.item?.kind===kind).sort((a,b)=>b.score-a.score||b.hits-a.hits||a.tie-b.tie).map(x=>x.item).slice(0,limit);
}

async function blendDiscoverySourcesNative(bundle,mediaType,mode='trending',limit=20){
  const kind=mediaType==='show'?'series':'movie',sources=bundle?.sources||{};
  const weights={
    trending:{snoakTrakt:2.05,snoakJustwatch:1.55,snoakTvStats:1.25,snoakImdb:.9,tmdbDay:.8,traktTrending:.7,justwatch:.6,tmdbWeek:.5},
    hot:{snoakTrakt:2.55,snoakJustwatch:2.05,snoakTvStats:1.7,tmdbDay:1.4,traktTrending:1.25,justwatch:.95,tmdbWeek:.8,snoakLatest:.65,snoakImdb:.55},
    top20:{snoakJustwatch:1.8,snoakTvStats:1.65,snoakImdb:1.5,snoakRotten:1.3,snoakTrakt:1.15,stable:.55,imdbPopular:.5,tmdbPopular:.45,tmdbWeek:.35},
    newhot:{snoakLatest:2.0,snoakTraktDigital:1.45,snoakTrakt:1.15,snoakJustwatch:1.0,fresh:.8,tmdbDay:.65,tmdbWeek:.35},
    streaming:{snoakJustwatch:2.0,snoakLatest:1.05,justwatch:.8,snoakTrakt:.7,stable:.35},
    watched:{mostWatched:1.7,snoakTvStats:1.45,snoakTrakt:1.0,snoakJustwatch:.65,tmdbWeek:.45},
    boxoffice:{boxOffice:1.8,fresh:1.2,snoakTvStats:.7,snoakTrakt:.55,tmdbDay:.45}
  }[mode]||{};
  const score=new Map(),sourceHits=new Map(),logicalById=new Map();
  for(const [name,weight] of Object.entries(weights)){
    const payload=sources[name];if(!payload||!(Array.isArray(payload)?payload.length:Object.keys(payload||{}).length))continue;
    const rankedFeed=mode==='top20'||mode==='hot',sourceLimit=rankedFeed?800:200,matchLimit=rankedFeed?HOME_RANKED_ROW_LIMIT:HOME_STANDARD_ROW_LIMIT;
    const result=await nativeCatalogMatchPayload(payload,mediaType,{sourceLimit,limit:matchLimit,providerIds:nativeEnabledProviderIds()}).catch(()=>null),matched=cacheNativeItems(result?.items||[]);
    matched.forEach((item,rank)=>{const id=item.id;logicalById.set(id,item);const decay=1/(1+rank*.095);score.set(id,(score.get(id)||0)+weight*decay);sourceHits.set(id,(sourceHits.get(id)||0)+1)});
  }
  const currentYear=new Date().getFullYear();
  return [...score.entries()].map(([id,value])=>{const item=logicalById.get(id),year=yearNumber(item),hits=sourceHits.get(id)||1;let bonus=Math.min(.28,(hits-1)*.065);if((mode==='trending'||mode==='hot'||mode==='newhot')&&year===currentYear)bonus+=.18;if(mode==='newhot'&&year===currentYear-1)bonus+=.06;return {item,score:value+bonus,hits,tie:Math.abs(hash(`${mode}|${id}`))}}).filter(x=>x.item?.kind===kind).sort((a,b)=>b.score-a.score||b.hits-a.hits||a.tie-b.tie).map(x=>x.item).slice(0,limit);
}

async function legacyDiscoveryFallback(id,apiKey){
  if(!apiKey)return[];
  const mediaType=discoveryRowMediaType(id);
  if(id==='top20-movies'||id==='top20-shows'){
    const payload=await getMDBListStreamingChart({apiKey,mediaType});
    if(nativeCatalogMode){const result=await nativeCatalogMatchPayload(payload,mediaType,{sourceLimit:800,limit:HOME_RANKED_ROW_LIMIT,providerIds:nativeEnabledProviderIds()});return cacheNativeItems(result?.items||[])}
    if(NATIVE_ANDROID)return androidMatchDiscoveryPayload(payload,mediaType,{sourceLimit:800,limit:HOME_RANKED_ROW_LIMIT});
    return matchMDBListToCatalog(payload,activeCatalog(),{sourceLimit:800,limit:HOME_RANKED_ROW_LIMIT,mediaType});
  }
  if(id==='trending-movies'||id==='trending-shows'||id==='streaming-movies'||id==='streaming-shows'){
    const payload=await getMDBListStreamingChart({apiKey,mediaType});return NATIVE_ANDROID?androidMatchDiscoveryPayload(payload,mediaType,{limit:HOME_STANDARD_ROW_LIMIT}):matchMDBListToCatalog(payload,activeCatalog(),{limit:HOME_STANDARD_ROW_LIMIT,mediaType});
  }
  return[];
}
function completeTop100FromLibrary(id,list=[]){
  if(id!=='top20-movies'&&id!=='top20-shows')return list;
  const kind=id==='top20-movies'?'movie':'series',out=[],seenIds=new Set(),seenExternal=new Set(),seenTitles=new Map();
  for(const item of list||[]){if(item?.kind===kind)appendUniqueHomeTitle(out,item,seenIds,seenExternal,seenTitles);if(out.length>=HOME_RANKED_ROW_LIMIT)break}
  if(out.length<HOME_RANKED_ROW_LIMIT){
    const currentYear=new Date().getFullYear(),source=androidFastHomeMode()?(kind==='movie'?androidFastCatalog().movie:androidFastCatalog().series):items(kind);
    const fallback=[...(source||[])].filter(x=>x&&!isDemoItem(x)).sort((a,b)=>{
      const ay=yearNumber(a),by=yearNumber(b),ar=ratingNumber(a),br=ratingNumber(b),aa=providerAddedNumber(a),ba=providerAddedNumber(b);
      const ah=(ay===currentYear?3:ay===currentYear-1?1.6:0)+Math.min(1.2,ar/8),bh=(by===currentYear?3:by===currentYear-1?1.6:0)+Math.min(1.2,br/8);
      return bh-ah||ba-aa||br-ar||String(a.name||'').localeCompare(String(b.name||''));
    });
    for(const item of fallback){appendUniqueHomeTitle(out,item,seenIds,seenExternal,seenTitles);if(out.length>=HOME_RANKED_ROW_LIMIT)break}
  }
  return out.slice(0,HOME_RANKED_ROW_LIMIT);
}

async function fetchBuiltInDiscovery(id,apiKey,force=false){
  const mediaType=discoveryRowMediaType(id),mode=discoveryRowMode(id),rowLimit=String(id).startsWith('top20-')?HOME_RANKED_ROW_LIMIT:HOME_STANDARD_ROW_LIMIT;
  if(mode==='snoak'){
    const listKey=SNOAK_CURATED_ROWS.get(id);
    try{
      const payload=await fetchSwoopCuratedList({settings:state.settings,listKey});
      const source=payload?.items||[];
      const items=nativeCatalogMode?cacheNativeItems((await nativeCatalogMatchPayload(source,mediaType,{sourceLimit:800,limit:HOME_STANDARD_ROW_LIMIT,providerIds:nativeEnabledProviderIds()})).items||[]):NATIVE_ANDROID?await androidMatchDiscoveryPayload(source,mediaType,{sourceLimit:800,limit:HOME_STANDARD_ROW_LIMIT}):matchMDBListToCatalog(source,activeCatalog(),{sourceLimit:800,limit:HOME_STANDARD_ROW_LIMIT,mediaType});
      return {items:items.slice(0,rowLimit),enhanced:true,snoak:true,source:'snoak',sourceUpdatedAt:Number(payload?.sourceUpdatedAt||0)};
    }catch(err){
      const fallback=nativeCatalogMode?(nativeHomeRowCache.get(id)||[]):localHomeRowItems(id);
      return {items:(fallback||[]).slice(0,rowLimit),enhanced:false,snoak:false,source:'local-fallback',warning:err.message||String(err)};
    }
  }
  try{
    const bundle=await discoveryBundle(mediaType,force);let items=nativeCatalogMode?await blendDiscoverySourcesNative(bundle,mediaType,mode,rowLimit):NATIVE_ANDROID?await blendDiscoverySourcesAndroid(bundle,mediaType,mode,rowLimit):blendDiscoverySources(bundle,mediaType,mode,rowLimit);
    if(String(id).startsWith('top20-')&&items.length<HOME_RANKED_ROW_LIMIT&&apiKey){
      const supplement=await legacyDiscoveryFallback(id,apiKey).catch(()=>[]),seen=new Set(items.map(x=>x.id));
      for(const item of supplement){if(item&&!seen.has(item.id)){seen.add(item.id);items.push(item)}if(items.length>=HOME_RANKED_ROW_LIMIT)break}
    }
    items=completeTop100FromLibrary(id,items);
    return {items:items.slice(0,rowLimit),enhanced:Boolean(bundle?.enhanced),snoak:Boolean(bundle?.snoak),source:nativeCatalogMode?'swoop-sqlite':'swoop'};
  }
  catch(err){let fallback=await legacyDiscoveryFallback(id,apiKey).catch(()=>[]);fallback=completeTop100FromLibrary(id,fallback);if(fallback.length)return {items:fallback.slice(0,rowLimit),enhanced:false,source:'legacy',warning:err.message||String(err)};throw err}
}
async function refreshDiscoveryRows(force=false,userInitiated=false,onProgress=null,idsOverride=null){
  if(discoveryRefreshing||!state.catalog.length)return;
  const apiKey=String(state.settings.mdblistApiKey||'').trim();
  const mandatory=['top20-movies','top20-shows'];
  const requested=Array.isArray(idsOverride)&&idsOverride.length?idsOverride:state.settings.homeRows;
  const wanted=[...new Set([...requested.filter(id=>WEB_ROW_IDS.has(id)),...mandatory])];
  const custom=requested.filter(id=>String(id).startsWith('custom:'));
  const now=Date.now(),staleIds=wanted.filter(id=>{const cache=state.webDiscovery?.[id];return force||!cache?.updatedAt||now-cache.updatedAt>discoveryRowTtl(id)||(String(id).startsWith('top20-')&&Number(cache?.rankingSchema||0)<TOP100_RANKING_SCHEMA)});
  const staleCustom=apiKey?custom.map(id=>state.mdblistRows.find(r=>`custom:${r.uid}`===id)).filter(r=>r?.source&&(force||!r.updatedAt||now-r.updatedAt>DISCOVERY_REFRESH_MS)):[];
  if(!staleIds.length&&!staleCustom.length)return;
  discoveryRefreshing=true;discoveryMessage='Refreshing Swoop TV discovery…';const totalJobs=Math.max(1,staleIds.length+staleCustom.length),manualTask=Boolean(userInitiated);if(manualTask)taskProgressStart({title:'Refreshing Swoop TV discovery…',detail:`Updating 0 of ${totalJobs} discovery rows…`,progress:3});let completedJobs=0;try{onProgress?.({completed:0,total:totalJobs,id:'',label:'Preparing Home'});}catch{}
  try{
    if(force)discoveryBundleMemory.clear();
    for(const id of staleIds){const label=homeRowDef(id)?.label||'Home row';try{onProgress?.({completed:completedJobs,total:totalJobs,id,label});}catch{}if(manualTask)taskProgressUpdate({detail:`Updating ${label}…`,progress:5+(completedJobs/totalJobs)*88});try{const previous=state.webDiscovery?.[id],result=await fetchBuiltInDiscovery(id,apiKey,false),nextItems=result.items||[],previousItems=Array.isArray(previous?.items)?previous.items:[];if(String(id).startsWith('top20-')&&!nextItems.length&&previousItems.length){state.webDiscovery[id]={...previous,updatedAt:Number(previous.updatedAt||0),error:'Latest trending refresh returned no matches; keeping the last good ranking.'};}else{state.webDiscovery[id]={itemIds:nextItems.map(x=>x.id),items:NATIVE_ANDROID||nativeCatalogMode?nextItems:undefined,updatedAt:Date.now(),sourceUpdatedAt:Number(result.sourceUpdatedAt||0),rankingSchema:String(id).startsWith('top20-')?TOP100_RANKING_SCHEMA:Number(previous?.rankingSchema||0),error:'',enhanced:result.enhanced,snoak:Boolean(result.snoak),source:result.source};}}catch(err){state.webDiscovery[id]={...(state.webDiscovery[id]||{}),updatedAt:Number(state.webDiscovery?.[id]?.updatedAt||0),error:err.message||String(err)};}completedJobs++;try{onProgress?.({completed:completedJobs,total:totalJobs,id,label});}catch{}if(manualTask)taskProgressUpdate({detail:`Updated ${completedJobs} of ${totalJobs} discovery rows…`,progress:5+(completedJobs/totalJobs)*88});await new Promise(r=>setTimeout(r,0));}
    for(const row of staleCustom){const id=`custom:${row.uid}`,label=row.name||'Custom row';try{onProgress?.({completed:completedJobs,total:totalJobs,id,label});}catch{}if(manualTask)taskProgressUpdate({detail:`Updating ${label}…`,progress:5+(completedJobs/totalJobs)*88});try{const payload=await getMDBListItems({apiKey,listId:row.source.listId,username:row.source.username,listName:row.source.listName});row.items=nativeCatalogMode?cacheNativeItems((await nativeCatalogMatchPayload(payload,'movie',{sourceLimit:200,limit:120,providerIds:nativeEnabledProviderIds()})).items||[]):matchMDBListToCatalog(payload,activeCatalog());row.updatedAt=Date.now();row.error='';}catch(err){row.updatedAt=Date.now();row.error=err.message||String(err);}completedJobs++;try{onProgress?.({completed:completedJobs,total:totalJobs,id,label});}catch{}if(manualTask)taskProgressUpdate({detail:`Updated ${completedJobs} of ${totalJobs} discovery rows…`,progress:5+(completedJobs/totalJobs)*88});await new Promise(r=>setTimeout(r,0));}
    if(manualTask)taskProgressUpdate({detail:'Saving refreshed discovery rows…',progress:96});await persist('cache');discoveryMessage='Discovery updated';if(manualTask)taskProgressEnd({success:true,title:'Discovery updated',detail:`${completedJobs} discovery row${completedJobs===1?'':'s'} refreshed.`,hold:1100});
  }catch(err){if(manualTask)taskProgressEnd({success:false,title:'Discovery refresh stopped',detail:err.message||String(err),hold:2200});throw err}finally{
    discoveryRefreshing=false;
    const changedIds=[...staleIds,...staleCustom.map(r=>`custom:${r.uid}`)];
    if(modal==='homeRows'&&!detailItem&&!playerItem)render();
    else if(state.page==='home'&&!detailItem&&!playerItem){patchMountedHomeRows(changedIds);if(changedIds.some(id=>String(id).startsWith('top20-')||String(id).startsWith('trending-')))replaceHomeHero();}
    setTimeout(()=>{discoveryMessage='';if(state.page==='home'&&!detailItem&&!playerItem)patchMountedHomeRows([])},1800);
  }
}
function card(item,poster=false,opts={}){
  if(!item)return'';
  item=visualItem(item);
  const continueSeriesPoster=Boolean(poster&&item.kind==='episode'&&item.parentSeriesId&&item._continueSeriesPoster);
  const fallback=item.demoColor||`linear-gradient(135deg,hsl(${Math.abs(hash(item._continueSeriesTitle||item.name))%360} 44% 34%),#080b12)`;
  const trustedRating=item.kind==='movie'||item.kind==='series'?displayRating(item):tenPointRating(item.rating);
  const imdbRating=item.kind==='movie'||item.kind==='series'?displayImdbRating(item):'';
  const sub=item.kind==='live'?(item.group||'Live TV'):(item.kind==='episode'&&item.season?`S${item.season} E${item.episodeNum||''}`:'');
  const art=item.logo?`<img class="card-art" data-swoop-art="${esc(item.logo)}" alt="" loading="lazy">`:'';
  const posterOwnsTitle=Boolean(poster&&((['movie','series'].includes(item.kind)&&item.logo)||continueSeriesPoster));
  const displayTitle=continueSeriesPoster?cleanDisplayTitle({name:item._continueSeriesTitle||item.group||item.name}):cleanDisplayTitle(item);
  const rank=Number.isFinite(Number(opts.rank))&&Number(opts.rank)>0?Number(opts.rank):null;
  const suppressTvPosterTitle=Boolean(NATIVE_ANDROID&&poster&&item.logo);
  const titleHtml=((rank&&NATIVE_ANDROID)||suppressTvPosterTitle)?'':(posterOwnsTitle&&!NATIVE_ANDROID)?'':`<div class="card-title tv-card-title-fallback">${esc(displayTitle)}</div>`;
  const subHtml=sub?`<div class="card-sub">${esc(sub)}</div>`:'';
  const liveBadge=item.kind==='live'?`<div class="badge"><span class="live-dot"></span>LIVE</div>`:'';
  const action=item.kind==='live'||item.kind==='episode'?'data-play':'data-detail';
  const hoverAction=item.kind==='live'?'Play channel':item.kind==='episode'?'Play episode':'More info';
  const saved=isInMyList(item)?'<span class="card-saved">✓ MY LIST</span>':'';
  const liveFav=item.kind==='live'&&isLiveFavourite(item)?'<span class="card-live-fav">★ FAVOURITE</span>':'';
  const liveQuality=item.kind==='live'?qualityLabel(item):'';
  const qualityBadge=liveQuality?`<span class="card-quality">${esc(liveQuality)}</span>`:'';
  const sources=Number(item.sourceCount||item.sources?.length||0)>1?`<span class="card-sources">${Number(item.sourceCount||item.sources.length)} SOURCES</span>`:'';
  const watched=item.kind!=='live'&&isWatched(item)?'<span class="card-watched">✓ WATCHED</span>':'';
  const imdbBadge=poster&&['movie','series'].includes(item.kind)&&imdbRating?`<span class="card-imdb-rating"><b>IMDb</b> ${esc(imdbRating)}</span>`:'';
  const progress=Number.isFinite(Number(opts.progress))?Math.max(0,Math.min(100,Number(opts.progress))):null;
  const rankBadge=rank?`<div class="rank-badge ${rank>=100?'rank-three-digit':rank>=10?'rank-two-digit':'rank-one-digit'}"><span>${rank}</span></div>`:'';
  const imdbHydrationAttr=poster&&['movie','series'].includes(item.kind)?` data-imdb-item="${esc(item.id)}"`:'';
  return `<button class="card ${poster?'poster':'landscape'} ${posterOwnsTitle?'poster-art-title':''} ${item.kind==='live'?'live-card':''} ${rank?'ranked-card':''}" ${action}="${esc(item.id)}"${imdbHydrationAttr} style="--card-bg:${fallback}" aria-label="${esc(displayTitle)}">
    <div class="card-bg"></div>${art}<div class="card-shade"></div>${rankBadge}${liveBadge}${saved}${liveFav}${qualityBadge}${sources}${watched}${imdbBadge}
    <div class="card-copy">${titleHtml}${subHtml}<div class="card-hover"><span class="card-hover-icon">${item.kind==='live'||item.kind==='episode'?'▶':'ⓘ'}</span><span>${hoverAction}</span></div></div>
    ${progress!==null?`<div class="progress"><i style="width:${progress}%"></i></div>`:''}</button>`;
}
function profileAvatarHtml(profile,cls=''){
  const av=avatarById(profile?.avatar||'lion');
  if(profile?.name==='+')return `<span class="profile-avatar ${cls} profile-avatar-add" title="Add profile"><b>+</b></span>`;
  return `<span class="profile-avatar ${cls} photo-avatar" title="${esc(av.label)}"><img src="${esc(av.image)}" alt="${esc(av.label)} avatar" draggable="false"></span>`;
}
function profilePickerPage(){
  const profiles=state.profiles||[];
  return `<main class="profile-picker-page"><div class="profile-picker-brand"><span class="brand-mark">S</span><span>SWOOP <b>TV</b></span></div><div class="profile-picker-shell"><div class="eyebrow">PERSONALISED SWOOP TV</div><h1>Who’s watching?</h1><p>Every profile gets its own theme, Home layout, recommendations, Continue Watching, My SwoopTV saves and favourite channels.</p><div class="profile-picker-grid">${profiles.map(p=>{const t=profileTheme(p);return `<button class="profile-choice profile-theme-${esc(t.id)}" data-profile-select="${esc(p.id)}">${profileAvatarHtml(p,'profile-avatar-xl')}<strong>${esc(p.name)}</strong><span>${p.kids?'Kids profile':'Personal profile'}${p.pinHash?' · PIN':''}</span><em class="profile-theme-chip" style="--theme-chip:${esc(t.swatch)}">${esc(t.name)}</em></button>`}).join('')}<button class="profile-choice profile-add-choice" data-profile-add>${profileAvatarHtml({name:'+',avatar:'elephant'},'profile-avatar-xl')}<strong>Add Profile</strong><span>Create another personalised Swoop TV</span><em class="profile-theme-chip">Choose a theme</em></button></div>${NATIVE_ANDROID?`<div class="profile-starmeter-prep ${starmeterBackgroundReady?'ready':''}" data-profile-starmeter-prep><span>${starmeterBackgroundReady?'✓':`${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%`}</span><strong>${esc(starmeterBackgroundReady?'STARmeter Top 100 ready':starmeterBackgroundStatus)}</strong></div>`:''}<div class="profile-picker-actions"><button class="btn secondary" data-profile-manage>Manage Profiles</button><button class="btn secondary" data-page="settings">⚙ Settings</button></div></div></main>`;
}
function focusDefaultProfileChoice(){
  if(!NATIVE_ANDROID||!profilePickerOpen)return false;const first=document.querySelector('[data-profile-select]');if(!first)return false;
  try{first.focus({preventScroll:true})}catch{first.focus()}tvLastFocusedElement=first;return true;
}
function profilesModal(){
  return `<div class="modal-backdrop profile-manage-backdrop" data-close-modal><div class="modal profile-manage-modal" data-modal-card><div class="modal-head"><div><div class="eyebrow">HOUSEHOLD</div><h2>Profiles</h2><p>Each person can have a completely different Swoop TV presentation without changing your shared TV providers.</p></div><button class="icon-btn" data-close>✕</button></div><div class="modal-body"><div class="profile-manage-list">${state.profiles.map(p=>{const t=profileTheme(p);return `<div class="profile-manage-row">${profileAvatarHtml(p,'profile-avatar-lg')}<div><strong>${esc(p.name)}</strong><span>${p.kids?'Kids restrictions on':'Standard profile'}${p.pinHash?' · PIN protected':''} · ${esc(t.name)} theme</span></div><button class="btn secondary compact-btn" data-profile-select="${esc(p.id)}">Switch</button><button class="btn secondary compact-btn" data-profile-edit="${esc(p.id)}">Edit</button></div>`}).join('')}</div><button class="btn accent profile-add-btn" data-profile-add>＋ Add Profile</button></div></div></div>`;
}
function profileEditorModal(){
  const existing=state.profiles.find(p=>p.id===profileEditId)||null,
    p=existing||makeProfile({name:'New Profile',avatar:PROFILE_AVATARS[state.profiles.length%PROFILE_AVATARS.length].id,profileSettings:{themeId:'swoop',backgroundColor:'#030306',backgroundOverride:false,movieSourcePreferences:{},homeRows:[...DEFAULT_HOME_ROWS],smartHomeOrder:true}}),
    selectedTheme=profileTheme(p),
    pinLabel=p.pinHash?'Change profile PIN':'Profile PIN',
    pinPlaceholder=p.pinHash?'Leave blank to keep current PIN':'4–8 digits',
    pinControl=NATIVE_ANDROID
      ? `<div class="profile-pin-entry"><input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="${pinPlaceholder}" readonly tabindex="-1" data-profile-pin-input><button class="btn secondary compact-btn profile-pin-activate" type="button" data-profile-pin-activate>${p.pinHash?'Change PIN':'Set PIN'}</button></div>`
      : `<input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="${pinPlaceholder}">`;
  return `<div class="modal-backdrop profile-edit-backdrop" data-close-modal><div class="modal profile-edit-modal profile-edit-landscape" data-modal-card>
    <div class="modal-head profile-edit-head"><div><div class="eyebrow">${existing?'EDIT PROFILE':'NEW PROFILE'}</div><h2>${existing?'Personalise this profile':'Create a profile'}</h2><p>Make this profile feel right for the person watching.</p></div><button class="icon-btn" data-close aria-label="Close profile editor">✕</button></div>
    <div class="modal-body profile-edit-body"><form id="profileForm" class="profile-editor-form">
      <input type="hidden" name="id" value="${esc(existing?.id||'')}"><input type="hidden" name="avatar" value="${esc(p.avatar)}" id="profileAvatarValue">
      <div class="profile-editor-layout">
        <section class="profile-editor-panel profile-editor-identity">
          <div class="profile-editor-section-title"><span class="eyebrow">PROFILE</span><strong>Identity</strong></div>
          <div class="field profile-name-field"><label>Profile name</label><input name="name" maxlength="24" value="${esc(p.name)}" required></div>
          <div class="profile-avatar-picker"><label>Choose an avatar</label><div>${PROFILE_AVATARS.map(av=>`<button type="button" class="profile-avatar-option ${av.id===p.avatar?'active':''}" data-profile-avatar="${av.id}" aria-label="${esc(av.label)}" aria-pressed="${av.id===p.avatar?'true':'false'}"><span><img src="${esc(av.image)}" alt="" draggable="false"></span><small>${esc(av.label)}</small></button>`).join('')}</div></div>
        </section>
        <section class="profile-editor-panel profile-editor-preferences">
          <div class="profile-editor-section-title"><span class="eyebrow">LOOK & FEEL</span><strong>Theme</strong></div>
          <div class="profile-theme-picker profile-theme-picker-tv">${themePickerHtml(selectedTheme.id)}</div>
          <div class="profile-option-grid">
            <label class="remember-row profile-option-card"><input type="checkbox" name="kids" ${p.kids?'checked':''}><span><strong>Kids profile</strong><small>Filters mature titles when provider metadata allows.</small></span></label>
            <label class="remember-row profile-option-card"><input type="checkbox" name="smartHome" ${p.profileSettings?.smartHomeOrder!==false?'checked':''}><span><strong>Smart Home</strong><small>Personalises optional Home rows from viewing history.</small></span></label>
          </div>
          <div class="field profile-pin-field"><label>${pinLabel} <span class="optional">Optional</span></label>${pinControl}<small class="form-hint">Require 4–8 digits before switching into this profile.</small></div>
          ${p.pinHash?`<label class="profile-remove-pin"><input type="checkbox" name="removePin"> Remove existing PIN</label>`:''}
        </section>
      </div>
      <div class="profile-form-actions profile-form-actions-tv"><button class="btn accent" type="submit">${existing?'Save Profile':'Create Profile'}</button>${existing&&state.profiles.length>1?`<button class="btn danger" type="button" data-profile-delete="${esc(existing.id)}">Delete Profile</button>`:''}</div>
    </form></div>
  </div></div>`;
}
function pinModal(){
  const p=state.profiles.find(x=>x.id===pendingProfileId);if(!p)return'';
  return `<div class="modal-backdrop profile-pin-backdrop"><div class="modal profile-pin-modal" data-modal-card><div class="modal-body"><div class="profile-pin-head">${profileAvatarHtml(p,'profile-avatar-xl')}<div><div class="eyebrow">PROFILE LOCKED</div><h2>${esc(p.name)}</h2><p>Enter this profile’s PIN to continue.</p></div></div><form id="profilePinForm"><input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autofocus placeholder="PIN" required>${profilePinError?`<div class="profile-pin-error">${esc(profilePinError)}</div>`:''}<div class="cta-row"><button class="btn accent" type="submit">Unlock</button><button class="btn secondary" type="button" data-pin-cancel>Cancel</button></div></form></div></div></div>`;
}
async function pinDigest(pin,salt=''){
  const text=`${salt}|${String(pin||'')}`;
  if(globalThis.crypto?.subtle){const bytes=new TextEncoder().encode(text),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  return String(Math.abs(hash(text)));
}
function randomSalt(){try{return [...crypto.getRandomValues(new Uint8Array(12))].map(x=>x.toString(16).padStart(2,'0')).join('')}catch{return `${Date.now()}-${Math.random()}`}}
async function switchProfile(id,{skipPin=false}={}){
  const target=state.profiles.find(p=>p.id===id);if(!target)return;
  if(target.pinHash&&!skipPin){pendingProfileId=id;profilePinError='';modal='pin';profilePickerOpen=false;render();return}
  if(NATIVE_ANDROID&&!starmeterBackgroundComplete)void prepareStarmeterBeforeLogin().catch(()=>false);
  if(playerItem)await stopPlayback(true);
  const changed=target.id!==state.activeProfileId;
  if(changed){clearPersistentPageViews();syncActiveProfileFromState();state.activeProfileId=target.id;applyProfileToState(target);detailItem=null;sourceChoiceItem=null;heroRotationIndex=0;}
  profilePickerOpen=false;modal=null;state.page='home';clearPersistentPageViews(['home']);
  if(NATIVE_ANDROID&&!androidStartupGateComplete){const gate=runAndroidStartupGate();await gate;persist().catch(()=>null);toast(changed?`Switched to ${target.name}`:`Welcome, ${target.name}`);setTimeout(maybeShowWhatsNewOnLogin,120);return}
  if(!libraryRestored&&state.providers.length&&!state.catalog.length){
    storageRestoring=true;render();const nativeReady=await activateNativeCatalogIfAvailable().catch(()=>false);if(!nativeReady)await ensureDurableLibraryRestored();storageRestoring=false;
  }
  else if(nativeCatalogMode)await hydrateNativeProfileItems();
  await persist();render();if(NATIVE_ANDROID)forceAndroidHomeEntry();toast(changed?`Switched to ${target.name}`:`Welcome, ${target.name}`);if(NATIVE_ANDROID)setTimeout(maybeShowWhatsNewOnLogin,120);
}
function nav(){
  const desktop=[['home','Home'],['myswoop','My SwoopTV'],['live','Live TV'],['guide','Guide'],['starmeter','STARmeter'],['movies','Movies'],['series','TV Shows']];
  const mobile=[['home','⌂','Home'],['myswoop','♥','My SwoopTV'],['live','◉','Live'],['guide','▤','Guide'],['starmeter','★','Stars'],['movies','▰','Movies'],['series','▦','Shows']];
  return `<header class="topbar"><button class="brand brand-logo-button" data-page="home" aria-label="Swoop TV Home"><img class="swoop-brand-logo" src="./assets/swoop-tv-logo.jpg" alt="Swoop TV" /></button>
  <nav class="desktop-nav">${desktop.map(([p,label])=>`<button class="nav-btn ${state.page===p?'active':''}" data-page="${p}">${label}</button>`).join('')}</nav>
  <div class="top-actions"><button class="icon-btn search-action" data-page="search" aria-label="Search">⌕</button><button class="top-provider" data-modal="provider">☰ Providers <span class="top-provider-count">${state.providers.length||''}</span></button><button class="icon-btn settings-action ${state.page==='settings'?'active':''}" data-page="settings" aria-label="Settings" title="Settings">⚙</button><button class="profile-btn profile-switch-btn" data-profile-picker aria-label="Switch profile">${profileAvatarHtml(activeProfile(),'profile-avatar-nav')}<span>${esc(activeProfile()?.name||'Profile')}</span></button></div></header>
  <nav class="bottom-nav">${mobile.map(([p,icon,label])=>`<button class="${state.page===p?'active':''}" data-page="${p}"><span>${icon}</span>${label}</button>`).join('')}<button class="${state.page==='settings'?'active':''}" data-page="settings"><span>⚙</span>Settings</button></nav>`;
}
function rail(title,data,poster=false,meta='',opts={}){
  if(!data.length)return'';
  const cards=data.map((x,i)=>{
    const markup=card(x,poster,{progress:continueEntry(x.id)?.progress,rank:opts.ranked?i+1:null});
    if(opts.rowId!=='continue')return markup;
    return `<div class="continue-card-shell" data-continue-options-id="${esc(x.id)}" data-continue-options-series="${esc(x.parentSeriesId||'')}">${markup}</div>`;
  }).join('');
  return `<section class="section swoop-render-section ${poster?'poster-section':'landscape-section'} ${opts.ranked?'ranked-section':''} ${opts.priority?'home-priority-row':''}"${opts.rowId?` data-home-row-mounted="${esc(opts.rowId)}"`:''}${Number.isFinite(Number(opts.total))?` data-home-row-total="${Number(opts.total)}"`:''}><div class="section-head"><div><h2>${esc(title)}</h2>${meta?`<span class="section-meta">${esc(meta)}</span>`:''}</div>${opts.page?`<button class="section-link" data-page="${opts.page}">Explore all →</button>`:'<span class="rail-arrow">›</span>'}</div><div class="rail">${cards}</div></section>`;
}

function homeRowMarkup(def,dataOverride=null){
  const data=Array.isArray(dataOverride)?dataOverride:homeRowItems(def.id);
  if(!data.length){
    const androidTrendingPending=NATIVE_ANDROID&&String(def.id).startsWith('top20-');
    if(def.web&&(!NATIVE_ANDROID||androidTrendingPending))return `<section class="section swoop-render-section ${def.poster?'poster-section':'landscape-section'} ${def.ranked?'ranked-section':''} ${PINNED_HOME_ROWS.includes(def.id)?'home-priority-row':''} ${androidTrendingPending?'android-home-row-pending':''}" data-home-row-mounted="${esc(def.id)}"${androidTrendingPending?' data-home-row-pending="1"':''}><div class="section-head"><div><h2>${esc(def.label)}</h2>${androidTrendingPending?'':`<span class="section-meta">${esc(discoveryMeta(def.id,data))}</span>`}</div><span class="rail-arrow">›</span></div><div class="lazy-row-skeleton poster-skeleton">${Array.from({length:6},()=>'<i></i>').join('')}</div></section>`;
    return'';
  }
  const limit=NATIVE_ANDROID?(def.ranked?Math.min(data.length,HOME_RANKED_ROW_LIMIT):Math.min(data.length,ANDROID_TV_HOME_INITIAL_RENDER)):(String(def.id).startsWith('top20-')?HOME_RANKED_ROW_LIMIT:HOME_STANDARD_ROW_LIMIT);
  return rail(def.label,data.slice(0,limit),def.poster,discoveryMeta(def.id,data),{page:def.page,ranked:def.ranked,rowId:def.id,priority:PINNED_HOME_ROWS.includes(def.id),total:data.length});
}
function androidInitialHomeRowsMarkup(rows=[],targetPopulated=ANDROID_TV_HOME_EAGER_ROWS){
  const chunks=[];let populated=0;
  for(const def of rows){
    const data=homeRowItems(def.id),markup=homeRowMarkup(def,data);if(!markup)continue;
    chunks.push(markup);if(data.length)populated++;
    // Pending Top 100 skeletons do not consume the real-row budget. This keeps useful
    // provider rows on-screen while current trending matches refresh in the background.
    if(populated>=Math.max(1,Number(targetPopulated||1)))break;
  }
  return chunks.join('');
}
function bindRailStability(root=document){
  root.querySelectorAll('[data-home-row-mounted] .rail').forEach(rail=>{
    if(rail.dataset.swoopRailBound==='1')return;rail.dataset.swoopRailBound='1';
    const mark=()=>{const section=rail.closest('[data-home-row-mounted]');if(section)section.dataset.railInteractedAt=String(Date.now())};
    rail.addEventListener('pointerdown',mark,{passive:true});rail.addEventListener('wheel',mark,{passive:true});rail.addEventListener('scroll',mark,{passive:true});
  });
}
function patchMountedHomeRows(ids=[]){
  if(state.page!=='home'||detailItem||playerItem)return false;
  let changed=false;
  for(const id of [...new Set((ids||[]).filter(Boolean))]){
    const current=[...document.querySelectorAll('[data-home-row-mounted]')].find(el=>el.dataset.homeRowMounted===String(id));
    if(!current)continue;
    const def=homeRowDef(id);if(!def)continue;
    const currentRail=current.querySelector('.rail'),left=currentRail?.scrollLeft||0,lastInteraction=Number(current.dataset.railInteractedAt||0),userActive=Boolean(currentRail&&(left>6||Date.now()-lastInteraction<1800||current.matches(':hover')||current.contains(document.activeElement)));
    if(userActive){const meta=current.querySelector('.section-meta'),data=homeRowItems(id);if(meta)meta.textContent=discoveryMeta(id,data);current.dataset.deferredRefresh='1';continue}
    const wrap=document.createElement('div');wrap.innerHTML=homeRowMarkup(def);const next=wrap.firstElementChild;
    if(!next){current.remove();changed=true;continue}
    current.replaceWith(next);const railEl=next.querySelector('.rail');if(railEl)railEl.scrollLeft=left;hydrateArtwork(next);bindDynamicCards(next);bindRailStability(next);changed=true;
  }
  const status=document.querySelector('.discovery-status');if(status){status.textContent=discoveryRefreshing?'Updating recommendations…':discoveryMessage||'Discovery ready';status.classList.toggle('busy',discoveryRefreshing)}
  return changed;
}
function lazyHomePlaceholder(def){if(NATIVE_ANDROID)return'';return `<section class="section lazy-home-row swoop-render-section ${def.poster?'poster-placeholder':'landscape-placeholder'}" data-lazy-home-row="${esc(def.id)}"><div class="section-head"><div><h2>${esc(def.label)}</h2><span class="section-meta">Loading…</span></div></div><div class="lazy-row-skeleton ${def.poster?'poster-skeleton':'landscape-skeleton'}">${Array.from({length:5},()=>'<i></i>').join('')}</div></section>`}
let tvHomeExpansionToken=0;
function prepareTvHomeRow(def){
  const wrap=document.createElement('div');wrap.innerHTML=homeRowMarkup(def);const next=wrap.firstElementChild;if(!next)return Promise.resolve(null);
  const imgs=[...next.querySelectorAll('img[data-swoop-art]')].slice(0,10);if(!imgs.length)return Promise.resolve(next);
  return Promise.all(imgs.map(img=>new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;resolve()};img.addEventListener('load',finish,{once:true});img.addEventListener('error',finish,{once:true});loadArtwork(img,{priority:'high'});setTimeout(finish,700)}))).then(()=>next);
}
function mountNextAndroidHomeRows(count=1){
  if(!NATIVE_ANDROID||profilePickerOpen||state.page!=='home'||!androidPreparedHomeReady)return false;
  const host=document.querySelector('[data-tv-home-rows]');if(!host)return false;
  const mounted=new Set([...host.querySelectorAll('[data-home-row-mounted]')].map(el=>String(el.dataset.homeRowMounted||'')));
  let added=0;
  for(const def of selectedHomeRows()){
    if(mounted.has(String(def.id)))continue;
    const wrap=document.createElement('div');wrap.innerHTML=homeRowMarkup(def);const next=wrap.firstElementChild;
    if(!next)continue;
    host.appendChild(next);bindDynamicCards(next);bindRailStability(next);hydrateArtwork(next);mounted.add(String(def.id));added++;
    if(added>=Math.max(1,Number(count||1)))break;
  }
  return added>0;
}
function scheduleAndroidHomeExpansion(){
  // v0.8.5: no automatic post-Home expansion. Every row's data is prepared during the launch
  // gate, then additional DOM rows are mounted only as navigation reaches them. This prevents
  // background row construction/artwork work from stealing the remote's interaction budget.
  return false;
}

function mountLazyHomeRows(root=document){
  lazyHomeObserver?.disconnect?.();lazyHomeObserver=null;
  const nodes=[...root.querySelectorAll('[data-lazy-home-row]')];if(!nodes.length)return;
  const mount=node=>{const def=homeRowDef(node.dataset.lazyHomeRow);if(!def)return node.remove();const wrap=document.createElement('div');wrap.innerHTML=homeRowMarkup(def);const next=wrap.firstElementChild;if(next){node.replaceWith(next);hydrateArtwork(next);bindDynamicCards(next);bindRailStability(next)}else node.remove()};
  if(!('IntersectionObserver'in window)){nodes.forEach(mount);return}
  lazyHomeObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){lazyHomeObserver.unobserve(entry.target);requestAnimationFrame(()=>mount(entry.target))}},{rootMargin:'500px 0px'});nodes.forEach(n=>lazyHomeObserver.observe(n));
}

function fallbackFeatureItem(){
  const cat=activeCatalog();
  const recent=state.continueWatching.map(x=>savedItem(x.id)||x.item).find(Boolean);
  const cw=recent?.kind==='episode'?savedItem(recent.parentSeriesId):recent;
  const movieList=items('movie');
  return cw||movieList.find(x=>x.backdrop||x.logo)||cat.find(x=>x.kind==='series'&&(x.backdrop||x.logo))||movieList[0]||cat.find(x=>x.kind==='series')||cat.find(x=>x.kind==='live')||null;
}
function heroTopFive(kind){
  const webId=kind==='movie'?'top20-movies':'top20-shows';
  const pool=[...cachedWebRowItems(webId).filter(x=>x?.kind===kind)];
  const fallbackIds=kind==='movie'?['trending-movies','top-rated-movies','new-movies']:['trending-shows','top-rated-shows','new-shows'];
  for(const id of fallbackIds){
    const source=WEB_ROW_IDS.has(id)?cachedWebRowItems(id):localHomeRowItems(id);
    for(const item of source){if(item?.kind===kind&&!pool.some(x=>x.id===item.id))pool.push(item);if(pool.length>=5)break}
    if(pool.length>=5)break;
  }
  if(pool.length<5){for(const item of items(kind)){if(!pool.some(x=>x.id===item.id))pool.push(item);if(pool.length>=5)break}}
  return pool.slice(0,5).map((item,index)=>({...item,_heroRank:index+1,_heroFeed:kind==='movie'?'TOP 5 MOVIE':'TOP 5 TV SHOW'}));
}
function heroCandidates(){
  if(androidFastHomeMode())return androidFastHeroCandidates();
  const movies=heroTopFive('movie'),shows=heroTopFive('series'),out=[];
  for(let i=0;i<5;i++){if(movies[i])out.push(movies[i]);if(shows[i])out.push(shows[i])}
  if(!out.length){const fallback=fallbackFeatureItem();if(fallback)out.push(fallback)}
  return out;
}
function featureItem(){const pool=heroCandidates();if(!pool.length)return null;heroRotationIndex=((heroRotationIndex%pool.length)+pool.length)%pool.length;return pool[heroRotationIndex]}
function heroTitleLogoState(item={}){
  const cached=state.metadataCache?.[item.id]||{},logo=String(item.titleLogo||cached.titleLogo||'');
  const media=Boolean(item&&!isDemoItem(item)&&['movie','series'].includes(item.kind));
  const settled=Boolean(logo||cached.titleLogoCheckedAt);
  return {logo,pending:media&&!settled,settled};
}
function hero(feature,providerName,rotation={}){
  if(!feature)return'';
  feature=visualItem(feature);
  const isLive=feature.kind==='live',isSeries=feature.kind==='series';
  const displayTitle=cleanDisplayTitle({name:feature.title||feature.name});
  const titleState=heroTitleLogoState(feature),titleLogo=feature.titleLogo||titleState.logo||'';
  const typeLabel=feature._heroFeed?`${feature._heroFeed}${feature._heroRank?` · #${feature._heroRank}`:''}`:isLive?'LIVE TV':feature.kind==='movie'?'FEATURED MOVIE':'FEATURED SERIES';
  const heroRating=displayRating(feature),meta=[feature.year,heroRating?`★ ${heroRating}`:'',feature.sourceCount>1?`${feature.sourceCount} sources`:'',feature.group].filter(Boolean);
  const backdrop=feature.backdrop||feature.logo;
  const artClass=feature.backdrop?'hero-backdrop hero-backdrop-clean':'hero-backdrop hero-backdrop-poster';
  const art=backdrop?`<img class="${artClass}" data-swoop-art="${esc(backdrop)}" alt="" loading="eager">`:'';
  const poster=feature.logo?`<img class="hero-poster" data-swoop-art="${esc(feature.logo)}" alt="" loading="eager">`:'';
  const mainAction=isSeries?`<button class="btn play-btn" data-detail="${esc(feature.id)}"><span>▶</span> View Series</button>`:`<button class="btn play-btn" data-play="${esc(feature.id)}"><span>▶</span> Play</button>`;
  const total=Number(rotation.total||0),current=Number(rotation.index||0);
  const rotationControls=total>1?`<div class="hero-rotation-controls" aria-hidden="true"><div class="hero-rotation-dots">${Array.from({length:total},(_,i)=>`<i class="${i===current?'active':''}"></i>`).join('')}</div></div>`:'';
  const titleMarkup=`<div class="hero-title-slot ${titleLogo?'has-logo':''} ${titleState.pending?'logo-pending':''} ${titleState.settled&&!titleLogo?'logo-unavailable':''}" data-hero-title data-hero-item="${esc(feature.id)}"><h1 class="hero-title-text">${esc(displayTitle)}</h1><span class="hero-title-wait" aria-hidden="true"></span>${titleLogo?`<img class="hero-title-logo" data-swoop-art="${esc(titleLogo)}" alt="${esc(displayTitle)}">`:''}</div>`;
  const description=feature.plot?esc(feature.plot):isLive?`Watch ${esc(displayTitle)} live from your connected TV provider.`:`Discover ${esc(displayTitle)} in your connected ${esc(providerName)} library.`;
  return `<section class="hero hero-rotating" data-home-hero data-hero-item="${esc(feature.id)}"><div class="hero-media">${art}${poster}<div class="hero-fallback" style="--hero-fallback:${feature.demoColor||'linear-gradient(135deg,#1d2a44,#080a0e)'}"></div></div><div class="hero-vignette"></div>
    <div class="hero-content"><div class="hero-brandline"><span class="swoop-mini">S</span><span>${esc(typeLabel)}</span></div>${titleMarkup}<div class="hero-meta">${meta.map(x=>`<span>${esc(x)}</span>`).join('')}<span class="hero-source">${esc(providerName)}</span></div><p>${description}</p><div class="cta-row hero-actions">${mainAction}${!isLive?`<button class="btn secondary hero-secondary" data-detail="${esc(feature.id)}"><span>ⓘ</span> More Info</button>`:`<button class="btn secondary hero-secondary" data-page="guide"><span>▤</span> TV Guide</button>`}</div></div>${rotationControls}
  </section>`;
}

function listItems(){const out=[],seen=new Set();for(const id of state.myList){const item=savedItem(id);if(item&&!seen.has(item.id)){seen.add(item.id);out.push(item)}}return out}
function removeFromContinueWatching(id,explicitSeriesId=''){
  const wantedId=String(id||''),directEntry=state.continueWatching.find(x=>String(x?.id||'')===wantedId)||null;
  const target=directEntry?.item||savedItem(wantedId)||null;
  const targetSeriesId=String(explicitSeriesId||target?.parentSeriesId||(target?.kind==='series'?target.id:'')||'');
  const ids=new Set([wantedId,...(target?logicalItemIds(target).map(String):[])]);
  const before=state.continueWatching.length;
  state.continueWatching=state.continueWatching.filter(entry=>{
    const entryId=String(entry?.id||''),entryItem=entry?.item||savedItem(entryId)||{};
    const entrySeriesId=String(entryItem?.parentSeriesId||(entryItem?.kind==='series'?entryItem?.id:'')||'');
    if(targetSeriesId&&entrySeriesId===targetSeriesId)return false;
    if(ids.has(entryId))return false;
    if(entryItem&&logicalItemIds(entryItem).some(value=>ids.has(String(value))))return false;
    return true;
  });
  return state.continueWatching.length!==before;
}
function continueDisplayItem(item){
  if(!item||item.kind!=='episode'||!item.parentSeriesId)return item;
  const parent=savedItem(item.parentSeriesId);
  const seasonPoster=item.seasonPoster||item.seriesPoster||parent?.logo||'';
  if(!seasonPoster)return item;
  return {...item,logo:seasonPoster,backdrop:item.seriesBackdrop||parent?.backdrop||item.backdrop||seasonPoster,_continueSeriesPoster:true,_continueSeriesTitle:item.seriesTitle||parent?.name||item.group||item.name};
}
function continueItems(){const out=[],seen=new Set();for(const x of [...state.continueWatching].sort((a,b)=>(b.lastPlayed||0)-(a.lastPlayed||0))){const raw=savedItem(x.id)||x.item,item=continueDisplayItem(raw);if(item&&!seen.has(item.id)){seen.add(item.id);out.push(item)}}return out}
function home(){
  const fastHome=androidFastHomeMode(),fast=fastHome?androidFastCatalog():null;
  const cat=activeCatalog(),live=fastHome?fast.live:items('live'),movies=fastHome?fast.movie:items('movie'),shows=fastHome?fast.series:cat.filter(x=>x.kind==='series'),homeCounts=(NATIVE_ANDROID&&tvHomeSnapshotActive)?{live:tvSavedKindTotal('live')||live.length,movie:tvSavedKindTotal('movie')||movies.length,series:tvSavedKindTotal('series')||shows.length}:{live:nativeCatalogMode?nativeTotal('live'):live.length,movie:nativeCatalogMode?nativeTotal('movie'):movies.length,series:nativeCatalogMode?nativeTotal('series'):shows.length};
  const providerName=providerSummaryName(),heroPool=heroCandidates();
  if(!state.providers.length&&catalogLogicalTotal()===0)return `<main class="home-main"><div class="content home-content"><div class="library-strip home-library-strip"><div><span class="library-dot"></span><strong>Your Library</strong><span>0 live · 0 movies · 0 shows</span></div><div class="home-library-actions"><button class="library-manage" data-modal="provider">Connect Provider →</button></div></div>${empty('Your library is empty','Add a TV provider to start watching.')}</div></main>`;
  if(heroPool.length)heroRotationIndex=((heroRotationIndex%heroPool.length)+heroPool.length)%heroPool.length;
  const feature=heroPool[heroRotationIndex]||fallbackFeatureItem();
  const rows=selectedHomeRows();
  const eagerRows=fastHome?ANDROID_TV_HOME_EAGER_ROWS:HOME_EAGER_ROWS;const rendered=NATIVE_ANDROID?androidInitialHomeRowsMarkup(rows,eagerRows):rows.map((def,index)=>largeLibraryMode()&&index>=eagerRows?lazyHomePlaceholder(def):homeRowMarkup(def)).join('');
  const needsWeb=rows.some(r=>r.web||r.custom),hasKey=Boolean(String(state.settings.mdblistApiKey||'').trim()),customNeedsKey=rows.some(r=>r.custom)&&!hasKey;
  const discoveryNote=customNeedsKey?`<section class="web-discovery-callout"><div><span class="eyebrow">CUSTOM MDBLIST ROWS</span><h2>Connect MDBList for your own lists</h2><p>Swoop TV's built-in Top 100 and Trending rows are already automatic. An MDBList key on this device is only needed for custom personal MDBList rows.</p></div><button class="btn accent" data-modal="homeRows">Set up Custom Lists</button></section>`:'';
  const status=NATIVE_ANDROID?'':(discoveryRefreshing?'Updating recommendations…':discoveryMessage||'Discovery ready');
  return `<main class="home-main">${hero(feature,providerName,{total:heroPool.length,index:heroRotationIndex})}<div class="content home-content"><div class="library-strip home-library-strip"><div><span class="library-dot"></span><strong>${catalogLogicalTotal()?esc(providerName):'Your Library'}</strong><span>${homeCounts.live.toLocaleString()} live · ${homeCounts.movie.toLocaleString()} movies · ${homeCounts.series.toLocaleString()} shows</span></div><div class="home-library-actions">${NATIVE_ANDROID?'':`<span class="discovery-status ${discoveryRefreshing?'busy':''}">${esc(status)}</span>`}<button class="library-manage" data-modal="homeRows">☰ Customize Home</button><button class="library-manage" data-modal="provider">${state.catalog.length?'Providers':'Connect Provider'} →</button></div></div>
    ${discoveryNote}<div class="tv-home-rows" data-tv-home-rows>${rendered||`<section class="web-discovery-callout"><div><span class="eyebrow">YOUR HOME</span><h2>Choose what Swoop TV shows here</h2><p>Select Top 100, Trending, Live TV, genres and more. You can change the row order any time.</p></div><button class="btn accent" data-modal="homeRows">Customize Home</button></section>`}</div>
  </div></main>`;
}
function page(kind,title){
  const nativeCache=nativePageCache[kind],arr=nativeCatalogMode?(nativeCache.items||[]):providerFiltered(items(kind)),limit=viewLimits[kind]||(kind==='live'?96:72),shown=nativeCatalogMode?arr:arr.slice(0,limit),total=nativeCatalogMode?Number(nativeCache.total||nativeTotal(kind)):arr.length,providerName=providerSummaryName(),providerPills=providerFilterOptions();
  const leadRaw=arr.find(x=>visualItem(x).backdrop||visualItem(x).logo)||arr[0];
  const lead=visualItem(leadRaw);
  const groups=nativeCatalogMode?(nativeCategoryCache[kind]||[]).map(x=>x.name).filter(Boolean).slice(0,14):[...new Set(arr.map(x=>x.group).filter(Boolean))].slice(0,10);
  const leadBackdrop=lead?(lead.backdrop||lead.logo):'';
  const leadArt=leadBackdrop?`<img data-swoop-art="${esc(leadBackdrop)}" class="page-hero-art page-hero-backdrop" alt="" loading="eager">`:'';
  const cards=shown.map(x=>card(x,kind!=='live')).join('');
  const leadAction=lead?(kind==='live'?`<button class="btn play-btn page-feature-play" data-play="${esc(lead.id)}">▶ Play ${esc(lead.name)}</button>`:`<button class="btn play-btn page-feature-play" data-detail="${esc(lead.id)}">ⓘ Explore ${esc(lead.name)}</button>`):'';
  const loading=nativeCatalogMode&&nativeCache.loading&&!arr.length?`<div class="native-query-loading"><div><span class="provider-spinner"></span><strong>Loading ${esc(title)}…</strong><div class="activity-progress indeterminate"><b></b></div><small>Loading your library…</small></div></div>`:'';
  return `<main class="page cinematic-page"><section class="page-hero ${kind==='live'?'live-page-hero':''}">${leadArt}<div class="page-hero-shade"></div><div class="page-hero-copy"><div class="eyebrow">${kind==='live'?'WATCH NOW':kind==='movie'?'ON DEMAND':'BINGE-WORTHY'}</div><h1>${esc(title)}</h1><p>${catalogRawTotal()?`${total.toLocaleString()} ${kind==='live'?'channels':kind==='movie'?'movies':'series'} from ${esc(providerName)}.`:'Connect a TV provider to start watching.'}</p><div class="cta-row">${leadAction}${kind==='live'?'<button class="btn secondary" data-page="guide">▤ Open TV Guide</button>':''}</div></div></section>
    <div class="page-content"><div class="provider-filter-pills"><button class="${providerFilter==='all'?'active':''}" data-provider-filter="all">All Providers</button>${providerPills.map(p=>`<button class="${providerFilter===p.id?'active':''}" data-provider-filter="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div><div class="page-toolbar"><div class="category-pills"><button data-page-category="${esc(kind)}" data-page-group="">All</button>${groups.map(g=>`<button data-page-category="${esc(kind)}" data-page-group="${esc(g)}">${esc(g)}</button>`).join('')}</div><button class="btn secondary compact-btn" data-modal="provider">＋ Provider</button></div>${loading}${arr.length?`<div class="content-grid ${kind==='live'?'live-content-grid':'poster-content-grid'}">${cards}</div>${shown.length<total?`<div class="load-more-wrap"><button class="btn secondary" data-load-more="${kind}">Load more · showing ${shown.length.toLocaleString()} of ${total.toLocaleString()}</button></div>`:''}`:loading?'':empty('No content yet','Connect a TV provider to populate this section.')}</div></main>`;
}

function mediaProviderCategoryKey(kind='movie'){
  const selected=enabledProviders().filter(p=>providerFilter==='all'||p.id===providerFilter);
  return `${kind}|${providerFilter}|${selected.map(p=>`${p.id}:${Number(p.priority||0)}:${Number(p.lastRefreshed||0)}`).join(',')}`;
}
function browserProviderCategories(kind='movie',providerId=''){
  const rows=activeCatalog().filter(x=>x.kind===kind&&(!providerId||x.providerId===providerId));
  const counts=new Map(),first=new Map();let order=0;
  for(const item of rows){const name=String(item.group||'Uncategorised').trim()||'Uncategorised';counts.set(name,(counts.get(name)||0)+1);if(!first.has(name))first.set(name,order++);}
  return [...counts].map(([name,count])=>({name,count,provider_order:Number(first.get(name)||0),first_seen:Number(first.get(name)||0)}));
}
async function ensureMediaProviderCategoryOrder(kind='movie',{force=false}={}){
  if(!['movie','series'].includes(kind))return false;
  const cache=mediaProviderCategoryCache[kind],key=mediaProviderCategoryKey(kind),now=Date.now();
  if(!force&&cache.key===key&&cache.items.length&&now-cache.loadedAt<10*60*1000)return false;
  if(cache.loading&&cache.loadingKey===key)return cache.loading;
  const before=cache.items.map(x=>`${x.name}:${x.count}`).join('\u0001');
  const task=(async()=>{
    const selected=enabledProviders().filter(p=>providerFilter==='all'||p.id===providerFilter);
    let base=[];
    if(nativeCatalogMode){
      const args={providerId:providerFilter,providerIds:providerFilter==='all'?nativeEnabledProviderIds():[],limit:200};
      base=(await nativeCatalogCategories(kind,args).catch(()=>null))?.items||[];
    }else{
      const all=providerFilter==='all'?providerFiltered(activeCatalog().filter(x=>x.kind===kind)):activeCatalog().filter(x=>x.kind===kind&&x.providerId===providerFilter);
      const counts=new Map(),first=new Map();let i=0;
      for(const item of all){const name=String(item.group||'Uncategorised').trim()||'Uncategorised';counts.set(name,(counts.get(name)||0)+1);if(!first.has(name))first.set(name,i++);}
      base=[...counts].map(([name,count])=>({name,count,provider_order:Number(first.get(name)||0),first_seen:Number(first.get(name)||0)}));
    }
    const byName=new Map(base.filter(x=>x?.name).map(x=>[String(x.name),{name:String(x.name),count:Number(x.count||0),providerOrder:Number(x.provider_order??999999),firstSeen:Number(x.first_seen??999999)}]));
    const ordered=[],used=new Set();
    for(const provider of selected){
      let names=[];
      if(provider.type==='xtream'){
        const cfg=providerConfigFor(provider.id);
        if(cfg?.server&&cfg?.username&&cfg?.password){
          try{
            const cats=kind==='movie'?await fetchXtreamVodCategories(cfg):await fetchXtreamSeriesCategories(cfg);
            names=cats.map(cat=>String(cat?.category_name||'').trim()).filter(Boolean);
          }catch{}
        }
      }
      if(!names.length){
        if(nativeCatalogMode){
          const own=(await nativeCatalogCategories(kind,{providerId:provider.id,limit:200}).catch(()=>null))?.items||[];
          names=own.map(x=>String(x?.name||'').trim()).filter(Boolean);
        }else names=browserProviderCategories(kind,provider.id).sort((a,b)=>(a.provider_order-b.provider_order)||(a.first_seen-b.first_seen)).map(x=>x.name);
      }
      for(const name of names){
        if(used.has(name))continue;
        const hit=byName.get(name);
        if(hit){ordered.push(hit);used.add(name)}
      }
    }
    for(const cat of [...byName.values()].sort((a,b)=>(a.providerOrder-b.providerOrder)||(a.firstSeen-b.firstSeen)||a.name.localeCompare(b.name))){
      if(!used.has(cat.name)){ordered.push(cat);used.add(cat.name)}
    }
    if(mediaProviderCategoryKey(kind)!==key)return false;
    cache.key=key;cache.items=ordered;cache.loadedAt=Date.now();
    return before!==ordered.map(x=>`${x.name}:${x.count}`).join('\u0001');
  })().finally(()=>{if(cache.loadingKey===key){cache.loading=null;cache.loadingKey=''}});
  cache.loading=task;cache.loadingKey=key;return task;
}
function mediaRailCategories(kind='movie'){
  const cache=mediaProviderCategoryCache[kind],key=mediaProviderCategoryKey(kind);
  if(cache?.key===key&&cache.items.length)return cache.items;
  if(nativeCatalogMode)return (nativeCategoryCache[kind]||[]).filter(x=>x?.name&&Number(x.count)>0).map(x=>({name:String(x.name),count:Number(x.count||0),providerOrder:Number(x.provider_order??999999),firstSeen:Number(x.first_seen??999999)})).sort((a,b)=>(a.providerOrder-b.providerOrder)||(a.firstSeen-b.firstSeen)||a.name.localeCompare(b.name));
  const counts=new Map(),first=new Map();let i=0;
  for(const item of providerFiltered(activeCatalog().filter(x=>x.kind===kind))){const name=String(item.group||'Uncategorised').trim()||'Uncategorised';counts.set(name,(counts.get(name)||0)+1);if(!first.has(name))first.set(name,i++);}
  return [...counts].map(([name,count])=>({name,count,providerOrder:Number(first.get(name)||0),firstSeen:Number(first.get(name)||0)})).sort((a,b)=>a.providerOrder-b.providerOrder);
}
function mediaRailKey(kind='movie',category=''){
  const revision=enabledProviders().map(p=>`${p.id}:${Number(p.lastRefreshed||0)}`).join(',');
  return `${kind}|${providerFilter}|${revision}|${category}`;
}
function mediaRailBrowserFullItems(kind='movie',category=''){
  const key=mediaRailKey(kind,category);if(mediaRailBrowserFullCache.has(key))return mediaRailBrowserFullCache.get(key);
  let raw=activeCatalog().filter(x=>x.kind===kind&&String(x.group||'Uncategorised')===category);
  if(providerFilter!=='all')raw=raw.filter(x=>x.providerId===providerFilter);
  if(kind==='movie')raw=collapseMovieSources(raw,raw);
  mediaRailBrowserFullCache.set(key,raw);return raw;
}
function seedBrowserMediaRail(kind='movie',category=''){
  const key=mediaRailKey(kind,category),existing=mediaRailCache.get(key);if(existing)return existing;
  const full=mediaRailBrowserFullItems(kind,category),entry={items:full.slice(0,LONG_RAIL_BATCH_SIZE),total:full.length,loadedAt:Date.now()};mediaRailCache.set(key,entry);return entry;
}
function mediaRailSnapshot(kind='movie',category=''){
  const key=mediaRailKey(kind,category);
  if(!nativeCatalogMode){const cached=seedBrowserMediaRail(kind,category);return {items:cached.items,total:cached.total,ready:true,loading:false};}
  const cached=mediaRailCache.get(key);return {items:cached?.items||[],total:Number(cached?.total||0),ready:Boolean(cached),loading:mediaRailRequests.has(key)};
}
function mediaRailRenderedLimit(kind='movie',category=''){
  const key=mediaRailKey(kind,category);return Math.max(1,Number(mediaRailRenderLimits.get(key)||LONG_RAIL_INITIAL_RENDER));
}
function mediaRailTrackMarkup(kind='movie',category=''){
  const snap=mediaRailSnapshot(kind,category),limit=mediaRailRenderedLimit(kind,category),visible=snap.items.slice(0,limit);
  if(snap.ready&&snap.items.length)return `<div class="rail media-category-rail-track" data-long-rail="media" data-long-rail-kind="${esc(kind)}" data-long-rail-category="${esc(category)}" data-long-rail-loaded="${snap.items.length}" data-long-rail-total="${Number(snap.total||snap.items.length)}">${visible.map(x=>card(x,true)).join('')}</div>`;
  if(snap.ready)return `<div class="live-category-empty-inline">No ${kind==='movie'?'movies':'TV shows'} returned in this category.</div>`;
  return `<div class="media-rail-skeleton" aria-label="Loading ${esc(category)} ${kind==='movie'?'movies':'TV shows'}">${Array.from({length:6},()=>'<i></i>').join('')}</div>`;
}
function mediaCategoryRailMarkup(kind='movie',cat={}){
  const label=kind==='movie'?'movies':'shows';
  return `<section class="section poster-section media-category-section" data-media-rail-kind="${esc(kind)}" data-media-rail-category="${esc(cat.name)}"><div class="section-head"><div><h2>${esc(cat.name)}</h2><span class="section-meta">${Number(cat.count||0).toLocaleString()} ${label}</span></div><span class="rail-arrow">›</span></div><div class="media-category-rail-body">${mediaRailTrackMarkup(kind,cat.name)}</div></section>`;
}
function patchMediaCategoryRail(kind='movie',category=''){
  const expectedPage=kind==='movie'?'movies':'series';
  if(state.page!==expectedPage||detailItem||personView)return;
  const section=[...document.querySelectorAll('[data-media-rail-category]')].find(x=>x.dataset.mediaRailKind===kind&&x.dataset.mediaRailCategory===category);if(!section)return;
  const body=section.querySelector('.media-category-rail-body');if(!body)return;
  const focusedId=section.contains(document.activeElement)?document.activeElement?.dataset?.detail||'':'';
  body.innerHTML=mediaRailTrackMarkup(kind,category);hydrateArtwork(body);bindDynamicCards(body);hydrateVisibleImdbRatings(body);
  if(focusedId){const target=[...body.querySelectorAll('[data-detail]')].find(x=>x.dataset.detail===focusedId);target?.focus?.({preventScroll:true})}
}
async function ensureMediaCategoryRail(kind='movie',category='',{append=false}={}){
  if(!category)return mediaRailSnapshot(kind,category);
  const key=mediaRailKey(kind,category);
  if(!nativeCatalogMode){
    const full=mediaRailBrowserFullItems(kind,category),cached=seedBrowserMediaRail(kind,category);if(!append||cached.items.length>=cached.total)return mediaRailSnapshot(kind,category);
    const end=Math.min(full.length,cached.items.length+LONG_RAIL_BATCH_SIZE);cached.items=full.slice(0,end);cached.total=full.length;cached.loadedAt=Date.now();return mediaRailSnapshot(kind,category);
  }
  const cached=mediaRailCache.get(key);if(cached&&!append)return mediaRailSnapshot(kind,category);if(cached&&append&&cached.items.length>=cached.total)return mediaRailSnapshot(kind,category);if(mediaRailRequests.has(key))return mediaRailRequests.get(key);
  const task=(async()=>{
    const offset=append?Number(cached?.items?.length||0):0,args={kind,group:category,limit:LONG_RAIL_BATCH_SIZE,offset,sort:'recent'};
    if(providerFilter==='all')args.providerIds=nativeEnabledProviderIds();else args.providerId=providerFilter;
    const result=await nativeCatalogQuery(args),batch=cacheNativeItems(result?.items||[]),items=append?[...(cached?.items||[]),...batch]:batch;
    mediaRailCache.set(key,{items,total:Number(result?.total||cached?.total||items.length),loadedAt:Date.now()});return mediaRailSnapshot(kind,category);
  })().finally(()=>mediaRailRequests.delete(key));
  mediaRailRequests.set(key,task);return task;
}
async function prefetchMediaRail(kind='movie',category=''){
  const snap=mediaRailSnapshot(kind,category);if(!snap.ready||snap.items.length>=Number(snap.total||0))return snap;
  const before=snap.items.length,next=await ensureMediaCategoryRail(kind,category,{append:true});
  prewarmArtworkUrls((next.items||[]).slice(before,Math.min((next.items||[]).length,before+60)),60);return next;
}
async function primeMediaCategoryRails(kind='movie'){
  const expectedPage=kind==='movie'?'movies':'series';
  if(state.page!==expectedPage||detailItem||personView)return;
  const limit=mediaRailCategoryLimit[kind]||MEDIA_RAIL_CATEGORY_BATCH;
  const cats=mediaRailCategories(kind).slice(0,limit).map(x=>x.name).filter(Boolean),pending=cats.filter(name=>!mediaRailCache.has(mediaRailKey(kind,name)));
  let cursor=0;
  async function worker(){while(cursor<pending.length){const name=pending[cursor++];try{await ensureMediaCategoryRail(kind,name);patchMediaCategoryRail(kind,name)}catch{mediaRailCache.set(mediaRailKey(kind,name),{items:[],total:0,loadedAt:Date.now()});patchMediaCategoryRail(kind,name)}}}
  await Promise.all(Array.from({length:Math.min(NATIVE_ANDROID?1:3,pending.length||1)},worker));
}
function mediaCategoryPage(kind='movie',title='Movies'){
  const base=nativeCatalogMode?(nativePageCache[kind]?.items||[]):items(kind),all=providerFiltered(base);
  const total=nativeCatalogMode?(providerFilter==='all'?nativeTotal(kind):Number(providerById(providerFilter)?.counts?.[kind]||0)):providerFiltered(items(kind)).length;
  const providerName=providerSummaryName(),providerPills=providerFilterOptions(),categories=mediaRailCategories(kind),limit=mediaRailCategoryLimit[kind]||MEDIA_RAIL_CATEGORY_BATCH,shownCategories=categories.slice(0,limit);
  const leadRaw=all.find(x=>visualItem(x).backdrop||visualItem(x).logo)||all[0],lead=visualItem(leadRaw),leadBackdrop=lead?(lead.backdrop||lead.logo):'';
  const leadArt=leadBackdrop?`<img data-swoop-art="${esc(leadBackdrop)}" class="page-hero-art page-hero-backdrop" alt="" loading="eager">`:'';
  const loading=nativeCatalogMode&&!categories.length?`<div class="native-query-loading"><div><span class="provider-spinner"></span><strong>Loading ${esc(title)} categories…</strong><div class="activity-progress indeterminate"><b></b></div><small>Loading your library…</small></div></div>`:'';
  const rows=shownCategories.map(cat=>mediaCategoryRailMarkup(kind,cat)).join('');
  return `<main class="page cinematic-page media-category-page"><section class="page-hero">${leadArt}<div class="page-hero-shade"></div><div class="page-hero-copy"><div class="eyebrow">${kind==='movie'?'ON DEMAND':'BINGE-WORTHY'}</div><h1>${esc(title)}</h1><p>${catalogRawTotal()?`${total.toLocaleString()} ${kind==='movie'?'movies':'series'} from ${esc(providerName)}. Browse them in your provider’s own category order.`:'Connect a TV provider to start watching.'}</p>${lead?`<div class="cta-row"><button class="btn play-btn page-feature-play" data-detail="${esc(lead.id)}">ⓘ Explore ${esc(cleanDisplayTitle(lead))}</button></div>`:''}</div></section>
  <div class="page-content media-category-content"><div class="provider-filter-pills"><button class="${providerFilter==='all'?'active':''}" data-provider-filter="all">All Providers</button>${providerPills.map(p=>`<button class="${providerFilter===p.id?'active':''}" data-provider-filter="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div><section class="media-category-browser"><div class="section-head media-browser-head"><div><h2>Browse ${esc(title)}</h2><span class="section-meta">Swipe across each provider category</span></div><button class="btn secondary compact-btn" data-modal="provider">＋ Provider</button></div>${loading}${rows||(!loading?empty(`No ${title} categories`,'Refresh or reconnect your TV provider to load its categories.'):'')}${shownCategories.length<categories.length?`<div class="load-more-wrap"><button class="btn secondary" data-media-more-categories="${esc(kind)}">Load more categories · showing ${shownCategories.length.toLocaleString()} of ${categories.length.toLocaleString()}</button></div>`:''}</section></div></main>`;
}

function liveRailCategories(){return guideCategories().filter(x=>x.name)}
function liveRailKey(category=''){const revision=enabledProviders().map(p=>`${p.id}:${Number(p.lastRefreshed||0)}`).join(',');return `${providerFilter}|${revision}|${category}`}
function liveRailBrowserFullItems(category=''){
  return providerFiltered(items('live')).filter(x=>String(x.group||'Uncategorised')===category);
}
function seedBrowserLiveRail(category=''){
  const key=liveRailKey(category),existing=liveRailCache.get(key);if(existing)return existing;const full=liveRailBrowserFullItems(category),entry={items:full.slice(0,LONG_RAIL_BATCH_SIZE),total:full.length,loadedAt:Date.now()};liveRailCache.set(key,entry);return entry;
}
function liveRailSnapshot(category=''){
  const key=liveRailKey(category);if(!nativeCatalogMode){const cached=seedBrowserLiveRail(category);return {items:cached.items,total:cached.total,ready:true,loading:false};}
  const cached=liveRailCache.get(key);return {items:cached?.items||[],total:Number(cached?.total||0),ready:Boolean(cached),loading:liveRailRequests.has(key)};
}
function liveRailCard(item){const logo=String(item?.logo||'').trim();return `<button class="live-rail-card clean-live-card" data-play="${esc(item.id)}" aria-label="Watch ${esc(item.name)}"><span class="live-rail-logo">${logo?`<img data-swoop-art="${esc(logo)}" alt="">`:'<i>TV</i>'}</span></button>`;}
function liveRailRenderedLimit(category=''){const key=liveRailKey(category);return Math.max(1,Number(liveRailRenderLimits.get(key)||LONG_RAIL_INITIAL_RENDER));}
function liveRailTrackMarkup(category=''){
  const snap=liveRailSnapshot(category),limit=liveRailRenderedLimit(category),visible=snap.items.slice(0,limit);
  if(snap.ready&&snap.items.length)return `<div class="live-category-rail-track" data-long-rail="live" data-long-rail-category="${esc(category)}" data-long-rail-loaded="${snap.items.length}" data-long-rail-total="${Number(snap.total||snap.items.length)}">${visible.map(liveRailCard).join('')}</div>`;
  if(snap.ready)return `<div class="live-category-empty-inline">No channels returned in this category.</div>`;
  return `<div class="live-rail-skeleton" aria-label="Loading ${esc(category)} channels">${Array.from({length:5},()=>'<i></i>').join('')}</div>`;
}
function liveCategoryRailMarkup(cat){
  return `<section class="section live-category-section" data-live-rail-category="${esc(cat.name)}"><div class="section-head"><div><h2>${esc(cat.name)}</h2><span class="section-meta">${Number(cat.count||0).toLocaleString()} streams</span></div><span class="rail-arrow">›</span></div><div class="live-category-rail-body">${liveRailTrackMarkup(cat.name)}</div></section>`;
}
function patchLiveCategoryRail(category=''){
  if(state.page!=='live'||detailItem||personView)return;
  const section=[...document.querySelectorAll('[data-live-rail-category]')].find(x=>x.dataset.liveRailCategory===category);if(!section)return;
  const body=section.querySelector('.live-category-rail-body');if(!body)return;const focusedId=section.contains(document.activeElement)?document.activeElement?.dataset?.play||'':'';
  body.innerHTML=liveRailTrackMarkup(category);hydrateArtwork(body);bindDynamicCards(body);bindRailStability(body);if(focusedId){const target=[...body.querySelectorAll('[data-play]')].find(x=>x.dataset.play===focusedId);target?.focus?.({preventScroll:true})}
}
async function ensureLiveCategoryRail(category='',{append=false}={}){
  if(!category)return liveRailSnapshot(category);const key=liveRailKey(category);
  if(!nativeCatalogMode){const full=liveRailBrowserFullItems(category),cached=seedBrowserLiveRail(category);if(!append||cached.items.length>=cached.total)return liveRailSnapshot(category);const end=Math.min(full.length,cached.items.length+LONG_RAIL_BATCH_SIZE);cached.items=full.slice(0,end);cached.total=full.length;cached.loadedAt=Date.now();return liveRailSnapshot(category);}
  const cached=liveRailCache.get(key);if(cached&&!append)return liveRailSnapshot(category);if(cached&&append&&cached.items.length>=cached.total)return liveRailSnapshot(category);if(liveRailRequests.has(key))return liveRailRequests.get(key);
  const task=(async()=>{const offset=append?Number(cached?.items?.length||0):0,args={kind:'live',group:category,limit:LONG_RAIL_BATCH_SIZE,offset,sort:'name'};if(providerFilter==='all')args.providerIds=nativeEnabledProviderIds();else args.providerId=providerFilter;const result=await nativeCatalogQuery(args),batch=cacheNativeItems(result?.items||[]),items=append?[...(cached?.items||[]),...batch]:batch;liveRailCache.set(key,{items,total:Number(result?.total||cached?.total||items.length),loadedAt:Date.now()});return liveRailSnapshot(category)})().finally(()=>liveRailRequests.delete(key));
  liveRailRequests.set(key,task);return task;
}
async function prefetchLiveRail(category=''){const snap=liveRailSnapshot(category);if(!snap.ready||snap.items.length>=Number(snap.total||0))return snap;const before=snap.items.length,next=await ensureLiveCategoryRail(category,{append:true});prewarmArtworkUrls((next.items||[]).slice(before,Math.min((next.items||[]).length,before+60)),60);return next;}
async function primeLiveCategoryRails(){
  if(state.page!=='live'||detailItem||personView)return;const cats=liveRailCategories().slice(0,liveRailCategoryLimit).map(x=>x.name).filter(Boolean),pending=cats.filter(name=>!liveRailCache.has(liveRailKey(name)));
  let cursor=0;async function worker(){while(cursor<pending.length){const name=pending[cursor++];try{await ensureLiveCategoryRail(name);patchLiveCategoryRail(name)}catch{liveRailCache.set(liveRailKey(name),{items:[],total:0,loadedAt:Date.now()});patchLiveCategoryRail(name)}}}await Promise.all(Array.from({length:Math.min(NATIVE_ANDROID?1:3,pending.length||1)},worker));
}
function patchLiveHeroFocusedChannel(item){
  if(state.page!=='live'||!item)return false;const hero=document.querySelector('.live-hub-hero'),copy=hero?.querySelector('.live-hub-copy'),brand=hero?.querySelector('.live-hub-brand-panel');if(!hero||!copy||!brand)return false;
  const title=copy.querySelector('h1');if(title)title.textContent=item.name||'Live TV';const watch=copy.querySelector('[data-play]');if(watch)watch.dataset.play=item.id||'';const fav=copy.querySelector('[data-live-favourite]');if(fav){fav.dataset.liveFavourite=item.id||'';fav.textContent=isLiveFavourite(item)?'★ Favourite':'☆ Add Favourite'}
  const visual=visualItem(item),logo=String(visual?.logo||'');let img=brand.querySelector('.live-hub-art');if(logo){if(!img){img=document.createElement('img');img.className='live-hub-art';img.alt='';brand.prepend(img)}if(img.dataset.swoopArt!==logo){img.dataset.swoopArt=logo;img.dataset.swoopLoaded='';img.removeAttribute('src');loadArtwork(img,{priority:'high'})}}else img?.remove();return true;
}
function stopLiveHeroPreview(){
  if(livePreviewTimer){clearTimeout(livePreviewTimer);livePreviewTimer=null}livePreviewItemId='';document.querySelector('.live-hub-preview-panel')?.classList.remove('preview-active');
  if(livePreviewActive){livePreviewActive=false;nativeStopPreview().catch(()=>null)}
}
function scheduleLiveHeroPreview(item,delay=650){
  if(!NATIVE_ANDROID||state.page!=='live'||detailItem||personView||playerItem||!item)return;
  if(livePreviewTimer)clearTimeout(livePreviewTimer);document.querySelector('.live-hub-preview-panel')?.classList.remove('preview-active');const token=++livePreviewPageToken,id=String(item.id||'');livePreviewItemId=id;
  livePreviewTimer=setTimeout(async()=>{livePreviewTimer=null;if(token!==livePreviewPageToken||state.page!=='live'||livePreviewItemId!==id||playerItem)return;
    const anchor=document.querySelector('.live-preview-anchor');if(!anchor)return;const source=preferredLiveSource(item);if(!source?.streamUrl)return;
    const r=anchor.getBoundingClientRect(),vw=Math.max(1,innerWidth),vh=Math.max(1,innerHeight);if(r.width<80||r.height<50)return;
    try{const result=await nativePreviewLive(source,{left:r.left/vw,top:r.top/vh,width:r.width/vw,height:r.height/vh});livePreviewActive=Boolean(result?.ok);document.querySelector('.live-hub-preview-panel')?.classList.toggle('preview-active',livePreviewActive)}catch{livePreviewActive=false;document.querySelector('.live-hub-preview-panel')?.classList.remove('preview-active')}
  },Math.max(400,Number(delay||650)));
}

function liveSimpleRail(title,data=[],meta=''){
  if(!data.length)return'';return `<section class="section live-clean-section"><div class="section-head"><div><h2>${esc(title)}</h2>${meta?`<span class="section-meta">${esc(meta)}</span>`:''}</div><span class="rail-arrow">›</span></div><div class="live-category-rail-track">${data.map(liveRailCard).join('')}</div></section>`;
}
function livePage(){
  const nativeCache=nativePageCache.live,all=nativeCatalogMode?(nativeCache.items?.length?nativeCache.items:providerFiltered(items('live'))):providerFiltered(items('live')),total=nativeCatalogMode?Number(nativeTotal('live')):all.length,providerName=providerSummaryName(),providerPills=providerFilterOptions();
  const byId=new Map(all.map(x=>[x.id,x]));
  const favourites=state.liveFavourites.map(id=>savedItem(id)||byId.get(id)).filter(Boolean);
  const recent=state.recentLive.map(id=>savedItem(id)||byId.get(id)).filter(Boolean).slice(0,16);
  const categories=liveRailCategories(),shownCategories=categories.slice(0,liveRailCategoryLimit);
  const lead=favourites[0]||recent[0]||all[0];
  const leadVisual=visualItem(lead);
  const art=leadVisual?.logo?`<img class="live-hub-art" data-swoop-art="${esc(leadVisual.logo)}" alt="">`:'';
  const leadFav=lead?isLiveFavourite(lead):false;
  const loading=nativeCatalogMode&&nativeCache.loading&&!all.length?`<div class="native-query-loading"><div><span class="provider-spinner"></span><strong>Loading Live TV…</strong><div class="activity-progress indeterminate"><b></b></div><small>Loading your library…</small></div></div>`:'';
  const categoryRows=shownCategories.map(liveCategoryRailMarkup).join('');
  return `<main class="page live-hub-page"><section class="live-hub-hero ${art?'has-brand-art':''}"><div class="live-hub-shade"></div><div class="live-hub-copy"><div class="eyebrow">LIVE TV · ${esc(providerName)}</div><h1>${lead?esc(lead.name):'Live TV'}</h1><p>${lead?`Jump straight back into ${esc(lead.name)}, browse favourites, or swipe through your provider’s channel categories.`:'Connect a TV provider to populate Live TV.'}</p><div class="cta-row">${lead?`<button class="btn play-btn" data-play="${esc(lead.id)}">▶ Watch Live</button><button class="btn secondary" data-live-favourite="${esc(lead.id)}">${leadFav?'★ Favourite':'☆ Add Favourite'}</button>`:''}<button class="btn secondary" data-page="guide">▤ TV Guide</button></div></div><div class="live-hub-preview-panel" aria-label="Muted live preview"><div class="live-preview-anchor"></div></div><div class="live-hub-brand-panel">${art||'<div class="live-brand-fallback">LIVE</div>'}<div class="live-hub-stat"><strong>${total.toLocaleString()}</strong><span>LIVE STREAMS</span><small>${state.liveFavourites.length} favourites · ${state.recentLive.length} recent</small></div></div></section>
  <div class="page-content live-hub-content"><div class="provider-filter-pills live-provider-filter"><button class="${providerFilter==='all'?'active':''}" data-provider-filter="all">All Providers</button>${providerPills.map(p=>`<button class="${providerFilter===p.id?'active':''}" data-provider-filter="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>${favourites.length?liveSimpleRail('Favourite Channels',favourites.slice(0,100),`${favourites.length} saved`):''}${recent.length?liveSimpleRail('Recent Channels',recent,'Your most recently watched channels'):''}
  <section class="live-category-browser"><div class="section-head live-browser-head"><div><h2>Browse Live TV</h2><span class="section-meta">Swipe across each provider category</span></div><button class="btn secondary compact-btn" data-page="guide">Open TV Guide</button></div>${loading}${categoryRows||(!loading?empty('No Live TV categories','Refresh or reconnect your TV provider to load its channel groups.'):'')}<div class="live-auto-load-sentinel" data-live-category-sentinel aria-hidden="true"></div></section></div></main>`;
}


function starmeterNormalize(value=''){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
async function starmeterManifestUrl(){let repo='';try{repo=String(globalThis.SwoopAndroid?.githubRepository?.()||'').trim()}catch{}return repo&&repo.includes('/')?`https://github.com/${repo}/releases/download/${ANDROID_UPDATE_RELEASE_TAG}/swoop-tv-starmeter.json`:''}
async function ensureStarmeterLoaded(){
  if(starmeterLoaded||starmeterLoading)return starmeterPeople;starmeterLoading=true;starmeterError='';
  try{
    let data=null;const seed=await getInstallSeedCache();
    if(Array.isArray(seed?.starmeter?.people)&&seed.starmeter.people.length)data=seed.starmeter;
    if(!Array.isArray(data?.people)||!data.people.length){const remote=await starmeterManifestUrl();if(remote&&NATIVE_ANDROID){try{data=JSON.parse(String(await nativeFetchText(remote)||'{}'))}catch{}}}
    if(!Array.isArray(data?.people)||!data.people.length){const res=await fetch('./starmeter.json',{cache:'no-store'});if(!res.ok)throw new Error(`STARmeter manifest HTTP ${res.status}`);data=await res.json()}
    starmeterPeople=(Array.isArray(data.people)?data.people:[]).slice(0,100).map((p,i)=>{const person=p?.person&&typeof p.person==='object'?p.person:p;const entry={rank:Number(p.rank||i+1),name:String(p.name||person.name||'').trim(),profile:String(person.profile||p.profile||''),id:String(person.id||p.id||''),knownForDepartment:String(person.knownForDepartment||p.knownForDepartment||'Person')};const key=starmeterNormalize(entry.name);if(key&&(person.id||person.profile||Array.isArray(p.credits))){starmeterHotCache.set(key,{person:{id:entry.id,name:entry.name,profile:entry.profile,knownForDepartment:entry.knownForDepartment},credits:Array.isArray(p.credits)?p.credits:[],seeded:true,loadedAt:Number(Date.parse(seed?.builtAt||''))||Date.now()})}return entry}).filter(x=>x.name);
    starmeterLoaded=true;starmeterLoading=false;starmeterVisibleCount=starmeterPeople.length;if(state.page==='starmeter'&&!detailItem&&!personView)render();setTimeout(()=>prewarmStarmeterHotCache(100),500);return starmeterPeople;
  }catch(err){starmeterLoading=false;starmeterError=err?.message||String(err);if(state.page==='starmeter')render();return[]}
}
function starmeterProviderSignature(){
  const ids=enabledProviders().map(p=>`${p.id}:${Number(p?.counts?.live||0)+Number(p?.counts?.movie||0)+Number(p?.counts?.series||0)}:${Number(p?.lastRefreshAt||p?.updatedAt||0)}`).sort();
  return `${catalogLogicalTotal()}|${ids.join('|')}`;
}
function patchProfileStarmeterPrep(){
  if(!NATIVE_ANDROID||!profilePickerOpen)return;const el=document.querySelector('[data-profile-starmeter-prep]');if(!el)return;
  el.classList.toggle('ready',starmeterBackgroundComplete);const value=el.querySelector('span'),copy=el.querySelector('strong');
  if(value)value.textContent=starmeterBackgroundComplete?'✓':`${Math.max(0,Math.min(100,Math.round(starmeterBackgroundProgress)))}%`;
  if(copy)copy.textContent=starmeterBackgroundComplete?'STARmeter Top 100 ready':starmeterBackgroundStatus;
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
function scheduleStarmeterBackgroundRetry(delay=5000){
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
function starmeterPersonSeed(entry={}){const hot=starmeterHotCache.get(starmeterNormalize(entry.name));return hot?.person||{id:entry.id||'',name:entry.name||'',profile:entry.profile||'',knownForDepartment:entry.knownForDepartment||'Person'}}
function starmeterPopularityValue(item={}){return Number(item.popularity||item.voteCount||item.vote_count||item.rating||item.imdbRating||0)||0}
function starmeterPersonTitles(cached){
  if(!cached)return[];
  const all=[...(cached.movies||[]),...(cached.shows||[])];
  return all.sort((a,b)=>starmeterPopularityValue(b)-starmeterPopularityValue(a)||yearNumber(b)-yearNumber(a)||String(a?.name||'').localeCompare(String(b?.name||'')));
}
function starmeterPersonSection(entry={}){
  const key=starmeterNormalize(entry.name),cached=starmeterPersonCache.get(key),person=cached?.person||starmeterPersonSeed(entry),titles=starmeterPersonTitles(cached);
  const portrait=person.profile?`<img data-swoop-art="${esc(person.profile)}" alt="${esc(person.name||entry.name||'')}">`:`<div class="starmeter-person-fallback">${esc((person.name||'?').slice(0,1))}</div>`;
  const rail=titles.length?`<div class="rail starmeter-title-rail">${titles.slice(0,STARMETER_TITLE_RENDER_LIMIT).map(x=>card(x,true)).join('')}</div>`:(cached?`<div class="starmeter-empty-row">${cached.retryable?'Preparing your provider availability index…':'No connected-provider titles found.'}</div>`:`<div class="starmeter-row-loading" aria-hidden="true"><div class="starmeter-loading-copy"><span class="provider-spinner"></span><strong>Matching available movies & TV shows…</strong></div><div class="starmeter-loading-posters"><i></i><i></i><i></i><i></i></div></div>`);
  return `<section class="section starmeter-person-section" data-starmeter-rank="${Number(entry.rank||0)}" data-starmeter-name="${esc(entry.name||'')}"><div class="starmeter-person-column"><button class="starmeter-person-card" data-person-id="${esc(person.id||'')}" data-person-name="${esc(person.name||entry.name||'')}" data-person-profile="${esc(person.profile||'')}" data-person-department="${esc(person.knownForDepartment||'Person')}"><b>#${Number(entry.rank||0)}</b>${portrait}<strong>${esc(person.name||entry.name||'')}</strong></button></div><div class="starmeter-library-column"><div class="section-head"><div><span class="eyebrow">AVAILABLE ON YOUR PROVIDERS</span><h2>${cached?`${titles.length.toLocaleString()} ${titles.length===1?'title':'titles'}`:'Finding titles…'}</h2></div><span class="rail-arrow">›</span></div>${rail}</div></section>`;
}
function starmeterPage(){
  const visible=starmeterPeople.slice(0,100);
  const body=visible.length?visible.map(starmeterPersonSection).join(''):starmeterError?`<div class="starmeter-error"><h2>STARmeter unavailable</h2><p>${esc(starmeterError)}</p><button class="btn secondary" data-starmeter-retry>Try again</button></div>`:`<div class="starmeter-page-loading"><span class="provider-spinner"></span><strong>Loading IMDb STARmeter Top 100…</strong><small>Preparing the people viewers are searching for now.</small></div>`;
  return `<main class="page starmeter-page"><section class="starmeter-hero"><div><span class="eyebrow">IMDb · TRENDING PEOPLE</span><h1>STARmeter</h1><p>The current IMDb Top 100 people, connected directly to movies and TV shows available in your Swoop TV providers.</p></div><div class="starmeter-count"><strong>${starmeterPeople.length||100}</strong><span>PEOPLE</span></div></section><div class="page-content starmeter-content">${body}</div></main>`;
}
async function hydrateStarmeterIdentity(entry={}){
  const key=starmeterNormalize(entry.name);if(!key)return null;const hot=starmeterHotCache.get(key);if(hot?.person?.profile||hot?.person?.id)return hot.person;
  try{const found=await searchPeople({settings:state.settings,query:entry.name,limit:3}),exact=(found||[]).find(p=>starmeterNormalize(p.name)===key)||(found||[])[0];if(!exact)return starmeterPersonSeed(entry);const person={id:String(exact.id||entry.id||''),name:String(exact.name||entry.name),profile:String(exact.profile||entry.profile||''),knownForDepartment:String(exact.knownForDepartment||entry.knownForDepartment||'Person')};starmeterHotCache.set(key,{person,identityOnly:true,loadedAt:Date.now()});patchStarmeterIdentity(entry.rank,person);return person}catch{return starmeterPersonSeed(entry)}
}
async function hydrateStarmeterPerson(entry={},options={}){
  const background=Boolean(options?.background),key=starmeterNormalize(entry.name);if(!key)return null;if(starmeterPersonCache.has(key))return starmeterPersonCache.get(key);if(starmeterHydratePending.has(key))return starmeterHydratePending.get(key);
  const generation=starmeterGeneration;
  const task=(async()=>{try{
    const seed=await withTimeout(hydrateStarmeterIdentity(entry),3500,'Person identity timed out');if(!background&&(generation!==starmeterGeneration||state.page!=='starmeter'))return null;
    const hot=starmeterHotCache.get(key),preseedCredits=Array.isArray(hot?.credits)?hot.credits:[];
    const ready=await withTimeout(loadAndroidPersonData(seed,{credits:preseedCredits}),9000,'Provider title matching timed out');if(!background&&(generation!==starmeterGeneration||state.page!=='starmeter'))return null;
    const value={person:ready.person||seed,movies:ready.movies||[],shows:ready.shows||[],loadedAt:Date.now()};starmeterRetryCounts.delete(key);starmeterPersonCache.set(key,value);starmeterHotCache.set(key,{...hot,...value});personLibraryCache.set(`${value.person.id||''}|${String(value.person.name||entry.name).toLowerCase()}`,value);patchStarmeterPerson(entry.rank);return value;
  }catch(err){if(!background&&(generation!==starmeterGeneration||state.page!=='starmeter'))return null;const message=err?.message||'No provider matches',retryable=/timed out|index is still preparing/i.test(message),seed=starmeterPersonSeed(entry),value={person:seed,movies:[],shows:[],loadedAt:Date.now(),failed:true,retryable,error:message};starmeterPersonCache.set(key,value);patchStarmeterPerson(entry.rank);if(retryable&&!background){const tries=Number(starmeterRetryCounts.get(key)||0);if(tries<2){starmeterRetryCounts.set(key,tries+1);setTimeout(()=>{if(generation!==starmeterGeneration||state.page!=='starmeter')return;starmeterPersonCache.delete(key);queueStarmeterPerson(entry)},2200)}}return value}finally{starmeterHydratePending.delete(key)}})();starmeterHydratePending.set(key,task);return task;
}
function queueStarmeterPerson(entry={},options={}){
  const key=starmeterNormalize(entry.name);if(!key||starmeterPersonCache.has(key)||starmeterHydratePending.has(key)||starmeterHydrateQueue.some(x=>starmeterNormalize(x.name)===key))return;
  if(options?.priority)starmeterHydrateQueue.unshift(entry);else starmeterHydrateQueue.push(entry);pumpStarmeterHydration();
}
function pumpStarmeterHydration(){
  if(state.page!=='starmeter')return;
  while(starmeterHydrateBusy<STARMETER_HYDRATE_CONCURRENCY&&starmeterHydrateQueue.length){
    const entry=starmeterHydrateQueue.shift(),generation=starmeterGeneration;starmeterHydrateBusy++;
    Promise.resolve(hydrateStarmeterPerson(entry)).finally(()=>{if(generation===starmeterGeneration)starmeterHydrateBusy=Math.max(0,starmeterHydrateBusy-1);if(generation===starmeterGeneration&&state.page==='starmeter'&&starmeterHydrateQueue.length)setTimeout(pumpStarmeterHydration,18)});
  }
}
function patchStarmeterIdentity(rank,person={}){if(state.page!=='starmeter')return false;const section=document.querySelector(`[data-starmeter-rank="${Number(rank)}"]`);if(!section)return false;const cardEl=section.querySelector('.starmeter-person-card');if(!cardEl)return false;cardEl.dataset.personId=person.id||'';cardEl.dataset.personProfile=person.profile||'';cardEl.dataset.personDepartment=person.knownForDepartment||'Person';const old=cardEl.querySelector('img,.starmeter-person-fallback'),fresh=person.profile?Object.assign(document.createElement('img'),{alt:person.name||''}):document.createElement('div');if(person.profile){fresh.dataset.swoopArt=person.profile;old?.replaceWith(fresh);loadArtwork(fresh,{priority:'high'})}return true}
function patchStarmeterPerson(rank){
  if(state.page!=='starmeter'||detailItem||personView)return false;const entry=starmeterPeople.find(x=>Number(x.rank)===Number(rank)),section=document.querySelector(`[data-starmeter-rank="${Number(rank)}"]`);if(!entry||!section)return false;
  const active=section.contains(document.activeElement)?tvFocusSignature(document.activeElement):null,wrap=document.createElement('div');wrap.innerHTML=starmeterPersonSection(entry);const fresh=wrap.firstElementChild;if(!fresh)return false;
  const oldPerson=section.querySelector('.starmeter-person-column'),oldLibrary=section.querySelector('.starmeter-library-column'),newPerson=fresh.querySelector('.starmeter-person-column'),newLibrary=fresh.querySelector('.starmeter-library-column');if(oldPerson&&newPerson)oldPerson.replaceWith(newPerson);if(oldLibrary&&newLibrary)oldLibrary.replaceWith(newLibrary);
  hydrateArtwork(section);hydrateVisibleImdbRatings(section);bindDynamicCards(section);bindPersonLinks(section);if(active)requestAnimationFrame(()=>restoreFocusSignatureIn(section,active));return true;
}
function restoreFocusSignatureIn(root,sig){if(!root||!sig)return false;let target=null;if(sig.id)target=root.querySelector(`#${CSS.escape(sig.id)}`);if(!target&&sig.attr)target=[...root.querySelectorAll(`[${sig.attr}]`)].find(x=>x.getAttribute(sig.attr)===sig.value);if(!target&&sig.text)target=[...root.querySelectorAll('button,[tabindex],.card')].find(x=>(x.getAttribute('aria-label')||x.textContent||'').trim().replace(/\s+/g,' ').slice(0,100)===sig.text);if(target){try{target.focus({preventScroll:true})}catch{target.focus()}return true}return false}
function appendStarmeterSections(count=STARMETER_APPEND_BATCH){
  if(state.page!=='starmeter'||!starmeterPeople.length)return false;const host=document.querySelector('.starmeter-content'),sentinel=host?.querySelector('[data-starmeter-sentinel]');if(!host||!sentinel)return false;const start=Math.max(STARMETER_INITIAL_VISIBLE,starmeterVisibleCount),end=Math.min(starmeterPeople.length,start+Math.max(1,Number(count||STARMETER_APPEND_BATCH)));if(end<=start)return false;
  const wrap=document.createElement('div');wrap.innerHTML=starmeterPeople.slice(start,end).map(starmeterPersonSection).join('');const nodes=[...wrap.children];for(const node of nodes)host.insertBefore(node,sentinel);starmeterVisibleCount=end;for(const node of nodes){hydrateArtwork(node);bindDynamicCards(node);bindPersonLinks(node);observeStarmeterSections(node)}if(end>=starmeterPeople.length)sentinel.remove();return true;
}
function observeStarmeterSections(root=document){
  if(state.page!=='starmeter')return;if(!('IntersectionObserver'in globalThis)){starmeterPeople.slice(0,Math.min(starmeterPeople.length,18)).forEach((entry,i)=>queueStarmeterPerson(entry,{priority:i<6}));return}
  if(!starmeterObserver)starmeterObserver=new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting)continue;const rank=Number(e.target.dataset.starmeterRank||0),idx=starmeterPeople.findIndex(x=>Number(x.rank)===rank);if(idx>=0){queueStarmeterPerson(starmeterPeople[idx],{priority:true});for(let ahead=1;ahead<=STARMETER_PREFETCH_AHEAD;ahead++){const next=starmeterPeople[idx+ahead];if(next)queueStarmeterPerson(next,{priority:ahead<=5})}}}}, {root:null,rootMargin:'1700px 0px 1700px 0px',threshold:.01});
  const nodes=root?.matches?.('.starmeter-person-section')?[root]:[...(root?.querySelectorAll?.('.starmeter-person-section')||[])];nodes.forEach(x=>starmeterObserver.observe(x));
}
function setupStarmeterAutoLoad(){starmeterAutoLoadObserver?.disconnect?.();starmeterAutoLoadObserver=null;starmeterVisibleCount=starmeterPeople.length}
function prewarmStarmeterHotCache(limit=100){
  clearTimeout(starmeterPrewarmTimer);let index=0,max=Math.min(Number(limit||100),starmeterPeople.length);const step=async()=>{if(index>=max)return;if(Date.now()-Number(tvLastActivationAt||0)<900){starmeterPrewarmTimer=setTimeout(step,900);return}const entry=starmeterPeople[index++];await hydrateStarmeterIdentity(entry);starmeterPrewarmTimer=setTimeout(step,index<18?260:900)};starmeterPrewarmTimer=setTimeout(step,500)
}
function starmeterPeopleForSearch(term=''){
  const q=starmeterNormalize(term);if(q.length<2)return[];
  const matches=starmeterPeople.filter(p=>starmeterNormalize(p.name).includes(q)).slice(0,8);
  // Names are instantly searchable from the local Top 100 manifest. Warm only the
  // first couple of matching people while the user is typing so a likely selection
  // can already have portrait/identity/library data without hammering the metadata
  // service or slowing remote navigation.
  matches.slice(0,4).forEach(entry=>{const key=starmeterNormalize(entry.name);if(!starmeterHotCache.get(key)?.person?.profile)setTimeout(()=>hydrateStarmeterIdentity(entry),0)});
  return matches.map(p=>{const hot=starmeterHotCache.get(starmeterNormalize(p.name));return hot?.person||starmeterPersonSeed(p)})
}
function mySwoopPage(){
  const continuing=continueItems(),saved=listItems(),recent=watchHistoryItems(),liveSaved=state.liveFavourites.map(id=>savedItem(id)).filter(Boolean);
  const sections=[
    continuing.length?rail('Continue Watching',continuing.slice(0,100),true,`${continuing.length.toLocaleString()} in progress`,{rowId:'continue',total:continuing.length}):'',
    saved.length?rail('Saved Movies & TV Shows',saved.slice(0,100),true,`${saved.length.toLocaleString()} saved`,{rowId:'myswoop-saved',total:saved.length}):'',
    liveSaved.length?liveSimpleRail('Favourite Channels',liveSaved.slice(0,100),`${liveSaved.length.toLocaleString()} saved`):'',
    recent.length?rail('Recently Watched',recent.slice(0,100),true,`${recent.length.toLocaleString()} recently watched`,{rowId:'myswoop-recent',total:recent.length}):''
  ].filter(Boolean).join('');
  const total=continuing.length+saved.length+liveSaved.length+recent.length;
  return `<main class="page myswoop-page"><section class="collection-hero myswoop-hero"><div class="eyebrow">YOUR SWOOP TV</div><h1>My SwoopTV</h1><p>Pick up where you left off, find everything you saved, jump back into favourite channels and revisit recent watches.</p><div class="collection-count">${total.toLocaleString()} personal items</div></section><div class="page-content myswoop-content">${sections||empty('My SwoopTV is ready','Start watching, save a title or favourite a Live TV channel and it will appear here.')}</div></main>`;
}
function myListPage(){return mySwoopPage()}
function empty(title,copy){return `<div class="empty"><div class="empty-mark">S</div><h3>${esc(title)}</h3><p>${esc(copy)}</p><button class="btn accent" data-modal="provider">Add TV Provider</button></div>`}
function searchPage(){return `<main class="page search-page"><div class="search-hero"><div class="eyebrow">FIND SOMETHING GREAT</div><h1>Search Swoop TV</h1><div class="searchbox searchbox-large"><span>⌕</span><input id="searchInput" autofocus placeholder="Movies, TV shows, live channels, actors, actresses, directors…" /></div></div><div class="page-content"><div id="searchPeople" class="search-people"></div><div id="searchResults" class="content-grid search-results"></div></div></main>`}
function settingsPage(){
  const counts={live:nativeCatalogMode?nativeTotal('live'):items('live').length,movie:nativeCatalogMode?nativeTotal('movie'):items('movie').length,series:nativeCatalogMode?nativeTotal('series'):items('series').length};
  return `<main class="page settings-page"><div class="settings-hero"><div class="eyebrow">${esc(activeProfile()?.name||'SWOOP TV')} · PROFILE SETTINGS</div><h1>Settings</h1><p>Manage your profile, TV providers, Home screen and playback.</p></div><div class="page-content settings-list">
  <section class="setting-card setting-card-feature"><div class="setting-icon">TV</div><div class="setting-main"><h3>TV Providers</h3><p>${state.providers.length?`${enabledProviders().length} enabled · ${state.providers.length} connected`:'No provider connected'}</p><div class="setting-stats"><span><strong>${counts.live.toLocaleString()}</strong> Live Streams</span><span><strong>${counts.movie.toLocaleString()}</strong> Unique Movies</span><span><strong>${counts.series.toLocaleString()}</strong> Shows</span></div><div class="cta-row"><button class="btn accent" data-modal="provider">Manage Providers</button>${state.providers.length?'<button class="btn secondary" data-provider-refresh-all>Refresh All</button>':''}</div></div></section>
  ${NATIVE_ANDROID&&androidAppUpdateAvailable?`<section class="setting-card app-update-card"><div class="setting-icon">↑</div><div class="setting-main"><h3>Swoop TV update available</h3><p>Version ${esc(androidAppUpdateAvailable.version)} is ready for Google TV.</p><div class="cta-row"><span class="btn secondary">Downloader code 3682231</span></div></div></section>`:''}
  <section class="setting-card profile-setting-card"><div class="setting-icon profile-setting-avatar">${profileAvatarHtml(activeProfile(),'profile-avatar-lg')}</div><div class="setting-main"><h3>${esc(activeProfile()?.name||'Profile')}</h3><p>${activeProfile()?.kids?'Kids restrictions are enabled.':'Personal viewing profile.'} Continue Watching, My SwoopTV, recommendations, favourite channels, Home order and theme are private to this profile.</p><div class="setting-stats"><span><strong>${state.profiles.length}</strong> Household profiles</span><span><strong>${state.watchHistory.length}</strong> Watched</span><span><strong>${state.liveFavourites.length}</strong> Live favourites</span></div><div class="cta-row"><button class="btn accent" data-profile-picker>Switch Profile</button><button class="btn secondary" data-profile-edit="${esc(activeProfile()?.id||'')}">Edit Profile</button></div></div></section>
  <section class="setting-card"><div class="setting-icon">NEW</div><div class="setting-main"><h3>What's New</h3><p>See what changed in Swoop TV v${esc(ANDROID_CURRENT_VERSION)} and reopen the latest release notes at any time.</p><div class="cta-row"><button class="btn secondary" data-show-whats-new>Open What's New</button></div></div></section>
  <section class="setting-card performance-setting-card"><div class="setting-icon">⚡</div><div class="setting-main"><h3>Performance</h3><p>${performanceLabel()}. Choose the balance you prefer between speed and richer visuals.</p><div class="cta-row"><button class="btn ${state.settings.performanceMode!=='cinematic'?'accent':'secondary'}" data-performance-mode="auto">Auto / Recommended</button><button class="btn ${state.settings.performanceMode==='cinematic'?'accent':'secondary'}" data-performance-mode="cinematic">Full Cinematic</button></div></div></section>
  ${NATIVE_ANDROID&&tvHardwareTestMode?`<section class="setting-card hardware-test-card"><div class="setting-icon">HW</div><div class="setting-main"><h3>Hardware Test Mode</h3><p>Live focus, rail, DOM, pending-work, key and renderer diagnostics are active. Choose a numbered test before reproducing an issue, then export the session.</p><div class="hardware-test-current"><strong>${esc(tvHardwareCurrentTest||'FREE RUN')}</strong><span>${esc(TV_HARDWARE_TESTS.find(x=>x.id===tvHardwareCurrentTest)?.label||'General hardware diagnostics')}</span></div><div class="hardware-test-list">${TV_HARDWARE_TESTS.map(test=>`<button class="btn ${tvHardwareCurrentTest===test.id?'accent':'secondary'} compact-btn" data-hardware-test="${esc(test.id)}">${esc(test.id)}</button>`).join('')}</div><div class="cta-row"><button class="btn accent" data-hardware-export>Save Diagnostics</button><button class="btn secondary" data-hardware-clear>Clear Log</button><button class="btn secondary" data-hardware-exit>Exit Test Mode</button></div>${tvLastDiagnosticsPath?`<small class="hardware-export-path">Last saved: ${esc(tvLastDiagnosticsPath)}</small>`:''}</div></section>`:''}
  <section class="setting-card"><div class="setting-icon">＋</div><div class="setting-main"><h3>My SwoopTV & Viewing</h3><p>${state.myList.length.toLocaleString()} saved · ${state.continueWatching.length.toLocaleString()} in progress · ${state.watchHistory.length.toLocaleString()} in viewing history.</p><div class="cta-row"><button class="btn secondary" data-page="myswoop">Open My SwoopTV</button>${state.continueWatching.length?'<button class="btn secondary" data-action="clear-history">Clear Continue Watching</button>':''}${state.watchHistory.length?'<button class="btn secondary" data-action="clear-viewing">Reset Recommendations</button>':''}</div></div></section>
  <section class="setting-card"><div class="setting-icon">▶</div><div class="setting-main"><h3>Playback & Live TV</h3><p>${Object.keys(state.settings.movieSourcePreferences||{}).length.toLocaleString()} remembered source choices · ${state.liveFavourites.length.toLocaleString()} favourite live channels.</p><div class="cta-row"><button class="btn secondary" data-page="live">Open Live TV</button>${Object.keys(state.settings.movieSourcePreferences||{}).length?'<button class="btn secondary" data-action="clear-source-preferences">Reset Source Choices</button>':''}${state.liveFavourites.length?'<button class="btn secondary" data-action="clear-live-favourites">Clear Live Favourites</button>':''}</div></div></section>
  <section class="setting-card"><div class="setting-icon">ROW</div><div class="setting-main"><h3>Home & Discovery</h3><p>${state.settings.homeRows.length} Home rows selected. Choose the sections you want to see on Home.</p><div class="cta-row"><button class="btn accent" data-modal="homeRows">Customize Home</button><button class="btn secondary" data-modal="mdblist">Add Custom MDBList Row</button></div>${state.mdblistRows.length?state.mdblistRows.map((r,i)=>`<div class="kv"><span>${esc(r.name)}</span><span>${r.items.length} matched · ${esc(relativeRefreshTime(r.updatedAt))} · <button class="nav-btn" data-remove-row="${i}">Remove</button></span></div>`).join(''):''}</div></section>
  <section class="setting-card theme-setting-card"><div class="setting-icon">THEME</div><div class="setting-main"><h3>Theme & Cinematic Artwork</h3><p><strong>${esc(currentTheme().name)}</strong> is active for this profile. Themes change the full Swoop TV presentation — Home hero, cards, navigation, buttons, badges, detail screens, Guide and loading states.</p><div class="kv"><span>Theme</span><span>${esc(currentTheme().name)} · ${esc(currentTheme().tagline)}</span></div><div class="kv"><span>Background</span><span>${state.settings.backgroundOverride?esc(validHex(state.settings.backgroundColor)):`${esc(currentTheme().bg)} · theme default`}</span></div><div class="cta-row"><button class="btn accent" data-modal="homeRows">Choose Theme & Home</button></div></div></section>
  ${NATIVE_PLAYBACK?`<section class="setting-card native-ready"><div class="setting-icon">▶</div><div class="setting-main"><h3>Playback</h3><p>Playback is ready.</p></div></section>`:`<section class="setting-card"><div class="setting-icon">↗</div><div class="setting-main"><h3>Connection Helper</h3><p>${state.settings.xtreamRelayUrl?'Configured':'Not configured'}</p></div></section>`}
  <section class="setting-card"><div class="setting-icon">TM</div><div class="setting-main"><h3>Metadata Credits</h3><p>This product uses the TMDB API but is not endorsed or certified by TMDB. Official trailers are displayed through the YouTube embedded player when available.</p></div></section>
  <section class="setting-card"><div class="setting-icon">◈</div><div class="setting-main"><h3>Privacy</h3><p>Swoop TV does not include or host TV content. Your provider details and viewing data are kept on this device.</p></div></section>
  </div></main>`;
}

function guideProviderCategoryKey(){return enabledProviders().filter(p=>p.type==='xtream').map(p=>`${p.id}:${Number(p.lastRefreshed||0)}`).join('|')}
async function ensureGuideProviderCategoryOrder({force=false}={}){
  const key=guideProviderCategoryKey();
  if(!key){guideProviderCategoryCache.key='';guideProviderCategoryCache.names=[];guideProviderCategoryCache.loadedAt=Date.now();return false}
  if(!force&&guideProviderCategoryCache.key===key&&guideProviderCategoryCache.names.length&&Date.now()-guideProviderCategoryCache.loadedAt<10*60*1000)return false;
  if(guideProviderCategoryCache.loading)return guideProviderCategoryCache.loading;
  const before=guideProviderCategoryCache.names.join('\u0001');
  const task=(async()=>{
    const names=[],seen=new Set();
    for(const p of enabledProviders().filter(x=>x.type==='xtream')){
      const cfg=providerConfigFor(p.id);if(!cfg?.server||!cfg?.username||!cfg?.password)continue;
      try{const cats=await fetchXtreamLiveCategories(cfg);for(const cat of cats){const name=String(cat?.category_name||'').trim();if(name&&!seen.has(name)){seen.add(name);names.push(name)}}}catch{}
    }
    guideProviderCategoryCache.key=key;guideProviderCategoryCache.names=names;guideProviderCategoryCache.loadedAt=Date.now();
    return before!==names.join('\u0001');
  })().finally(()=>{guideProviderCategoryCache.loading=null});
  guideProviderCategoryCache.loading=task;return task;
}
function guideCategories(){
  const total=nativeCatalogMode?nativeTotal('live'):providerFiltered(items('live')).length;
  let cats=[];
  if(nativeCatalogMode){
    cats=(nativeCategoryCache.live||[]).filter(x=>x?.name&&Number(x.count)>0).map(x=>({name:String(x.name),count:Number(x.count||0),providerOrder:Number(x.provider_order??999999),firstSeen:Number(x.first_seen??999999)}));
  }else{
    const counts=new Map(),order=new Map();let i=0;for(const ch of providerFiltered(items('live'))){const group=String(ch.group||'Uncategorised').trim()||'Uncategorised';counts.set(group,(counts.get(group)||0)+1);if(!order.has(group))order.set(group,Number.isFinite(Number(ch.providerCategoryOrder))?Number(ch.providerCategoryOrder):i++);}
    cats=[...counts].map(([name,count])=>({name,count,providerOrder:Number(order.get(name)??999999)})).sort((a,b)=>a.providerOrder-b.providerOrder);
  }
  const byName=new Map(cats.map(x=>[x.name,x])),ordered=[],used=new Set();
  for(const name of guideProviderCategoryCache.names||[]){const hit=byName.get(name);if(hit&&!used.has(name)){ordered.push(hit);used.add(name)}}
  for(const cat of cats.sort((a,b)=>(a.providerOrder-b.providerOrder)||(a.firstSeen-b.firstSeen)||a.name.localeCompare(b.name)))if(!used.has(cat.name)){ordered.push(cat);used.add(cat.name)}
  return [{name:'',label:'All Channels',count:total},...ordered];
}
function guideCategoryLabel(){return guideCategory||'All Channels'}
function guideChannelKey(){return `${providerFilter}|${guideCategory}|${guideLimit}`}
function guideChannelSnapshot(){
  if(nativeCatalogMode){const key=guideChannelKey(),ready=guideChannelCache.key===key;return {items:ready?guideChannelCache.items:[],total:ready?guideChannelCache.total:Number(guideCategories().find(x=>x.name===guideCategory)?.count||0),ready,loading:guideChannelRequests.has(key)}}
  const all=providerFiltered(items('live')),filtered=guideCategory?all.filter(ch=>String(ch.group||'')===guideCategory):all;return {items:filtered.slice(0,guideLimit),total:filtered.length,ready:true,loading:false};
}
async function ensureGuideChannels({force=false}={}){
  if(!nativeCatalogMode)return guideChannelSnapshot();
  const key=guideChannelKey();if(!force&&guideChannelCache.key===key)return {...guideChannelCache,ready:true};if(!force&&guideChannelRequests.has(key))return guideChannelRequests.get(key);
  const task=(async()=>{const result=await nativeCatalogQuery({kind:'live',providerIds:nativeEnabledProviderIds(),group:guideCategory,limit:guideLimit,offset:0,sort:'name'});if(key!==guideChannelKey())return {...guideChannelCache,ready:false};guideChannelCache.key=key;guideChannelCache.items=cacheNativeItems(result?.items||[]);guideChannelCache.total=Number(result?.total||guideChannelCache.items.length);return {...guideChannelCache,ready:true}})().finally(()=>guideChannelRequests.delete(key));
  guideChannelRequests.set(key,task);return task;
}
function guideCategoryButtons(){
  return guideCategories().map(cat=>{const name=cat.name||'',label=cat.label||cat.name||'Uncategorised',active=name===guideCategory;return `<button class="guide-category ${active?'active':''}" data-guide-category="${esc(name)}"><span>${esc(label)}</span><strong>${Number(cat.count||0).toLocaleString()}</strong></button>`}).join('');
}
function guidePage(){
  const snapshot=guideChannelSnapshot(),channels=snapshot.items,hours=2,slots=Array.from({length:5},(_,i)=>new Date(guideStart+i*30*60000)),totalAll=nativeCatalogMode?nativeTotal('live'):providerFiltered(items('live')).length;
  const providerGuide=enabledProviders().length>1?'Unified provider EPG':enabledProviders()[0]?.type==='xtream'?'Xtream EPG':enabledProviders()[0]?.epgUrl?'XMLTV guide':'No EPG source configured';
  const label=guideCategoryLabel(),shown=channels.length,total=Number(snapshot.total||0),waiting=nativeCatalogMode&&!snapshot.ready;
  return `<main class="page guide-page"><div class="guide-shell"><div class="guide-browser"><aside class="guide-categories"><div class="guide-categories-head"><span class="eyebrow">CHANNEL GROUPS</span><h2>Categories</h2><small>${totalAll.toLocaleString()} channels</small></div><div class="guide-category-list">${guideCategoryButtons()}</div></aside>
  <section class="guide-schedule"><section class="guide-main-header guide-live-banner"><div class="guide-main-title"><div class="eyebrow">LIVE TV</div><h1>TV Guide</h1><p>${esc(new Date().toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'}))} · ${esc(providerGuide)}</p></div><div class="guide-main-actions"><div class="guide-now"><span>NOW</span><strong>${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</strong></div><button class="btn secondary" data-guide-now>Jump to now</button></div></section>
  <div class="guide-schedule-head"><div><span class="eyebrow">NOW BROWSING</span><h2>${esc(label)}</h2><small>${waiting?'Loading channels…':`${shown.toLocaleString()} shown${total?` of ${total.toLocaleString()}`:''}`}</small></div><span class="guide-window-label">2 HOURS AHEAD</span></div>
  ${guideError?`<div class="guide-alert">${esc(guideError)}</div>`:''}
  <div class="guide-load-progress" data-guide-load-progress ${(guideLoading||waiting)?'':'hidden'}><div><span data-guide-load-text>${waiting?`Loading ${esc(label)} channels…`:'Loading programme guide…'}</span><strong data-guide-load-percent>${waiting?'…':'0%'}</strong></div><i><b data-guide-load-bar class="${waiting?'indeterminate':''}" style="${waiting?'width:34%':'width:0%'}"></b></i><small>${waiting?'Loading channels…':'Loading programme information…'}</small></div>
  <div class="guide-grid-scroll">${waiting?`<div class="guide-category-loading"><span class="provider-spinner"></span><strong>Loading ${esc(label)} channels…</strong><small>This avoids loading all ${totalAll.toLocaleString()} channels at once.</small></div>`:channels.length?`<div class="guide-grid"><div class="guide-header"><div class="guide-channel-head">Channels</div><div class="guide-times">${slots.map(d=>`<span>${d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span>`).join('')}</div></div><div class="guide-body">${channels.map(ch=>guideRow(ch,hours)).join('')}</div></div>`:`<div class="guide-category-empty"><strong>No channels in ${esc(label)}</strong><span>Choose another category from the left.</span></div>`}</div>
  ${!waiting&&shown<total?`<div class="guide-auto-more" data-guide-auto-more>More channels load automatically as you browse · ${shown.toLocaleString()} of ${total.toLocaleString()}</div>`:''}
  </section></div></div></main>`;
}
function guideRow(channel,hours=3){
  const cached=epgCache.get(channel.id);
  return `<div class="guide-row" data-guide-row="${esc(channel.id)}"><button class="guide-channel" data-play="${esc(channel.id)}">${channel.logo?`<img data-swoop-art="${esc(channel.logo)}" alt="">`:'<span class="guide-logo-fallback">TV</span>'}<span><strong>${esc(channel.name)}</strong><small>${esc(channel.group||'Live TV')}</small></span><b>▶</b></button><div class="guide-programs">${cached?guideProgramsHtml(channel,cached.list,hours):NATIVE_ANDROID?guideProgramsHtml(channel,[],hours):`<div class="guide-loading"><i></i><span>${guideLoading?'Loading programme guide…':'Programme guide will load here'}</span></div>`}</div></div>`;
}
function guideProgramsHtml(channel,list=[],hours=3){
  const start=guideStart,end=start+hours*3600000;
  const blocks=[];
  for(const p of list){
    const ps=Number(p.startMs),pe=Number(p.endMs);
    if(!Number.isFinite(ps)||!Number.isFinite(pe)||pe<=start||ps>=end)continue;
    const clippedStart=Math.max(start,ps),clippedEnd=Math.min(end,pe);
    const left=((clippedStart-start)/(end-start))*100,width=Math.max(5,((clippedEnd-clippedStart)/(end-start))*100);
    const now=Date.now()>=ps&&Date.now()<pe;
    blocks.push(`<button class="guide-program ${now?'current':''}" data-play="${esc(channel.id)}" style="left:${left.toFixed(3)}%;width:${width.toFixed(3)}%" title="${esc(p.title)}"><strong>${esc(p.title||'Programme')}</strong><span>${new Date(ps).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}${now?' · NOW':''}</span></button>`);
  }
  if(!blocks.length)return `<button class="guide-program guide-program-empty" data-play="${esc(channel.id)}" style="left:0;width:100%"><strong>${list.length?'No programme in this window':'No programme information'}</strong><span>Watch ${esc(channel.name)}</span></button>`;
  const nowLeft=Math.max(0,Math.min(100,((Date.now()-start)/(end-start))*100));
  return `${blocks.join('')}${Date.now()>=start&&Date.now()<=end?`<i class="guide-now-line" style="left:${nowLeft}%"></i>`:''}`;
}
function decodeMaybeBase64(value=''){
  const text=String(value||'');
  if(!text)return'';
  try{if(/^[A-Za-z0-9+/=]+$/.test(text)&&text.length%4===0){const decoded=decodeURIComponent(Array.from(atob(text),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));if(decoded&&/[\p{L}\p{N}]/u.test(decoded))return decoded}}catch{}
  return text;
}
function epgTime(entry,key){
  const direct=Number(entry?.[`${key}_timestamp`]||entry?.[key==='start'?'start_timestamp':'stop_timestamp']);
  if(Number.isFinite(direct)&&direct>0)return direct*1000;
  const raw=String(entry?.[key]||entry?.[key==='start'?'start':'end']||'').trim();
  if(!raw)return NaN;
  const parsed=Date.parse(raw.includes('T')?raw:raw.replace(' ','T'));
  return parsed;
}
function normalizeXtreamEpg(payload){
  const list=Array.isArray(payload)?payload:Array.isArray(payload?.epg_listings)?payload.epg_listings:Array.isArray(payload?.epg)?payload.epg:[];
  return list.map(e=>({title:decodeMaybeBase64(e.title||e.name||'Programme'),description:decodeMaybeBase64(e.description||''),startMs:epgTime(e,'start'),endMs:epgTime(e,'end')})).filter(e=>Number.isFinite(e.startMs)&&Number.isFinite(e.endMs));
}
async function m3uGuideText(provider){
  const cached=m3uGuideTextCache.get(provider.id);if(cached&&Date.now()-Number(cached.loadedAt||0)<10*60*1000)return cached.text;
  const text=NATIVE_PLAYBACK?await nativeFetchText(provider.epgUrl):await (await fetch(provider.epgUrl,{cache:'no-store'})).text();m3uGuideTextCache.set(provider.id,{loadedAt:Date.now(),text});return text;
}
async function xtreamGuideText(provider){
  const cached=xtreamGuideTextCache.get(provider.id);if(cached&&Date.now()-Number(cached.loadedAt||0)<10*60*1000)return cached.text;
  const cfg=providerConfigFor(provider.id);if(!cfg?.server||!cfg?.username||!cfg?.password)throw new Error('Missing saved Xtream login');
  const text=await fetchXtreamXmltvText(cfg);xtreamGuideTextCache.set(provider.id,{loadedAt:Date.now(),text});return text;
}
async function loadGuideEpg(){
  if(state.page!=='guide'||guideLoading)return;
  if(NATIVE_ANDROID&&!epgDurableRestored){const restored=await restoreDurableEpgCache();if(restored&&state.page==='guide'){for(const ch of guideChannelSnapshot().items)updateGuideRow(ch)}}
  const token=++guideLoadToken,currentKey=guideChannelKey();
  if(nativeCatalogMode){const before=guideChannelSnapshot();if(!before.ready){await ensureGuideChannels();if(state.page!=='guide'||token!==guideLoadToken||currentKey!==guideChannelKey())return;render();return;}}
  const channels=guideChannelSnapshot().items,stale=Date.now()-EPG_TTL_MS;if(!channels.length)return;
  if(NATIVE_ANDROID&&channels.every(ch=>Number(epgCache.get(ch.id)?.loadedAt||0)>=stale)){guideError='';return;}
  guideLoading=true;guideError='';document.querySelectorAll('.guide-loading span').forEach(el=>el.textContent='Loading programme guide…');const guideProgress=document.querySelector('[data-guide-load-progress]'),guideBar=document.querySelector('[data-guide-load-bar]'),guidePct=document.querySelector('[data-guide-load-percent]'),guideText=document.querySelector('[data-guide-load-text]');if(guideProgress)guideProgress.hidden=false;guideBar?.classList.remove('indeterminate');let guideDone=channels.filter(ch=>Number(epgCache.get(ch.id)?.loadedAt||0)>=stale).length;const updateGuideProgress=(done,total,label='Loading programme guide…')=>{const pct=Math.max(2,Math.min(98,Math.round((Number(done||0)/Math.max(1,Number(total||1)))*100)));if(guideBar)guideBar.style.width=`${pct}%`;if(guidePct)guidePct.textContent=`${pct}%`;if(guideText)guideText.textContent=label};updateGuideProgress(guideDone,channels.length,`Loading ${guideCategoryLabel()} programme data…`);
  try{
    // M3U/XMLTV is downloaded at most once per provider for 10 minutes, then filtered to the selected category.
    for(const p of enabledProviders().filter(x=>x.type==='m3u'&&x.epgUrl)){
      if(token!==guideLoadToken||currentKey!==guideChannelKey())return;
      const providerChannels=channels.filter(ch=>{const src=preferredLiveSource(ch);return src.providerId===p.id&&(!epgCache.get(ch.id)||epgCache.get(ch.id).loadedAt<stale)});if(!providerChannels.length)continue;
      try{const text=await m3uGuideText(p);const wanted=new Set(providerChannels.map(c=>preferredLiveSource(c).tvgId||c.name).filter(Boolean));const parsed=parseXMLTV(text,wanted);for(const ch of providerChannels){if(token!==guideLoadToken||currentKey!==guideChannelKey())return;const src=preferredLiveSource(ch),key=src.tvgId||ch.name;epgCache.set(ch.id,{loadedAt:Date.now(),list:parsed[key]||[]});updateGuideRow(ch);guideDone++;updateGuideProgress(guideDone,channels.length,`Loaded programme data for ${Math.min(guideDone,channels.length)} of ${channels.length} channels…`)}}catch{}
    }
    const pending=channels.filter(ch=>!epgCache.get(ch.id)||epgCache.get(ch.id).loadedAt<stale);let cursor=0;
    const worker=async()=>{while(cursor<pending.length){if(token!==guideLoadToken||currentKey!==guideChannelKey())return;const ch=pending[cursor++],src=preferredLiveSource(ch);if(src.source!=='xtream'){guideDone++;updateGuideProgress(guideDone,channels.length,`Checked ${Math.min(guideDone,channels.length)} of ${channels.length} channels…`);continue}const cfg=providerConfigFor(src);try{if(!cfg.server||!cfg.username||!cfg.password)throw new Error('Missing saved login');let payload=await fetchXtreamShortEpg(cfg,src.streamId,12),list=normalizeXtreamEpg(payload);if(!list.length){payload=await fetchXtreamSimpleEpg(cfg,src.streamId);list=normalizeXtreamEpg(payload)}if(token!==guideLoadToken||currentKey!==guideChannelKey())return;epgCache.set(ch.id,{loadedAt:Date.now(),list});updateGuideRow(ch)}catch{epgCache.set(ch.id,{loadedAt:Date.now(),list:[]});updateGuideRow(ch)}guideDone++;updateGuideProgress(guideDone,channels.length,`Loaded programme data for ${Math.min(guideDone,channels.length)} of ${channels.length} channels…`)}};
    await Promise.all(Array.from({length:Math.min(4,pending.length||1)},worker));
    if(token!==guideLoadToken||currentKey!==guideChannelKey())return;
    // Some Xtream panels expose programme data only through their XMLTV feed. Use it as a
    // provider-level fallback only when the lightweight per-channel APIs returned nothing.
    if(!channels.some(ch=>(epgCache.get(ch.id)?.list||[]).length)){
      for(const p of enabledProviders().filter(x=>x.type==='xtream')){
        const providerChannels=channels.filter(ch=>preferredLiveSource(ch).providerId===p.id);if(!providerChannels.length)continue;
        try{updateGuideProgress(Math.max(1,guideDone),channels.length,`Checking ${p.name||'provider'} full programme guide…`);const text=await xtreamGuideText(p);if(token!==guideLoadToken||currentKey!==guideChannelKey())return;const wanted=new Set(providerChannels.map(c=>{const src=preferredLiveSource(c);return src.tvgId||src.epgChannelId||''}).filter(Boolean));if(!wanted.size)continue;const parsed=parseXMLTV(text,wanted);for(const ch of providerChannels){const src=preferredLiveSource(ch),key=src.tvgId||src.epgChannelId||'',list=key?(parsed[key]||[]):[];if(list.length){epgCache.set(ch.id,{loadedAt:Date.now(),list});updateGuideRow(ch)}}}catch{}
      }
    }
    if(!channels.some(ch=>(epgCache.get(ch.id)?.list||[]).length))guideError=`No programme data was returned for ${guideCategoryLabel()}.`;
  }catch(err){guideError=err.message||'Could not load programme guide data.'}
  finally{if(token!==guideLoadToken){guideLoading=false;return}guideLoading=false;if(guideBar)guideBar.style.width='100%';if(guidePct)guidePct.textContent='100%';if(guideText)guideText.textContent=guideError?'Guide load finished with limited data':'Programme guide ready';setTimeout(()=>{if(guideProgress)guideProgress.hidden=true},900);const alert=document.querySelector('.guide-alert');if(guideError&&!alert){const schedule=document.querySelector('.guide-schedule');if(schedule)schedule.insertAdjacentHTML('afterbegin',`<div class="guide-alert">${esc(guideError)}</div>`)}}
}
function updateGuideRow(ch){const row=[...document.querySelectorAll('[data-guide-row]')].find(x=>x.dataset.guideRow===ch.id);if(!row)return;const box=row.querySelector('.guide-programs');const cached=epgCache.get(ch.id);if(box&&cached)box.innerHTML=guideProgramsHtml(ch,cached.list,2);hydrateArtwork(row)}

let androidGuidePrewarmRunning=false,androidDestinationPrewarmStarted=false;
async function prewarmAndroidGuideEpg(){
  if(!NATIVE_ANDROID||androidGuidePrewarmRunning||!state.catalog.length)return;androidGuidePrewarmRunning=true;
  try{
    const stale=Date.now()-EPG_TTL_MS,channels=tvFastItems('live').filter(ch=>{const src=preferredLiveSource(ch);return src?.source==='xtream'&&(!epgCache.get(ch.id)||Number(epgCache.get(ch.id)?.loadedAt||0)<stale)}).slice(0,18);let cursor=0;
    const worker=async()=>{while(cursor<channels.length){const ch=channels[cursor++],src=preferredLiveSource(ch),cfg=providerConfigFor(src);if(!cfg?.server||!cfg?.username||!cfg?.password)continue;try{let payload=await fetchXtreamShortEpg(cfg,src.streamId,12),list=normalizeXtreamEpg(payload);if(!list.length){payload=await fetchXtreamSimpleEpg(cfg,src.streamId);list=normalizeXtreamEpg(payload)}epgCache.set(ch.id,{loadedAt:Date.now(),list})}catch{}}};
    await Promise.all(Array.from({length:Math.min(2,channels.length||1)},worker));
  }finally{androidGuidePrewarmRunning=false}
}
function scheduleAndroidDestinationPrewarm(){
  if(!NATIVE_ANDROID||androidDestinationPrewarmStarted||profilePickerOpen||!state.catalog.length)return;androidDestinationPrewarmStarted=true;
  const run=async()=>{try{const rows=selectedHomeRows().slice(0,4),warm=[];for(const def of rows)warm.push(...homeRowItems(def.id).slice(0,10));prewarmArtworkUrls(warm,56);const hero=featureItem();if(hero)prewarmDetail(hero);prewarmAndroidGuideEpg().catch(()=>null);await ensureStarmeterLoaded().catch(()=>[]);await ensureGuideProviderCategoryOrder().catch(()=>false);const cats=liveRailCategories().slice(0,4).map(x=>x.name).filter(Boolean);for(const name of cats){await ensureLiveCategoryRail(name).catch(()=>null);const snap=liveRailSnapshot(name);prewarmArtworkUrls((snap.items||[]).slice(0,18),24)}}catch{}};
  if('requestIdleCallback'in window)requestIdleCallback(()=>run(),{timeout:1400});else setTimeout(run,700);
}

function bindHomeHeroTitleLogoFailure(root=document){
  const logos=root?.matches?.('.hero-title-logo')?[root]:[...(root?.querySelectorAll?.('.hero-title-logo')||[])];
  for(const logo of logos){if(logo.dataset.boundHeroTitleLogoFailure)return;logo.dataset.boundHeroTitleLogoFailure='1';logo.addEventListener('swoop-artwork-failed',()=>{const slot=logo.closest('.hero-title-slot');logo.remove();if(slot){slot.classList.remove('has-logo','logo-pending');slot.classList.add('logo-unavailable')}})}
}
function patchHomeHeroTitle(item){
  if(!item||state.page!=='home'||modal||detailItem||playerItem)return false;
  const heroEl=document.querySelector('[data-home-hero]');if(!heroEl||heroEl.dataset.heroItem!==String(item.id))return false;
  const refreshed=visualItem(item),slot=heroEl.querySelector('[data-hero-title]');if(!slot)return false;
  const displayTitle=cleanDisplayTitle({name:refreshed.title||refreshed.name}),stateLogo=heroTitleLogoState(refreshed),logoUrl=refreshed.titleLogo||stateLogo.logo||'';
  const text=slot.querySelector('.hero-title-text');if(text)text.textContent=displayTitle;
  slot.classList.toggle('logo-pending',stateLogo.pending);slot.classList.toggle('has-logo',Boolean(logoUrl));slot.classList.toggle('logo-unavailable',stateLogo.settled&&!logoUrl);
  if(logoUrl&&!slot.querySelector(`.hero-title-logo[data-swoop-art="${CSS.escape(logoUrl)}"]`)){
    slot.querySelectorAll('.hero-title-logo').forEach(x=>x.remove());const logo=document.createElement('img');logo.className='hero-title-logo';logo.dataset.swoopArt=logoUrl;logo.alt=displayTitle;slot.appendChild(logo);bindHomeHeroTitleLogoFailure(logo);loadArtwork(logo);
  }else if(!logoUrl&&stateLogo.settled)slot.querySelectorAll('.hero-title-logo').forEach(x=>x.remove());
  return true;
}
function bindHeroControls(root=document){
  root.querySelectorAll('[data-hero-step]').forEach(el=>el.onclick=()=>{const pool=heroCandidates();if(!pool.length)return;heroRotationIndex=(heroRotationIndex+Number(el.dataset.heroStep||1)+pool.length)%pool.length;replaceHomeHero()});
  root.querySelectorAll('[data-hero-go]').forEach(el=>el.onclick=()=>{const pool=heroCandidates();if(!pool.length)return;heroRotationIndex=Math.max(0,Math.min(pool.length-1,Number(el.dataset.heroGo||0)));replaceHomeHero()});
  bindHomeHeroTitleLogoFailure(root);
}
let homeHeroSwapToken=0;
async function replaceHomeHero(){
  if(state.page!=='home'||modal||detailItem||playerItem)return;
  const current=document.querySelector('[data-home-hero]'),pool=heroCandidates();if(!current||!pool.length)return;
  heroRotationIndex=((heroRotationIndex%pool.length)+pool.length)%pool.length;const index=heroRotationIndex,item=pool[index],token=++homeHeroSwapToken;
  await preloadCriticalArtwork([item],3,NATIVE_ANDROID?950:1400);if(token!==homeHeroSwapToken||state.page!=='home'||modal||detailItem||playerItem)return;
  const liveCurrent=document.querySelector('[data-home-hero]');if(!liveCurrent)return;const wrap=document.createElement('div');wrap.innerHTML=hero(item,providerSummaryName(),{total:pool.length,index});const next=wrap.firstElementChild;if(!next)return;liveCurrent.replaceWith(next);hydrateArtwork(next);bindDynamicCards(next);bindHeroControls(next);
  if(!NATIVE_ANDROID&&item&&['movie','series'].includes(item.kind))enrichItemMetadata(item,{rerender:false}).then(()=>patchHomeHeroTitle(item));
}

function scheduleHeroRotation(){
  if(heroRotationTimer){clearInterval(heroRotationTimer);heroRotationTimer=null}
  if(state.page!=='home'||heroCandidates().length<2)return;
  heroRotationTimer=setInterval(()=>{if(document.hidden||state.page!=='home'||modal||detailItem||playerItem)return;const pool=heroCandidates();if(pool.length<2)return;heroRotationIndex=(heroRotationIndex+1)%pool.length;replaceHomeHero()},HERO_ROTATION_MS);
}

function startupRefreshPage(){
  const pct=Math.max(0,Math.min(100,Number(startupRefreshState.progress||0)));
  return `<main class="page restoring-page"><div class="restore-card startup-refresh-card"><img class="startup-swoop-logo" src="./assets/swoop-tv-logo-transparent.png" alt="Swoop TV" /><div class="provider-spinner" aria-hidden="true"></div><div class="eyebrow">UPDATING SWOOP TV</div><h1>Refreshing your TV library…</h1><p id="startupRefreshText">${esc(startupRefreshState.detail||'Swoop TV is refreshing your provider before opening the app.')}</p><div class="restore-progress"><div><span id="startupRefreshCount">${esc(startupRefreshState.provider||startupRefreshState.title||'Updating your TV library…')}</span><strong id="startupRefreshPercent">${Math.round(pct)}%</strong></div><i><b id="startupRefreshBar" style="width:${pct}%"></b></i></div><small id="startupRefreshSummary">${esc(startupRefreshState.summary||'Keep Swoop TV open while your library updates.')}</small></div></main>`;
}
function updateStartupRefreshProgress({progress,title,detail,provider,summary}={}){
  if(progress!==undefined&&Number.isFinite(Number(progress)))startupRefreshState.progress=Math.max(0,Math.min(100,Number(progress)));
  if(title!==undefined)startupRefreshState.title=String(title||'');
  if(detail!==undefined)startupRefreshState.detail=String(detail||'');
  if(provider!==undefined)startupRefreshState.provider=String(provider||'');
  if(summary!==undefined)startupRefreshState.summary=String(summary||'');
  const bar=document.querySelector('#startupRefreshBar'),pct=document.querySelector('#startupRefreshPercent'),count=document.querySelector('#startupRefreshCount'),text=document.querySelector('#startupRefreshText'),small=document.querySelector('#startupRefreshSummary');
  if(bar)bar.style.width=`${startupRefreshState.progress}%`;
  if(pct)pct.textContent=`${Math.round(startupRefreshState.progress)}%`;
  if(count)count.textContent=startupRefreshState.provider||startupRefreshState.title||'Refreshing provider…';
  if(text)text.textContent=startupRefreshState.detail||'Swoop TV is refreshing your provider before opening the app.';
  if(small)small.textContent=startupRefreshState.summary||'Keep Swoop TV open while your library updates.';
}
function providerCanRefreshOnLaunch(provider){
  const cfg=providerConfigById(provider?.id)||{};
  if(provider?.type==='xtream')return Boolean(cfg.server&&cfg.username&&cfg.password);
  if(provider?.type==='m3u')return Boolean(cfg.url||provider?.url);
  return false;
}
function androidProvidersDueForRefresh(){
  if(!NATIVE_ANDROID)return [];
  const now=Date.now();
  return enabledProviders().filter(providerCanRefreshOnLaunch).filter(provider=>{
    const cfg=providerConfigById(provider.id)||{};
    const stamp=Math.max(Number(provider.lastRefreshed||0),Number(cfg.lastRefreshed||0));
    return !stamp||now-stamp>=ANDROID_PROVIDER_AUTO_REFRESH_MS;
  });
}
function versionParts(value=''){return String(value).replace(/^v/i,'').split('.').map(x=>Number.parseInt(x,10)||0).slice(0,3)}
function compareVersions(a,b){const aa=versionParts(a),bb=versionParts(b);for(let i=0;i<3;i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return d}return 0}
async function checkAndroidAppUpdateOnLaunch(){
  if(!NATIVE_ANDROID)return null;
  let repo='';try{repo=String(globalThis.SwoopAndroid?.githubRepository?.()||'').trim()}catch{}
  if(!repo||!repo.includes('/'))return null;
  let current='0.0.0';try{current=String(globalThis.SwoopAndroid?.version?.()||ANDROID_CURRENT_VERSION)}catch{current=ANDROID_CURRENT_VERSION}
  const manifestUrl=`https://github.com/${repo}/releases/download/${ANDROID_UPDATE_RELEASE_TAG}/swoop-tv-latest.json`;
  try{
    const raw=await nativeFetchText(manifestUrl),manifest=JSON.parse(String(raw||'{}'));if(manifest?.version){androidLatestManifest=manifest;const latest=String(manifest.version||'0.0.0');
      if(compareVersions(latest,current)>0){androidAppUpdateAvailable={version:latest,versionCode:Number(manifest.versionCode||0),url:String(manifest.updateUrl||`https://github.com/${repo}/releases/download/${ANDROID_UPDATE_RELEASE_TAG}/Swoop-TV-v0.8.1-Google-TV-Test.apk`)};toast(`Swoop TV v${latest} is available · Downloader 3682231`);if(state.page==='settings'&&!modal&&!profilePickerOpen)render();return androidAppUpdateAvailable;}
      androidAppUpdateAvailable=null;return null;}
  }catch{}
  // Compatibility fallback for an older test release that does not yet publish the manifest.
  try{
    const response=await fetch(`https://api.github.com/repos/${repo}/releases/tags/${ANDROID_UPDATE_RELEASE_TAG}`,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});if(!response.ok)return null;
    const release=await response.json(),names=[String(release?.name||''),...(Array.isArray(release?.assets)?release.assets.map(x=>String(x?.name||'')):[])].join(' '),found=[...names.matchAll(/v(\d+\.\d+\.\d+)/gi)].map(m=>m[1]);if(!found.length)return null;
    found.sort(compareVersions);const latest=found[found.length-1];if(compareVersions(latest,current)<=0){androidAppUpdateAvailable=null;return null}
    androidAppUpdateAvailable={version:latest,url:`https://github.com/${repo}/releases/download/${ANDROID_UPDATE_RELEASE_TAG}/Swoop-TV-v0.8.1-Google-TV-Test.apk`};return androidAppUpdateAvailable;
  }catch{return null}
}
function maybeShowWhatsNewOnLogin(){
  if(!NATIVE_ANDROID||profilePickerOpen||modal)return false;let current=ANDROID_CURRENT_VERSION;try{current=String(globalThis.SwoopAndroid?.version?.()||ANDROID_CURRENT_VERSION)}catch{}
  if(String(state.settings.lastWhatsNewVersion||'')===current)return false;
  if(!androidLatestManifest||String(androidLatestManifest.version||'')!==current)androidLatestManifest={version:current,changes:[...ANDROID_CURRENT_CHANGELOG]};
  modal='whatsNew';render();return true;
}
async function checkAndroidProvidersOnLaunch(){
  if(!NATIVE_ANDROID||androidProviderLaunchCheckRunning)return null;
  androidProviderLaunchCheckRunning=true;
  try{
    const providers=enabledProviders().filter(providerCanRefreshOnLaunch);
    if(!providers.length)return null;
    const dueIds=new Set(androidProvidersDueForRefresh().map(p=>p.id));
    let refreshed=0,checked=0,failed=0;
    // Every launch performs a lightweight provider-account check first. This keeps expiry/auth
    // current without forcing a full playlist download just to open Swoop TV.
    for(const provider of providers){
      const cfg=providerConfigById(provider.id)||{};
      if(provider.type==='xtream'){
        try{
          const auth=await testXtream(cfg);checked++;
          const expiresAt=providerExpiryFromProfile(auth),expiryNever=!expiresAt&&String(auth?.user_info?.exp_date??'').trim()==='0';
          Object.assign(provider,{status:String(auth?.user_info?.auth)==='0'?'error':'connected',lastError:String(auth?.user_info?.auth)==='0'?'Xtream account is not authorised.':'',expiresAt,expiryNever,lastChecked:Date.now()});
          const saved=savedProviderProfiles.find(x=>providerProfileId(x)===provider.id);if(saved){Object.assign(saved,{expiresAt,expiryNever,lastChecked:provider.lastChecked});saveProviderProfiles(savedProviderProfiles)}
        }catch{failed++}
      }
      await new Promise(r=>setTimeout(r,0));
    }
    // A full catalogue refresh is age-based and happens after Home is already usable. The old
    // catalogue remains on screen until the replacement is complete, so launch never blocks.
    let catalogChanged=false;
    for(const provider of providers){
      if(!dueIds.has(provider.id))continue;
      const success=await refreshProvider(provider.id,{quiet:true,manageTask:false,deferPersist:true});
      if(success){refreshed++;catalogChanged=true}else failed++;
      await new Promise(r=>setTimeout(r,0));
    }
    if(catalogChanged){
      await prepareAndroidEpgBeforeEntry().catch(()=>({providers:0,matched:0,programmes:0,failed:0}));
      await persist(true).catch(()=>false);
      scheduleTvHomeSnapshotSave(1200);
      clearAndroidPreparedHome();androidPreparedHomeReady=false;
      // Do not force a render while the customer is navigating. New catalogue data is picked up
      // on the next natural route/row render, while the current completed frame remains stable.
      if(state.page==='settings'&&!modal&&!profilePickerOpen)render();
    }else if(checked){await persist().catch(()=>false)}
    return {checked,refreshed,failed};
  }finally{androidProviderLaunchCheckRunning=false}
}
function scheduleAndroidLaunchChecks(){
  if(!NATIVE_ANDROID||androidLaunchChecksScheduled)return;
  androidLaunchChecksScheduled=true;
  const runVersion=async()=>{if(androidLaunchChecksRunning)return;androidLaunchChecksRunning=true;try{await checkAndroidAppUpdateOnLaunch()}finally{androidLaunchChecksRunning=false}};
  const runDiscovery=async()=>{try{await ensureTvCatalogWorkerReady(45000);await refreshDiscoveryRows(false,false,null,['top20-movies','top20-shows'])}catch{}};
  const runProviders=()=>checkAndroidProvidersOnLaunch().catch(()=>null);
  setTimeout(()=>{if('requestIdleCallback'in window)requestIdleCallback(()=>runVersion(),{timeout:5000});else setTimeout(runVersion,0)},2400);
  // The two ranked Home feeds refresh behind the initial interaction window and use the catalogue
  // worker, so current-trend matching never competes with remote navigation on the UI thread.
  setTimeout(()=>{if('requestIdleCallback'in window)requestIdleCallback(()=>runDiscovery(),{timeout:9000});else setTimeout(runDiscovery,0)},4200);
  // Provider checks deliberately start later than the app-version/discovery checks so Home and
  // remote input have first priority. A stale provider may refresh in the background, never behind a gate.
  setTimeout(()=>{if('requestIdleCallback'in window)requestIdleCallback(()=>runProviders(),{timeout:9000});else setTimeout(runProviders,0)},7600);
}

function restoringPage(){
  return `<main class="page restoring-page"><div class="restore-card"><img class="startup-swoop-logo" src="./assets/swoop-tv-logo-transparent.png" alt="Swoop TV" /><div class="provider-spinner" aria-hidden="true"></div><div class="eyebrow">RESTORING SWOOP TV</div><h1>Loading your TV library…</h1><p id="restoreProgressText">Swoop TV is loading your channels, movies and TV shows.</p><div class="restore-progress"><div><span id="restoreProgressCount">Loading your library…</span><strong id="restoreProgressPercent">4%</strong></div><i><b id="restoreProgressBar" style="width:4%"></b></i></div><small>Your library will open as soon as it is ready.</small></div></main>`;
}
function updateRestoreProgress(info={}){
  const bar=document.querySelector('#restoreProgressBar'),count=document.querySelector('#restoreProgressCount'),text=document.querySelector('#restoreProgressText'),percent=document.querySelector('#restoreProgressPercent');
  const total=Math.max(1,Number(info.total||0)),loaded=Math.max(0,Number(info.loaded||0)),pct=info.phase==='finishing'?96:Math.min(92,8+(loaded/total)*82),shown=Math.round(pct);
  if(bar)bar.style.width=`${pct}%`;if(percent)percent.textContent=`${shown}%`;
  if(count)count.textContent=info.items?`${Number(info.items).toLocaleString()} library items ready`:'Preparing your library…';
  if(text)text.textContent=info.phase==='finishing'?'Finishing your library…':'Loading channels, movies and TV shows…';
}

function backgroundLiveBar(){
  if(!(playerItem?.kind==='live'&&playerUiHidden))return'';const item=visualItem(playerItem),p=currentProgramme(item),q=qualityLabel(item);
  return `<div class="background-live-bar"><div class="background-live-pulse"></div>${item.logo?`<img data-swoop-art="${esc(item.logo)}" alt="">`:''}<div class="background-live-copy"><span>LIVE NOW ${q?`· ${esc(q)}`:''}</span><strong>${esc(item.name)}</strong><small>${p?esc(p.title):esc(item.group||'Live TV')}</small></div><button class="btn secondary compact-btn" data-live-controls>Open Controls</button><button class="btn danger compact-btn" data-live-stop>Stop</button></div>`;
}
function render(){
  if(NATIVE_ANDROID){tvDiagRecord('render',{page:state.page,modal:modal||''});rememberTvFocus();if(profilePickerOpen||state.page!=='home')tvHomeExpansionToken++;}
  if(NATIVE_ANDROID&&modal){tvVerticalQueue=0;if(tvVerticalFrame){cancelAnimationFrame(tvVerticalFrame);tvVerticalFrame=0}}
  document.documentElement.classList.toggle('tv-modal-open',Boolean(NATIVE_ANDROID&&modal));
  applyTheme();
  const oldDetailScroll=document.querySelector('.detail-scroll')?.scrollTop;
  if(Number.isFinite(oldDetailScroll))detailScrollTop=oldDetailScroll;
  const oldPersonScroll=document.querySelector('.person-scroll')?.scrollTop;
  if(Number.isFinite(oldPersonScroll))personScrollTop=oldPersonScroll;
  artworkObserver?.disconnect?.();artworkObserver=null;visibleMetadataObserver?.disconnect?.();visibleMetadataObserver=null;
  const personRoute=Boolean(!profilePickerOpen&&personView);
  const detailRoute=Boolean(!profilePickerOpen&&!personRoute&&detailItem);
  const mediaRoute=personRoute||detailRoute;
  let body;
  if(startupRefreshActive)body=startupRefreshPage();
  else if(storageRestoring&&!NATIVE_ANDROID)body=restoringPage();
  else if(profilePickerOpen)body=profilePickerPage();
  else if(personRoute)body=personHtml();
  else if(detailRoute)body=detailHtml();
  else if(state.page==='home')body=home();
  else if(state.page==='live')body=livePage();
  else if(state.page==='guide')body=guidePage();
  else if(state.page==='starmeter')body=starmeterPage();
  else if(state.page==='movies')body=mediaCategoryPage('movie','Movies');
  else if(state.page==='series')body=mediaCategoryPage('series','TV Shows');
  else if(state.page==='myswoop'||state.page==='mylist')body=mySwoopPage();
  else if(state.page==='search')body=searchPage();
  else body=settingsPage();
  const shellNav=startupRefreshActive||storageRestoring||profilePickerOpen||mediaRoute?'':nav();
  $app.innerHTML=`<div class="app-shell">${shellNav}${body}${modal?modalHtml():''}${!profilePickerOpen&&sourceChoiceItem?sourceChoiceHtml():''}${!profilePickerOpen&&playerItem&&!playerUiHidden?playerHtml():''}${!profilePickerOpen&&!mediaRoute?backgroundLiveBar():''}${!profilePickerOpen&&trailerKey?trailerHtml():''}${taskProgressHtml()}</div>`;
  if(detailRoute){const scroller=document.querySelector('.detail-scroll');if(scroller)scroller.scrollTop=detailScrollTop;}
  if(personRoute){const scroller=document.querySelector('.person-scroll');if(scroller)scroller.scrollTop=personScrollTop;}
  bind();bindHeroControls(document);
  if(NATIVE_ANDROID){if(profilePickerOpen)requestAnimationFrame(focusDefaultProfileChoice);else restoreTvFocus();ensureTvHardwareOverlay();}
  if(!profilePickerOpen&&!mediaRoute&&state.page==='search')runSearch('');
  if(!profilePickerOpen&&!mediaRoute&&state.page==='starmeter'){if(!starmeterBackgroundReady)setTimeout(()=>prepareStarmeterBeforeLogin().catch(()=>false),0);else setTimeout(()=>{setupStarmeterAutoLoad();prewarmPreparedStarmeterArtwork()},0)}
  if(!profilePickerOpen&&!mediaRoute&&state.page==='live')setTimeout(setupLiveCategoryAutoLoad,0)
  if(detailRoute&&detailItem?.kind==='series'&&!detailLoading)setTimeout(prewarmSelectedEpisodeMetadata,0);
  hydrateArtwork();
  if(!profilePickerOpen&&!mediaRoute&&state.page==='guide')setTimeout(async()=>{const changed=await ensureGuideProviderCategoryOrder().catch(()=>false);if(changed&&state.page==='guide'&&!mediaRoute){render();return}loadGuideEpg()},0);
  if(!profilePickerOpen&&!mediaRoute&&state.page==='live')setTimeout(async()=>{const changed=await ensureGuideProviderCategoryOrder().catch(()=>false);if(changed&&state.page==='live'&&!detailItem&&!personView){render();return}primeLiveCategoryRails();const leadId=document.querySelector('.live-hub-hero [data-play]')?.dataset?.play,lead=leadId?savedItem(leadId):null;if(lead)scheduleLiveHeroPreview(lead,850)},0);
  if(!profilePickerOpen&&!mediaRoute&&state.page==='movies')setTimeout(async()=>{const changed=await ensureMediaProviderCategoryOrder('movie').catch(()=>false);if(changed&&state.page==='movies'&&!detailItem&&!personView){render();return}primeMediaCategoryRails('movie')},0);
  if(!profilePickerOpen&&!mediaRoute&&state.page==='series')setTimeout(async()=>{const changed=await ensureMediaProviderCategoryOrder('series').catch(()=>false);if(changed&&state.page==='series'&&!detailItem&&!personView){render();return}primeMediaCategoryRails('series')},0);
  if(!profilePickerOpen&&!mediaRoute&&state.page==='home'){
    mountLazyHomeRows(document);if(NATIVE_ANDROID){/* All launch-critical TV work is completed before Home. No automatic post-Home expansion/prewarm. */}
    // Browser/desktop can enrich the hero immediately. Google TV enters Home with a fully
    // prepared frame and defers optional metadata work so remote input always wins.
    const heroNow=featureItem();if(!NATIVE_ANDROID&&heroNow&&['movie','series'].includes(heroNow.kind))setTimeout(()=>enrichItemMetadata(heroNow,{rerender:false}).then(()=>patchHomeHeroTitle(heroNow)),40);
    if(state.catalog.length&&!androidFastHomeMode()&&!NATIVE_ANDROID)setTimeout(()=>refreshDiscoveryRows(false),largeLibraryMode()?1200:0);
    if(nativeCatalogMode)setTimeout(primeNativeHomeRows,140);if(NATIVE_ANDROID)setTimeout(scheduleAndroidDestinationPrewarm,650);
    if(!androidFastHomeMode()&&!NATIVE_ANDROID)scheduleBrowseWarmup(largeLibraryMode()?650:1000);
  }
  if(!profilePickerOpen&&!mediaRoute&&playerItem?.kind==='live')setTimeout(()=>{loadPlayerNowNext(playerItem);loadLiveMiniGuide(playerItem)},0);
  if(!profilePickerOpen&&state.catalog.length&&!NATIVE_ANDROID)setTimeout(scheduleMetadataEnrichment,androidFastHomeMode()?5000:(largeLibraryMode()?1800:120));
  if(NATIVE_ANDROID&&tvForceHomeTop&&!profilePickerOpen&&!mediaRoute&&state.page==='home')forceAndroidHomeEntry();
  if(!mediaRoute)scheduleHeroRotation();
}

function providerModal(){
  const xtreamSaved=savedProviderProfiles.find(p=>p.type==='xtream')||{};
  const m3uSaved=savedProviderProfiles.find(p=>p.type==='m3u')||{};
  syncProviderCounts();
  const providers=state.providers.slice().sort((a,b)=>Number(a.priority)-Number(b.priority));
  const providerCards=providers.length?`<section class="provider-manager-list"><div class="provider-manager-title"><div><span class="eyebrow">YOUR PROVIDERS</span><h3>${providers.length} connected provider${providers.length===1?'':'s'}</h3><p>Manage your connected TV providers.</p></div><button class="btn secondary compact-btn" data-provider-refresh-all ${providers.some(x=>x.status==='refreshing')?'disabled':''}>↻ Refresh All</button></div>${providers.map((p,index)=>{const c=p.counts||providerCatalogCounts(p.id),profile=providerConfigById(p.id),saved=Boolean(profile?.username||profile?.url),status=p.status==='error'?'Needs attention':p.status==='refreshing'?'Refreshing…':p.enabled===false?'Disabled':'Connected',refreshPct=Math.max(0,Math.min(100,Number(p.refreshProgress||0))),refreshDetail=p.refreshDetail||'Updating your library…';return `<article class="provider-manager-card ${p.enabled===false?'disabled':''}" data-provider-card="${esc(p.id)}"><div class="provider-manager-rank"><strong>${index+1}</strong><span>PRIORITY</span></div><div class="provider-manager-main"><div class="provider-manager-head"><div><span class="provider-type-badge">${p.type==='xtream'?'XTREAM':'M3U'}</span><h4>${esc(p.name||'TV Provider')}</h4><small>${esc(p.type==='xtream'?(p.server||'Xtream provider'):(p.url||'Local M3U playlist'))}</small><small class="provider-last-refresh" data-provider-status-copy>${esc(providerStatusCopy(p))}</small></div><span class="provider-health ${p.status==='error'?'error':p.enabled===false?'off':'ok'}" data-provider-health>${esc(status)}</span></div><div class="provider-manager-stats"><span><b>${Number(c.live||0).toLocaleString()}</b> Live</span><span><b>${Number(c.movie||0).toLocaleString()}</b> Movies</span><span><b>${Number(c.series||0).toLocaleString()}</b> Shows</span><span><b>${saved?'✓':'—'}</b> Login saved</span><span><b>${esc(providerExpiryLabel(p))}</b> Expiry</span></div><div class="provider-inline-progress" data-provider-inline-progress ${p.status==='refreshing'?'':'hidden'}><div><span data-provider-progress-detail>${esc(refreshDetail)}</span><strong data-provider-progress-percent>${Math.round(refreshPct)}%</strong></div><i><b data-provider-progress-bar style="width:${refreshPct}%"></b></i><small>Keep Swoop TV open while this finishes.</small></div><div class="provider-manager-actions"><button class="btn secondary compact-btn" data-provider-toggle="${esc(p.id)}" ${p.status==='refreshing'?'disabled':''}>${p.enabled===false?'Enable':'Disable'}</button><button class="btn secondary compact-btn" data-provider-refresh="${esc(p.id)}" ${p.status==='refreshing'?'disabled':''}>↻ ${p.status==='refreshing'?'Refreshing…':'Refresh'}</button><button class="btn secondary compact-btn" data-provider-edit="${esc(p.id)}" ${p.status==='refreshing'?'disabled':''}>Edit</button><button class="provider-priority-btn" data-provider-up="${esc(p.id)}" ${index===0||p.status==='refreshing'?'disabled':''}>↑</button><button class="provider-priority-btn" data-provider-down="${esc(p.id)}" ${index===providers.length-1||p.status==='refreshing'?'disabled':''}>↓</button><button class="btn danger compact-btn" data-provider-remove="${esc(p.id)}" ${p.status==='refreshing'?'disabled':''}>Remove</button></div></div></article>`}).join('')}</section>`:`<section class="provider-manager-empty"><div class="empty-mark">S</div><h3>No providers connected</h3><p>Connect an Xtream Codes or M3U provider.</p></section>`;
  const helper=NATIVE_PLAYBACK?`<div class="provider-note native-note"><div class="provider-note-icon">✓</div><div><strong>Connection ready</strong><span>Swoop TV can connect directly to this provider.</span></div></div>`:`<details class="helper-box compact-helper"><summary>Connection Helper <span>only if direct login fails</span></summary><div class="helper-body"><p class="form-hint">Use a Connection Helper only if your provider requires it.</p><div class="field"><label>Connection Helper URL</label><input name="relayUrl" type="url" value="${esc(state.settings.xtreamRelayUrl||xtreamSaved.relayUrl||'')}" placeholder="https://your-worker.workers.dev"></div><div class="field"><label>Helper token</label><input name="relayToken" type="password" value="${esc(state.settings.xtreamRelayToken||xtreamSaved.relayToken||'')}" autocomplete="off" placeholder="SWOOP_PROXY_TOKEN"></div></div></details>`;
  return `<div class="modal-backdrop" data-close-modal><div class="modal provider-modal multi-provider-modal" data-modal-card><div class="modal-head provider-modal-head"><div><div class="eyebrow">TV PROVIDERS</div><h2>Provider Manager</h2><p>Add, update or remove your TV providers.</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div><div class="modal-body provider-modal-body">${providerCards}<div id="providerSetup"><section class="provider-add-section"><div class="provider-add-heading"><span class="eyebrow">ADD ANOTHER PROVIDER</span><h3>Connect a TV service</h3><p>Add another provider to your Swoop TV library.</p></div><div class="provider-methods" aria-label="Provider type"><button type="button" class="provider-method active" data-provider-tab="xtream"><span class="provider-method-icon">X</span><span><strong>Xtream Codes</strong><small>Server URL + username + password</small></span><span class="provider-method-check">✓</span></button><button type="button" class="provider-method" data-provider-tab="m3u"><span class="provider-method-icon">M3U</span><span><strong>M3U Playlist</strong><small>Playlist URL or local M3U file</small></span><span class="provider-method-check">✓</span></button></div>
    <form id="xtreamForm" class="provider-form"><div class="provider-form-intro"><div><div class="eyebrow">XTREAM CODES</div><h3>Add Xtream provider</h3><p>Enter the same Xtream details you use in another IPTV player.</p></div><span class="provider-badge">Recommended</span></div><div class="field"><label>Provider name</label><input name="name" value="" placeholder="e.g. Main TV" required></div><div class="field"><label>Server URL</label><input name="server" type="url" value="" placeholder="http://provider.example:port" required></div><div class="split"><div class="field"><label>Username</label><input name="username" value="" autocomplete="username" required></div><div class="field"><label>Password</label><input name="password" type="password" value="" autocomplete="current-password" required></div></div>${helper}<label class="remember-row provider-remember"><input type="checkbox" name="remember" checked><span><strong>Keep this provider signed in on this device</strong><small>Keeps this provider available after you restart Swoop TV.</small></span></label><button class="btn accent provider-primary" type="submit"><span>Add Xtream Provider</span><span>→</span></button></form>
    <form id="m3uForm" class="provider-form" hidden><div class="provider-form-intro"><div><div class="eyebrow">M3U PLAYLIST</div><h3>Add M3U provider</h3><p>Use either a playlist URL or a local M3U/M3U8 file.</p></div></div><div class="field"><label>Provider name</label><input name="name" value="" placeholder="e.g. Backup TV" required></div><div class="field"><label>M3U playlist URL</label><input name="url" type="url" value="" placeholder="http://provider.example/get.php?... "></div><div class="provider-or"><span>or</span></div><div class="field"><label>Choose M3U file</label><input name="file" type="file" accept=".m3u,.m3u8,text/plain,application/x-mpegURL"></div><div class="field"><label>TV guide / XMLTV URL <span class="optional">Optional</span></label><input name="epgUrl" type="url" value="" placeholder="http://provider.example/epg.xml"></div><div class="provider-note"><div class="provider-note-icon">i</div><div><strong>${NATIVE_PLAYBACK?'Playlist URL':'Playlist import'}</strong><span>${NATIVE_PLAYBACK?'Enter a playlist URL or choose a file.':'Choose a file, or enter a playlist URL if your provider supports it.'}</span></div></div><label class="remember-row provider-remember"><input type="checkbox" name="remember" checked><span><strong>Remember this playlist on this device</strong><small>Keeps this playlist available after you restart Swoop TV.</small></span></label><button class="btn accent provider-primary" type="submit"><span>Add M3U Provider</span><span>→</span></button></form></section></div>
    <section id="providerProgress" class="provider-progress" hidden aria-live="polite" aria-busy="true"><div class="provider-progress-top"><div class="provider-spinner" aria-hidden="true"></div><div><div id="providerProgressKicker" class="eyebrow">PLEASE WAIT</div><h3 id="providerProgressTitle">Connecting to your provider…</h3><p id="providerProgressDetail">Swoop TV is preparing your TV library. Keep this window open.</p></div></div><div class="provider-progress-meter"><span>Progress</span><strong id="providerProgressPercent">5%</strong></div><div class="provider-progress-bar"><span id="providerProgressBar"></span></div><div id="providerProgressSteps" class="provider-progress-steps"></div><div id="providerProgressSummary" class="provider-progress-summary"></div><div class="provider-progress-actions"><button type="button" class="btn accent" data-provider-progress-open hidden>Open Swoop TV</button><button type="button" class="btn secondary" data-provider-progress-back hidden>Back to details</button></div></section><div id="providerStatus" aria-live="polite"></div></div></div></div>`;
}
function mdblistModal(){return `<div class="modal-backdrop" data-close-modal><div class="modal" data-modal-card><div class="modal-head"><h2>Add MDBList Row</h2><button class="icon-btn" data-close>✕</button></div><div class="modal-body"><form id="mdblistForm" class="form-grid"><div class="field"><label>Row name in Swoop TV</label><input name="rowName" value="My MDBList" required></div><div class="field"><label>MDBList API key</label><input name="apiKey" type="password" value="${esc(state.settings.mdblistApiKey||'')}" required></div><div class="field"><label>List ID</label><input name="listId" placeholder="e.g. 12345"></div><div class="divider"></div><p class="form-hint">Or identify the list by username + list slug/name.</p><div class="split"><div class="field"><label>Username</label><input name="username" placeholder="username"></div><div class="field"><label>List name / slug</label><input name="listName" placeholder="best-action-movies"></div></div><button class="btn accent" type="submit">Add to Home</button></form><div id="mdbStatus"></div></div></div></div>`}
function homeRowsModal(){
  const selected=new Set(state.settings.homeRows),defs=allHomeRowDefs(),groups=[...new Set(defs.map(x=>x.group))];
  const lastWeb=Math.max(0,...Object.values(state.webDiscovery||{}).map(x=>Number(x?.updatedAt||0)),...state.mdblistRows.map(x=>Number(x.updatedAt||0)));
  const feature=visualItem(featureItem()),featureArt=feature?(feature.backdrop||feature.logo):'',theme=currentTheme(),bg=state.settings.backgroundOverride?validHex(state.settings.backgroundColor):theme.bg;
  return `<div class="modal-backdrop" data-close-modal><div class="modal home-rows-modal" data-modal-card><div class="modal-head home-rows-head"><div><div class="eyebrow">HOME SCREEN</div><h2>Customize ${esc(activeProfile()?.name||'Swoop TV')}</h2><p>Pick a complete Swoop TV theme, then choose this profile’s Home rows and optional colour override.</p></div><button class="icon-btn" data-close>✕</button></div><div class="modal-body home-rows-body">
  <section class="theme-studio-card"><div class="theme-studio-copy"><span class="eyebrow">PROFILE THEME</span><h3>${esc(theme.name)}</h3><p>${esc(theme.description)}</p></div><div class="theme-picker-grid active-theme-picker">${SWOOP_THEMES.map(t=>`<button type="button" class="theme-choice ${t.id===theme.id?'active':''}" data-active-theme="${esc(t.id)}"><span class="theme-swatch" style="--theme-swatch:${esc(t.swatch)}"><i></i><b>${esc(t.name)}</b></span><span><strong>${esc(t.name)}</strong><small>${esc(t.tagline)}</small></span></button>`).join('')}</div></section>
  <section class="home-look-card theme-preview-${esc(theme.id)}" style="--preview-bg:${esc(bg)}"><div class="home-look-preview">${featureArt?`<img data-swoop-art="${esc(featureArt)}" alt="">`:''}<div class="home-look-shade"></div><div class="home-look-copy"><span class="eyebrow">${esc(theme.name.toUpperCase())} PREVIEW</span><strong>${esc(feature?.name||'Your featured title')}</strong><small>${esc(theme.tagline)} · ${state.settings.backgroundOverride?'Custom background':'Theme background'}</small></div></div><div class="home-look-controls"><span class="eyebrow">ADVANCED APPEARANCE</span><h3>Background colour override</h3><p>Each theme has its own base palette. Turn this on only when you want a custom background behind that theme.</p><label class="remember-row theme-bg-toggle"><input type="checkbox" data-bg-override ${state.settings.backgroundOverride?'checked':''}><span><strong>Use a custom background colour</strong><small>Saved only to ${esc(activeProfile()?.name||'this profile')}.</small></span></label><div class="colour-row ${state.settings.backgroundOverride?'':'disabled'}"><input id="homeBgColor" type="color" value="${esc(bg)}" aria-label="Background colour" ${state.settings.backgroundOverride?'':'disabled'}><input id="homeBgHex" type="text" value="${esc(bg)}" maxlength="7" aria-label="Background hex colour" ${state.settings.backgroundOverride?'':'disabled'}><button type="button" class="btn secondary compact-btn" data-bg-reset>Use ${esc(theme.name)} default</button></div><label class="remember-row smart-home-toggle"><input type="checkbox" data-smart-home-toggle ${state.settings.smartHomeOrder!==false?'checked':''}><span><strong>Smart Home ordering for ${esc(activeProfile()?.name||'this profile')}</strong><small>Let viewing history move relevant rows higher while Continue Watching and both Top 100 rows stay pinned at the top. Your selected rows remain under your control.</small></span></label></div></section>
  <section class="discovery-key-card"><div><span class="eyebrow">SWOOP TV DISCOVERY</span><h3>Discovery</h3><p>Built-in discovery works automatically. Add an MDBList key only if you want to create your own custom list rows.</p></div><form id="homeDiscoveryForm"><div class="field"><label>Custom MDBList API key <span class="optional">Optional</span></label><input name="apiKey" type="password" value="${esc(state.settings.mdblistApiKey||'')}" placeholder="Only needed for your own MDBList rows"></div><div class="discovery-key-actions"><button class="btn accent" type="submit">Save Custom Key</button><button class="btn secondary" type="button" data-refresh-discovery>Refresh discovery now</button></div><small>${discoveryRefreshing?'Updating…':'Ready'}</small></form></section>
  <div class="home-row-toolbar"><div><strong>${state.settings.homeRows.length} rows selected</strong><span>Top 100 Movies and Top 100 TV Shows are pinned first. Curated discovery rows keep their default order, while Recommended For You stays at the bottom. Continue Watching and saved titles now live in My SwoopTV. ${state.settings.smartHomeOrder!==false?'Smart ordering only personalises any additional optional rows.':'Use ↑ ↓ to control additional optional rows.'}</span></div><div><button class="btn secondary compact-btn" data-modal="mdblist">＋ Custom MDBList Row</button><button class="btn secondary compact-btn" data-reset-home>Reset defaults</button></div></div>
  <div class="home-row-picker">${groups.map(group=>`<section class="home-row-group"><div class="home-row-group-title"><span>${esc(group)}</span></div>${defs.filter(x=>x.group===group).map(def=>{const pinned=PINNED_HOME_ROWS.includes(def.id),on=pinned||selected.has(def.id),index=state.settings.homeRows.indexOf(def.id),data=homeRowItems(def.id),cache=state.webDiscovery?.[def.id],err=cache?.error||(def.custom?state.mdblistRows.find(r=>`custom:${r.uid}`===def.id)?.error:'');return `<div class="home-row-option ${on?'selected':''} ${pinned?'pinned':''}"><button class="home-row-toggle" ${pinned?'disabled':`data-home-toggle="${esc(def.id)}"`} aria-pressed="${on?'true':'false'}"><span class="home-row-check">${pinned?'PIN':on?'✓':'＋'}</span><span><strong>${esc(def.label)}</strong><small>${pinned?'Pinned at the top of Home · ':''}${esc(def.description||`${data.length.toLocaleString()} items currently available`)}</small>${err?`<em>${esc(err)}</em>`:''}</span></button><div class="home-row-order">${on&&!pinned?`<button data-home-up="${esc(def.id)}" ${index<=PINNED_HOME_ROWS.length?'disabled':''} aria-label="Move ${esc(def.label)} up">↑</button><button data-home-down="${esc(def.id)}" ${index<0||index>=state.settings.homeRows.length-1?'disabled':''} aria-label="Move ${esc(def.label)} down">↓</button>`:''}</div></div>`}).join('')}</section>`).join('')}</div>
  <div class="home-row-footer"><span>Theme, rows and background are stored independently for this profile.</span><button class="btn accent" data-close>Done</button></div>
  </div></div></div>`;
}
function continueOptionsModal(){
  const target=continueOptionsTarget||{},item=savedItem(target.id)||state.continueWatching.find(x=>String(x?.id||'')===String(target.id||''))?.item;
  if(!item)return `<div class="modal-backdrop" data-close-modal><div class="modal continue-options-modal" data-modal-card><div class="modal-body"><h2>More options</h2><button class="btn secondary" data-close>Close</button></div></div></div>`;
  const title=cleanDisplayTitle({name:item._continueSeriesTitle||item.name||'Continue Watching'});
  return `<div class="modal-backdrop" data-close-modal><div class="modal continue-options-modal" data-modal-card><div class="modal-head"><div><div class="eyebrow">CONTINUE WATCHING</div><h2>${esc(title)}</h2><p>Choose an action for this title.</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div><div class="modal-body continue-options-body"><button class="btn accent" data-continue-resume="${esc(item.id)}">▶ Resume / Open</button><button class="btn secondary" data-remove-continue="${esc(target.id||item.id)}" data-remove-continue-series="${esc(target.seriesId||item.parentSeriesId||'')}">✕ Remove from Continue Watching</button></div></div></div>`;
}
function whatsNewModal(){
  const entries=(androidLatestManifest?.changes||[]).slice(0,12);
  return `<div class="modal-backdrop whats-new-backdrop" data-close-modal><div class="modal whats-new-modal" data-modal-card role="dialog" aria-modal="true" aria-labelledby="whatsNewTitle"><div class="modal-head"><div><div class="eyebrow">WHAT'S NEW</div><h2 id="whatsNewTitle">Swoop TV v${esc(ANDROID_CURRENT_VERSION)}</h2><p>Hardware consolidation, stability and physical-TV navigation fixes.</p></div><button class="icon-btn" data-close aria-label="Close">✕</button></div><div class="modal-body whats-new-body">${entries.length?`<ul>${entries.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<ul><li>Faster, deterministic D-pad navigation.</li><li>Continuous 100-title browsing with ahead-of-focus loading.</li><li>Compact heroes, persistent navigation and cleaner Live TV/Guide presentation.</li><li>Long-press OK options for Continue Watching.</li><li>Faster actor/person catalogue opening.</li></ul>`}<div class="cta-row"><button class="btn accent" data-whats-new-done autofocus>Got it</button></div></div></div></div>`;
}
function modalHtml(){if(modal==='provider')return providerModal();if(modal==='homeRows')return homeRowsModal();if(modal==='profiles')return profilesModal();if(modal==='profileEdit')return profileEditorModal();if(modal==='pin')return pinModal();if(modal==='continueOptions')return continueOptionsModal();if(modal==='whatsNew')return whatsNewModal();return mdblistModal()}
function setStatus(id,msg,type='info'){const el=document.querySelector(id);if(el)el.innerHTML=`<div class="status ${type}">${esc(msg)}</div>`}
function providerProgressStart(kind,providerName){clearTimeout(providerCompletionTimer);providerCompletionTimer=null;const setup=document.querySelector('#providerSetup'),panel=document.querySelector('#providerProgress'),status=document.querySelector('#providerStatus'),open=document.querySelector('[data-provider-progress-open]');if(setup)setup.hidden=true;if(panel){panel.hidden=false;panel.setAttribute('aria-busy','true')}if(open)open.hidden=true;if(status)status.innerHTML='';const steps=kind==='xtream'?[['contact','Contacting provider'],['auth','Verifying Xtream login'],['live','Loading Live TV'],['movie','Loading Movies'],['series','Loading TV Shows'],['save','Building Swoop TV library']]:[['read','Reading playlist'],['parse','Parsing channels'],['save','Building Swoop TV library']];const box=document.querySelector('#providerProgressSteps');if(box)box.innerHTML=steps.map(([id,label],i)=>`<div class="provider-progress-step" data-progress-step="${id}"><span class="step-indicator">${i+1}</span><span>${esc(label)}</span><strong></strong></div>`).join('');const title=document.querySelector('#providerProgressTitle');if(title)title.textContent=`Connecting to ${providerName||'your provider'}…`;const detail=document.querySelector('#providerProgressDetail');if(detail)detail.textContent=kind==='xtream'?'Loading Live TV, Movies and TV Shows.':'Loading your playlist.';const summary=document.querySelector('#providerProgressSummary');if(summary)summary.innerHTML='<strong>Connecting…</strong> Keep Swoop TV open while this finishes.';providerProgressUpdate({step:steps[0][0],progress:5})}
function providerProgressUpdate({step='',progress=0,title='',detail='',stepDetail='',done=false,error=false}={}){const value=Math.max(0,Math.min(100,Number(progress)||0)),bar=document.querySelector('#providerProgressBar'),percent=document.querySelector('#providerProgressPercent');if(bar)bar.style.width=`${value}%`;if(percent)percent.textContent=`${Math.round(value)}%`;if(title){const el=document.querySelector('#providerProgressTitle');if(el)el.textContent=title}if(detail){const el=document.querySelector('#providerProgressDetail');if(el)el.textContent=detail}document.querySelectorAll('[data-progress-step]').forEach(el=>{const active=el.dataset.progressStep===step;if(active)el.classList.add('active');else el.classList.remove('active');if(done&&!error)el.classList.add('done')});if(step){const active=document.querySelector(`[data-progress-step="${step}"]`);if(active){active.classList.add(error?'error':'active');const strong=active.querySelector('strong');if(strong&&stepDetail)strong.textContent=stepDetail}}}
function providerProgressMark(step,detail=''){const el=document.querySelector(`[data-progress-step="${step}"]`);if(el){el.classList.remove('active');el.classList.add('done');const indicator=el.querySelector('.step-indicator');if(indicator)indicator.textContent='✓';const strong=el.querySelector('strong');if(strong)strong.textContent=detail}}
let providerCompletionTimer=null;
function finishProviderSetup(){
  clearTimeout(providerCompletionTimer);providerCompletionTimer=null;
  const panel=document.querySelector('#providerProgress');if(panel)panel.setAttribute('aria-busy','false');
  modal=null;profilePickerOpen=false;startupRefreshActive=false;storageRestoring=false;state.page='home';tvForceHomeTop=true;
  try{window.scrollTo(0,0)}catch{}
  render();
  if(NATIVE_ANDROID)requestAnimationFrame(()=>{forceAndroidHomeEntry();const target=document.querySelector('[data-page="home"]')||tvFocusableElements()[0];target?.focus?.({preventScroll:true})});
}
function providerProgressSuccess(message){providerProgressUpdate({progress:100,title:'Your library is ready',detail:message});document.querySelectorAll('[data-progress-step]').forEach(el=>{el.classList.remove('active');el.classList.add('done');const i=el.querySelector('.step-indicator');if(i)i.textContent='✓'});const kicker=document.querySelector('#providerProgressKicker');if(kicker)kicker.textContent='CONNECTED';const spinner=document.querySelector('.provider-spinner');if(spinner){spinner.classList.add('success');spinner.textContent='✓'}const summary=document.querySelector('#providerProgressSummary');if(summary)summary.innerHTML='<strong>Done.</strong> Opening Swoop TV…';const panel=document.querySelector('#providerProgress');if(panel)panel.setAttribute('aria-busy','false');const open=document.querySelector('[data-provider-progress-open]');if(open)open.hidden=false;clearTimeout(providerCompletionTimer);if(NATIVE_ANDROID){requestAnimationFrame(()=>requestAnimationFrame(finishProviderSetup))}else providerCompletionTimer=setTimeout(finishProviderSetup,700)}
function providerProgressError(message){clearTimeout(providerCompletionTimer);providerCompletionTimer=null;const open=document.querySelector('[data-provider-progress-open]');if(open)open.hidden=true;providerProgressUpdate({progress:100,title:'Could not finish connecting',detail:message,error:true});const kicker=document.querySelector('#providerProgressKicker');if(kicker)kicker.textContent='CONNECTION ISSUE';const spinner=document.querySelector('.provider-spinner');if(spinner){spinner.classList.add('error');spinner.textContent='!'}const summary=document.querySelector('#providerProgressSummary');if(summary)summary.innerHTML='<strong>Your details have not been cleared.</strong> Go back, check them and try again.';const back=document.querySelector('[data-provider-progress-back]');if(back)back.hidden=false}
function providerProgressBack(){clearTimeout(providerCompletionTimer);providerCompletionTimer=null;const setup=document.querySelector('#providerSetup'),panel=document.querySelector('#providerProgress'),open=document.querySelector('[data-provider-progress-open]');if(open)open.hidden=true;if(setup)setup.hidden=false;if(panel)panel.hidden=true;const back=document.querySelector('[data-provider-progress-back]');if(back)back.hidden=true}
function toast(msg){clearTimeout(toastTimer);document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=msg;document.body.appendChild(el);toastTimer=setTimeout(()=>el.remove(),2200)}

function longTaskElapsedLabel(){if(!longTask?.startedAt)return'';const sec=Math.max(0,Math.floor((Date.now()-longTask.startedAt)/1000));if(sec<60)return`${sec}s elapsed`;const min=Math.floor(sec/60),rest=sec%60;return`${min}m ${String(rest).padStart(2,'0')}s elapsed`}
function taskProgressHtml(){
  if(!longTask)return'';const pct=longTask.progress!==null&&longTask.progress!==undefined&&Number.isFinite(Number(longTask.progress))?Math.max(0,Math.min(100,Number(longTask.progress))):null,finished=longTask.status==='success'||longTask.status==='error',label=longTask.status==='success'?'COMPLETE':longTask.status==='error'?'NEEDS ATTENTION':'SWOOP TV IS WORKING';
  return `<aside class="task-progress-hud ${finished?'finished':''} ${longTask.status==='error'?'error':''}" data-task-progress-hud role="status" aria-live="polite" aria-busy="${finished?'false':'true'}"><div class="task-progress-copy"><span>${label}</span><strong>${esc(longTask.title||'Working…')}</strong><small>${esc(longTask.detail||'Please keep Swoop TV open while this finishes.')}</small></div><b class="task-progress-value">${pct===null?'WORKING':`${Math.round(pct)}%`}</b><div class="task-progress-track ${pct===null?'indeterminate':''}"><i${pct===null?'':` style="width:${pct}%"`}></i></div><div class="task-progress-foot"><span>${esc(longTaskElapsedLabel())}</span><strong>${finished?(longTask.status==='success'?'Finished successfully':'The task stopped before finishing'):'Keep Swoop TV open while this finishes.'}</strong></div></aside>`;
}
function patchTaskProgress(){
  const existing=document.querySelector('[data-task-progress-hud]');if(!longTask){existing?.remove();return}const host=document.querySelector('.app-shell');if(!host)return;const box=document.createElement('div');box.innerHTML=taskProgressHtml();const fresh=box.firstElementChild;if(!fresh)return;if(existing)existing.replaceWith(fresh);else host.appendChild(fresh);
}
function taskProgressStart({title='Working…',detail='Please keep Swoop TV open while this finishes.',progress=null}={}){
  clearTimeout(longTaskClearTimer);const token=++longTaskSeq;longTask={token,title,detail,progress:progress!==null&&progress!==undefined&&Number.isFinite(Number(progress))?Number(progress):null,status:'working',startedAt:Date.now()};clearInterval(longTaskTicker);longTaskTicker=setInterval(patchTaskProgress,1000);patchTaskProgress();return token;
}
function taskProgressUpdate({title,detail,progress,status}={}){if(!longTask)return;if(title!==undefined)longTask.title=title;if(detail!==undefined)longTask.detail=detail;if(progress!==undefined)longTask.progress=progress!==null&&Number.isFinite(Number(progress))?Math.max(0,Math.min(100,Number(progress))):null;if(status)longTask.status=status;patchTaskProgress()}
function taskProgressEnd({success=true,title='',detail='',hold=1100}={}){if(!longTask)return;const token=longTask.token;longTask.status=success?'success':'error';if(success)longTask.progress=100;if(title)longTask.title=title;if(detail)longTask.detail=detail;patchTaskProgress();clearInterval(longTaskTicker);longTaskTicker=null;clearTimeout(longTaskClearTimer);longTaskClearTimer=setTimeout(()=>{if(longTask?.token!==token)return;longTask=null;patchTaskProgress()},hold)}
function patchProviderRefreshCard(p){
  if(!p)return;const card=[...document.querySelectorAll('[data-provider-card]')].find(x=>x.dataset.providerCard===p.id);if(!card)return;const progress=card.querySelector('[data-provider-inline-progress]'),bar=card.querySelector('[data-provider-progress-bar]'),percent=card.querySelector('[data-provider-progress-percent]'),detail=card.querySelector('[data-provider-progress-detail]'),status=card.querySelector('[data-provider-status-copy]'),health=card.querySelector('[data-provider-health]'),refresh=card.querySelector('[data-provider-refresh]');const pct=Math.max(0,Math.min(100,Number(p.refreshProgress||0)));if(progress)progress.hidden=p.status!=='refreshing';if(bar)bar.style.width=`${pct}%`;if(percent)percent.textContent=`${Math.round(pct)}%`;if(detail)detail.textContent=p.refreshDetail||'Updating your library…';if(status)status.textContent=providerStatusCopy(p);if(health){health.textContent=p.status==='error'?'Needs attention':p.status==='refreshing'?'Refreshing…':p.enabled===false?'Disabled':'Connected';health.className=`provider-health ${p.status==='error'?'error':p.enabled===false?'off':'ok'}`;}if(refresh){refresh.disabled=p.status==='refreshing';refresh.textContent=p.status==='refreshing'?'↻ Refreshing…':'↻ Refresh';}}

function personCreditPayload(credits=[],type='movie'){
  const wanted=type==='series'?'series':'movie';
  return {items:(Array.isArray(credits)?credits:[]).filter(raw=>{
    const mt=String(raw?.media_type||raw?.mediaType||raw?.kind||raw?.type||'').toLowerCase();
    if(wanted==='series')return mt==='tv'||mt==='series'||mt==='show'||(!mt&&!raw?.title&&Boolean(raw?.name||raw?.original_name));
    return mt==='movie'||(!mt&&Boolean(raw?.title||raw?.original_title));
  })};
}
function sortPersonLibraryItems(list=[]){return [...list].sort((a,b)=>(yearNumber(b)-yearNumber(a))||cleanDisplayTitle(a).localeCompare(cleanDisplayTitle(b)))}
function personResultsHtml(){
  if(personLoading)return `<div class="person-loading"><span class="provider-spinner"></span><div><strong>${esc(personStatus||`Finding ${personView?.name||'cast'} titles in your Swoop TV library…`)}</strong><div class="person-progress-track"><i style="width:${Math.max(4,Math.min(100,Number(personProgress||0)))}%"></i></div><small>${Math.round(Math.max(0,Math.min(100,Number(personProgress||0))))}% · Only confident title/year matches from your connected library will be shown.</small></div></div>`;
  if(personError)return `<div class="person-error"><strong>Could not load this filmography</strong><p>${esc(personError)}</p><button class="btn secondary" data-person-retry>Try Again</button></div>`;
  const total=personMovies.length+personShows.length;
  if(!total)return `<div class="person-empty"><div class="empty-mark">S</div><h3>No confident library matches</h3><p>Swoop TV found this person, but none of their relevant TMDb credits could be confidently matched to titles in your enabled provider library.</p></div>`;
  return `${personMovies.length?`<section class="person-library-section"><div class="detail-section-head"><div><span class="eyebrow">MOVIES</span><h2>${personMovies.length.toLocaleString()} available ${personMovies.length===1?'movie':'movies'}</h2></div></div><div class="content-grid poster-content-grid person-content-grid">${personMovies.map(x=>card(x,true)).join('')}</div></section>`:''}${personShows.length?`<section class="person-library-section"><div class="detail-section-head"><div><span class="eyebrow">TV SHOWS</span><h2>${personShows.length.toLocaleString()} available ${personShows.length===1?'show':'shows'}</h2></div></div><div class="content-grid poster-content-grid person-content-grid">${personShows.map(x=>card(x,true)).join('')}</div></section>`:''}`;
}
function personHtml(){
  if(!personView)return'';const total=personMovies.length+personShows.length,profile=personView.profile||'',department=personView.knownForDepartment||'Person';
  return `<main class="person-route" aria-label="${esc(personView.name||'Cast member')}"><button class="detail-close person-close" data-person-close aria-label="Back to title">←</button><div class="person-scroll"><section class="person-hero"><div class="person-portrait-wrap">${profile?`<img class="person-portrait" data-person-profile data-swoop-art="${esc(profile)}" alt="">`:`<div class="person-portrait person-portrait-fallback">${esc((personView.name||'?').slice(0,1))}</div>`}</div><div class="person-hero-copy"><span class="eyebrow">${esc(String(department).toUpperCase())}</span><h1 data-person-name-heading>${esc(personView.name||'Cast member')}</h1><p data-person-summary>${personLoading?'Searching your connected provider library…':personError?'Filmography lookup needs attention.':`${total.toLocaleString()} ${total===1?'title':'titles'} available in your Swoop TV library.`}</p><div class="person-count-pills"><span><b data-person-movie-count>${personMovies.length}</b> Movies</span><span><b data-person-show-count>${personShows.length}</b> TV Shows</span></div></div></section><div class="person-results" data-person-results>${personResultsHtml()}</div></div></main>`;
}
function patchPersonPage(){
  if(!personView)return false;const route=document.querySelector('.person-route');if(!route)return false;
  const scroll=route.querySelector('.person-scroll'),scrollTop=scroll?.scrollTop||personScrollTop||0,total=personMovies.length+personShows.length;
  const heading=route.querySelector('[data-person-name-heading]');if(heading)heading.textContent=personView.name||'Person';
  const summary=route.querySelector('[data-person-summary]');if(summary)summary.textContent=personLoading?'Searching your connected provider library…':personError?'Filmography lookup needs attention.':`${total.toLocaleString()} ${total===1?'title':'titles'} available in your Swoop TV library.`;
  const mc=route.querySelector('[data-person-movie-count]'),sc=route.querySelector('[data-person-show-count]');if(mc)mc.textContent=String(personMovies.length);if(sc)sc.textContent=String(personShows.length);
  const currentProfile=route.querySelector('[data-person-profile]');if(personView.profile&&currentProfile?.dataset.swoopArt!==personView.profile){currentProfile.dataset.swoopArt=personView.profile;currentProfile.dataset.swoopLoaded='';loadArtwork(currentProfile)}
  const results=route.querySelector('[data-person-results]');if(results){results.innerHTML=personResultsHtml();hydrateArtwork(results);bindDynamicCards(results);bindPersonLinks(results)}
  if(scroll)scroll.scrollTop=scrollTop;return true;
}
async function matchPersonCreditsToLibrary(credits=[]){
  const moviePayload=personCreditPayload(credits,'movie'),showPayload=personCreditPayload(credits,'series');
  personProgress=46;personStatus='Matching movie credits to your provider library…';patchPersonPage();
  let movies=[];if(nativeCatalogMode){const result=await nativeCatalogMatchPayload(moviePayload,'movie',{sourceLimit:800,limit:800,providerIds:nativeEnabledProviderIds()}).catch(()=>null);movies=cacheNativeItems(result?.items||[])}else movies=matchMDBListToCatalog(moviePayload,[...items('movie'),...items('series')],{sourceLimit:800,mediaType:'movie'});
  personProgress=72;personStatus='Matching TV credits to your provider library…';patchPersonPage();await new Promise(r=>setTimeout(r,0));
  let shows=[];if(nativeCatalogMode){const result=await nativeCatalogMatchPayload(showPayload,'show',{sourceLimit:800,limit:800,providerIds:nativeEnabledProviderIds()}).catch(()=>null);shows=cacheNativeItems(result?.items||[])}else shows=matchMDBListToCatalog(showPayload,[...items('movie'),...items('series')],{sourceLimit:800,mediaType:'show'});
  return {movies:sortPersonLibraryItems(movies),shows:sortPersonLibraryItems(shows)};
}
async function loadPersonView(){
  if(!personView)return;const key=`${personView.id||''}|${personView.name||''}`;personLoading=true;personError='';personProgress=10;personStatus=`Looking up ${personView.name||'this person'}…`;patchPersonPage();
  try{
    const remote=await fetchPersonCredits({settings:state.settings,personId:personView.id||'',name:personView.name||''});if(!personView||key!==`${personView.id||''}|${personView.name||''}`)return;
    if(!remote)throw new Error('Swoop TV could not identify this person on TMDb.');
    personView={...personView,...remote,profile:remote.profile||personView.profile||''};personProgress=34;personStatus=`Found ${Number(remote.credits?.length||0).toLocaleString()} filmography credits. Checking your provider library…`;patchPersonPage();
    const matched=await matchPersonCreditsToLibrary(remote.credits||[]);if(!personView||String(personView.id||'')!==String(remote.id||personView.id||''))return;
    personMovies=matched.movies;personShows=matched.shows;personProgress=100;personStatus='Library match complete';personLoading=false;patchPersonPage();
  }catch(err){if(!personView)return;personLoading=false;personError=err.message||String(err);personProgress=100;patchPersonPage()}
}
async function loadAndroidPersonData(seed={},options={}){
  const bundledCredits=Array.isArray(options?.credits)?options.credits:[];
  let remote=bundledCredits.length?{...seed,credits:bundledCredits}:null;
  if(!remote)remote=await withTimeout(fetchPersonCredits({settings:state.settings,personId:seed.id||'',name:seed.name||''}),5000,'Filmography lookup timed out');
  if(!remote)throw new Error('Swoop TV could not identify this person on TMDb.');
  const moviePayload=personCreditPayload(remote.credits||[],'movie'),showPayload=personCreditPayload(remote.credits||[],'series');
  // STARmeter can be entered while Android is still showing the tiny Home snapshot.
  // Finish restoring the real provider catalogue before creating the person index so
  // a partial 760-item snapshot can never be mistaken for the user's full library.
  if(NATIVE_ANDROID&&tvHomeSnapshotActive)await withTimeout(ensureDurableLibraryRestored(),9000,'Provider library restore timed out').catch(()=>false);
  if(NATIVE_ANDROID&&!tvCatalogWorkerReady)await ensureTvCatalogWorkerReady(9000).catch(()=>false);
  let matched=null;if(tvCatalogWorkerReady)matched=await withTimeout(tvCatalogWorkerRequest('person-match',{moviePayload,showPayload},7500),8000,'Provider index match timed out').catch(()=>null);
  if(!matched)throw new Error('Provider availability index is still preparing. Try again in a moment.');
  const movies=Array.isArray(matched.movies)?matched.movies:[],shows=Array.isArray(matched.shows)?matched.shows:[];
  return {person:{...seed,...remote,profile:remote.profile||seed.profile||''},movies:sortPersonLibraryItems(movies),shows:sortPersonLibraryItems(shows)};
}
function openPerson(person={}){
  const name=String(person.name||'').trim();if(!name)return;
  if(NATIVE_ANDROID){
    const token=++personOpenToken,fromDetail=Boolean(detailItem),baseSeed={id:String(person.id||''),name,profile:String(person.profile||''),character:String(person.character||''),knownForDepartment:String(person.knownForDepartment||person.department||'Person')};
    const installRecord=installSeedCache?installSeedPerson(installSeedCache,{id:baseSeed.id,name}):null,seed={...baseSeed,...(installRecord?.person||{}),name:(installRecord?.person?.name||baseSeed.name),profile:(installRecord?.person?.profile||baseSeed.profile),character:baseSeed.character};
    const suspended=fromDetail?suspendDetailViewForPerson():suspendBaseViewForDetail();if(!suspended)return;
    personView={...seed};personMovies=[];personShows=[];personLoading=true;personError='';personProgress=6;personStatus=`Opening ${name}…`;personScrollTop=0;
    render();
    const cacheKey=`${seed.id||''}|${seed.name.toLowerCase()}`,cached=personLibraryCache.get(cacheKey);
    if(cached){personView={...seed,...cached.person};personMovies=cached.movies;personShows=cached.shows;personLoading=false;personProgress=100;personStatus='';patchPersonPage();return;}
    setTimeout(async()=>{try{
      personProgress=18;personStatus='Loading filmography in the background…';patchPersonPage();
      const ready=await loadAndroidPersonData(seed,{credits:Array.isArray(installRecord?.credits)?installRecord.credits:[]});if(token!==personOpenToken||profilePickerOpen||!personView)return;
      personLibraryCache.set(cacheKey,{...ready,loadedAt:Date.now()});
      personView=ready.person;personMovies=ready.movies;personShows=ready.shows;personLoading=false;personError='';personProgress=100;personStatus='';patchPersonPage();
    }catch(err){if(token===personOpenToken&&personView){personLoading=false;personError=err?.message||`Could not open ${name}.`;personProgress=100;patchPersonPage();}}},0);return;
  }
  const fromDetail=Boolean(detailItem);
  const suspended=fromDetail?suspendDetailViewForPerson():suspendBaseViewForDetail();
  if(!suspended)return;
  personView={id:String(person.id||''),name,profile:String(person.profile||''),character:String(person.character||''),knownForDepartment:String(person.knownForDepartment||person.department||'Person')};personLoading=true;personError='';personMovies=[];personShows=[];personProgress=5;personStatus=`Opening ${name}…`;personScrollTop=0;
  try{render()}catch(err){
    resetPersonState();
    if(fromDetail)restoreSuspendedDetailView();else restoreSuspendedBaseView();
    toast(`Could not open ${name}. Please try again.`);
    console.error('Swoop TV person route render failed',err);
    return;
  }
  setTimeout(loadPersonView,0);
}
function closePerson(){resetPersonState();if(restoreSuspendedDetailView())return;if(restoreSuspendedBaseView())return;render()}
function bindPersonLinks(root=document){
  root.querySelectorAll('[data-person-name]').forEach(el=>{if(el.dataset.boundPerson)return;el.dataset.boundPerson='1';el.onclick=()=>openPerson({id:el.dataset.personId||'',name:el.dataset.personName||'',profile:el.dataset.personProfile||'',character:el.dataset.personCharacter||'',knownForDepartment:el.dataset.personDepartment||''})});
  root.querySelectorAll('[data-person-close]').forEach(el=>{if(el.dataset.boundPersonClose)return;el.dataset.boundPersonClose='1';el.onclick=closePerson});
  root.querySelectorAll('[data-person-retry]').forEach(el=>{if(el.dataset.boundPersonRetry)return;el.dataset.boundPersonRetry='1';el.onclick=()=>{personError='';personLoading=true;personMovies=[];personShows=[];loadPersonView()}});
}

function detailTitleLogoState(item,meta={}) {
  const cached=state.metadataCache?.[item?.id]||{};
  const hasLogo=Boolean(meta.titleLogo||cached.titleLogo);
  const media=Boolean(item&&!isDemoItem(item)&&['movie','series'].includes(item.kind));
  const settled=Boolean(hasLogo||cached.titleLogoCheckedAt);
  return {hasLogo,pending:media&&!settled,settled};
}

function detailMeta(item,payload){
  item=visualItem(item);
  const enriched=isDemoItem(item)?{}:(state.metadataCache?.[item.id]||{});
  const info=payload?.info||{},movie=payload?.movie_data||{};
  const providerCover=resolveProviderAsset(info.movie_image||info.cover_big||info.cover||movie.stream_icon||'',item.providerId);
  const providerBackdrop=resolveProviderAsset((Array.isArray(info.backdrop_path)?info.backdrop_path[0]:info.backdrop_path)||(Array.isArray(payload?.backdrop_path)?payload.backdrop_path[0]:payload?.backdrop_path)||'',item.providerId);
  const cover=item.logo||providerCover;
  const backdrop=item.backdrop||providerBackdrop||cover;
  const genres=Array.isArray(enriched.genres)?enriched.genres.filter(Boolean):[];
  const providerYoutube=String(info.youtube_trailer||'').trim();
  const youtubeKey=enriched.trailerKey||(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/.exec(providerYoutube)?.[1]||(/^[A-Za-z0-9_-]{6,}$/.test(providerYoutube)?providerYoutube:''));
  return {
    title:cleanDisplayTitle({name:enriched.title||info.name||movie.name||item.name}),
    plot:enriched.plot||info.plot||info.description||movie.plot||item.plot||'',
    cover,backdrop,backdrops:Array.isArray(item.backdrops)?item.backdrops:[],titleLogo:item.titleLogo||'',
    year:enriched.year||info.releasedate||info.releaseDate||info.year||movie.year||item.year||'',
    rating:tenPointRating(enriched.rating),
    genre:genres.length?genres.join(', '):(info.genre||item.genre||item.group||''),
    genres,
    cast:info.cast||'',castList:Array.isArray(enriched.cast)?enriched.cast:[],
    director:enriched.director||info.director||'',
    duration:enriched.runtime||info.duration||info.episode_run_time||movie.duration||item.duration||'',
    country:info.country||'',age:enriched.certification||info.age||info.mpaa_rating||'',
    youtube:youtubeKey,trailerName:enriched.trailerName||'Official Trailer',
    recommendations:Array.isArray(enriched.recommendations)?enriched.recommendations:[]
  };
}

function episodeMetaKey(item,season,episodeNum){return `${item?.id||item?.seriesId||item?.name||'series'}|${String(season||'')}|${String(episodeNum||'')}`}
function episodeRuntimeLabel(value=''){
  if(value===null||value===undefined||value==='')return'';if(Number.isFinite(Number(value))&&Number(value)>0){const n=Number(value);return `${Math.round(n>600?n/60:n)} min`}
  const s=String(value).trim();if(!s||s==='0'||s==='0:00'||s==='00:00'||s==='00:00:00')return'';const parts=s.split(':').map(Number);if(parts.length>=2&&parts.every(Number.isFinite)){let mins=0;if(parts.length===3)mins=parts[0]*60+parts[1]+Math.round(parts[2]/60);else mins=parts[0]+Math.round(parts[1]/60);return mins>0?`${mins} min`:''}const m=s.match(/(\d+)\s*(?:min|mins|minutes)/i);return m?`${Number(m[1])} min`:s
}
function episodeAirDateLabel(value=''){
  const s=String(value||'').trim();if(!s)return'';const d=new Date(s);if(Number.isNaN(d.getTime()))return s;try{return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric'}).format(d)}catch{return s}
}
function normalizeEpisode(item,ep,season,seasonPoster=''){
  const info=ep?.info||{};
  const cfg=providerConfigFor(item);let streamUrl='';try{streamUrl=buildXtreamSeriesStreamUrl(cfg,ep)}catch{}
  const seriesPoster=item.logo||'',episodeNum=ep.episode_num||ep.episode||ep.episode_number||'',cache=episodeMetadataCache.get(episodeMetaKey(item,season,episodeNum))||{};
  const providerDuration=info.duration||info.duration_secs||info.runtime||info.episode_run_time||ep.duration||ep.duration_secs||ep.runtime||'';
  const providerAirDate=info.releasedate||info.releaseDate||info.release_date||info.air_date||info.airdate||ep.releasedate||ep.releaseDate||ep.release_date||ep.air_date||ep.airdate||'';
  return {id:`${item.id}:episode:${ep.id??ep.stream_id??`${season}-${episodeNum}`}`,providerId:item.providerId,source:'xtream',kind:'episode',name:ep.title||info.title||cache.name||`Episode ${episodeNum||''}`.trim(),group:item.name,logo:resolveProviderAsset(cache.still||info.movie_image||info.cover||seriesPoster,item.providerId),backdrop:resolveProviderAsset(cache.still||info.movie_image||item.backdrop||seriesPoster,item.providerId),seasonPoster:seasonPoster||seriesPoster,seriesPoster,seriesBackdrop:item.backdrop||'',seriesTitle:item.name||'',streamUrl,parentSeriesId:item.id,seriesId:item.seriesId,season:String(season||ep.season||''),episodeNum,plot:cache.plot||info.plot||info.description||info.overview||ep.plot||ep.description||'',duration:episodeRuntimeLabel(cache.runtime||providerDuration),airDate:episodeAirDateLabel(cache.airDate||providerAirDate),rating:info.rating||'',year:cache.airDate||providerAirDate||info.releasedate||''};
}
function seriesSeasons(item,payload){
  const episodes=payload?.episodes&&typeof payload.episodes==='object'?payload.episodes:{},seasonRows=Array.isArray(payload?.seasons)?payload.seasons:[],seasonPosters=new Map();const result=[];detailEpisodeItems.clear();
  for(const row of seasonRows){const num=String(row?.season_number??row?.season??row?.number??'');if(!num)continue;const art=resolveProviderAsset(row?.cover_big||row?.cover||row?.poster_path||'',item.providerId);if(art)seasonPosters.set(num,art)}
  for(const [season,eps] of Object.entries(episodes)){const poster=seasonPosters.get(String(season))||item.logo||'';const arr=(Array.isArray(eps)?eps:[]).map(ep=>normalizeEpisode(item,ep,season,poster));arr.forEach(x=>detailEpisodeItems.set(x.id,x));if(arr.length)result.push({season:String(season),poster,episodes:arr})}
  result.sort((a,b)=>Number(a.season)-Number(b.season));return result;
}
function detailHtml(){
  if(!detailItem)return'';
  const meta=detailMeta(detailItem,detailPayload||{}),saved=isInMyList(detailItem),backdrop=meta.backdrop||meta.cover||detailItem.logo,hasCinematicBackdrop=Boolean(meta.backdrop&&meta.backdrop!==meta.cover);
  let episodeBlock='',primary='';
  if(detailItem.kind==='series'){
    const seasons=seriesSeasons(detailItem,detailPayload||{});if(!detailSeason&&seasons.length)detailSeason=seasons[0].season;const selected=seasons.find(s=>s.season===detailSeason)||seasons[0];
    const resumeEntry=[...state.continueWatching].sort((a,b)=>(b.lastPlayed||0)-(a.lastPlayed||0)).find(x=>x?.item?.parentSeriesId===detailItem.id);
    const resumeEpisode=resumeEntry?.item?detailEpisodeItems.get(resumeEntry.item.id)||resumeEntry.item:null;
    const first=resumeEpisode||selected?.episodes?.[0];if(first){const pct=Math.round(Number(resumeEntry?.progress||0));primary=`<button class="btn play-btn detail-play" data-play="${esc(first.id)}">▶ ${resumeEpisode&&pct>1?`Resume ${pct}%`:`Play S${esc(first.season)} E${esc(first.episodeNum||'1')}`}</button>`;}
    episodeBlock=`<section class="detail-episodes"><div class="detail-section-head"><div><span class="eyebrow">EPISODES</span><h3>${seasons.length?'Seasons':'Episode information'}</h3></div>${seasons.length?`<div class="season-pills">${seasons.map(s=>`<button class="${s.season===detailSeason?'active':''}" data-season="${esc(s.season)}">Season ${esc(s.season)}</button>`).join('')}</div>`:''}</div>${detailLoading?`<div class="detail-loading detail-loading-progress"><i></i><div><span>Loading seasons and episodes…</span><div class="activity-progress indeterminate"><b></b></div><small>Loading episode information…</small></div></div>`:detailError?`<div class="detail-error">${esc(detailError)}</div>`:selected?.episodes?.length?`<div class="episode-list">${selected.episodes.map(ep=>{const ce=continueEntry(ep.id),pct=Math.round(Number(ce?.progress||0));return `<button class="episode-card" data-play="${esc(ep.id)}"><div class="episode-thumb" style="--episode-bg:linear-gradient(135deg,hsl(${Math.abs(hash(ep.name))%360} 38% 28%),#090a0d)">${ep.logo?`<img data-swoop-art="${esc(ep.logo)}" alt="">`:''}<span>▶</span>${pct>1&&pct<95?`<i class="episode-progress"><b style="width:${pct}%"></b></i>`:''}</div><div class="episode-copy"><div><strong>${ep.episodeNum?`${esc(ep.episodeNum)}. `:''}${esc(ep.name)}</strong>${ep.airDate?`<span>${esc(ep.airDate)}</span>`:''}${ep.duration?`<span>${esc(ep.duration)}</span>`:''}${pct>1&&pct<95?`<em>Resume · ${pct}%</em>`:''}</div>${ep.plot?`<p>${esc(ep.plot)}</p>`:''}</div></button>`}).join('')}</div>`:`<div class="detail-empty">No episodes were returned for this series.</div>`}</section>`;
  }else if(detailItem.kind==='movie'){
    const ce=continueEntry(detailItem.id),pct=Math.round(Number(ce?.progress||0));primary=`<button class="btn play-btn detail-play" data-play="${esc(detailItem.id)}">▶ ${pct>1&&pct<95?`Resume · ${pct}%`:'Play'}</button>`;
  }else if(detailItem.kind==='live') primary=`<button class="btn play-btn detail-play" data-play="${esc(detailItem.id)}">▶ Watch Live</button>`;
  const watched=isWatched(detailItem);
  const watchedButton=detailItem.kind!=='live'?`<button class="btn secondary detail-watched-toggle ${watched?'watched':''}" data-toggle-watched="${esc(detailItem.id)}"><span>${watched?'✓':'○'}</span> ${watched?'Mark as Unwatched':'Mark as Watched'}</button>`:'';
  const detailContinueEntry=detailItem.kind==='series'?state.continueWatching.find(x=>x?.item?.parentSeriesId===detailItem.id||x?.id===detailItem.id):detailItem.kind==='movie'?continueEntry(detailItem.id):null;
  const removeContinueButton=detailContinueEntry?`<button class="btn secondary detail-remove-continue" data-remove-continue="${esc(detailContinueEntry.id||detailItem.id)}"><span>✕</span> Remove from Continue Watching</button>`:'';
  const tmdbRelated=matchTmdbRecommendations(meta.recommendations,detailItem.kind);
  const providerRelated=detailItem.kind==='movie'?items('movie').filter(x=>x.id!==detailItem.id&&x.group===detailItem.group):activeCatalog().filter(x=>x.id!==detailItem.id&&x.kind===detailItem.kind&&x.group===detailItem.group);
  const related=[...new Map([...tmdbRelated,...providerRelated].filter(x=>x.id!==detailItem.id).map(x=>[x.id,x])).values()].slice(0,18);
  const sourceProviders=Array.isArray(detailItem.sources)?[...new Set(detailItem.sources.map(x=>providerDisplayName(x)))]:[providerDisplayName(detailItem)];const facts=[['Genre',meta.genre],['Director / Creator',meta.director],['Country',meta.country],['Runtime',meta.duration],['Rating',meta.age],['Providers',sourceProviders.filter(Boolean).join(', ')],['Playback sources',detailItem.sourceCount>1?`${detailItem.sourceCount} available`:'']].filter(([,v])=>v);
  const castBlock=meta.castList.length?`<section class="detail-cast"><div class="detail-section-head"><div><span class="eyebrow">CAST</span><h3>Cast & Characters</h3></div><span class="cast-hint">Select a cast member to browse titles in your library</span></div><div class="cast-rail">${meta.castList.map(person=>`<button class="cast-card" data-person-id="${esc(person.id||'')}" data-person-name="${esc(person.name||'')}" data-person-profile="${esc(person.profile||'')}" data-person-character="${esc(person.character||'')}" aria-label="Browse ${esc(person.name||'cast member')} titles in your Swoop TV library">${person.profile?`<img data-swoop-art="${esc(person.profile)}" alt="">`:`<div class="cast-fallback">${esc((person.name||'?').slice(0,1))}</div>`}<strong>${esc(person.name)}</strong><span>${esc(person.character||'')}</span></button>`).join('')}</div></section>`:'';
  const trailerButton=meta.youtube?`<button class="btn secondary detail-trailer" data-trailer="${esc(meta.youtube)}" data-trailer-title="${esc(meta.trailerName||meta.title)}"><span>▶</span> Trailer</button>`:'';
  return `<main class="detail-overlay detail-route" aria-label="${esc(meta.title)}"><button class="detail-close" data-detail-close aria-label="Back">←</button><div class="detail-scroll"><section class="detail-hero ${hasCinematicBackdrop?'has-backdrop':'poster-fallback'}"><div class="detail-media"><div class="detail-fallback" style="--detail-fallback:${detailItem.demoColor||'linear-gradient(135deg,#151b2a,#050609)'}"></div>${backdrop?`<img class="detail-backdrop" data-swoop-art="${esc(backdrop)}" alt="">`:''}</div><div class="detail-vignette"></div><div class="detail-copy"><div class="eyebrow">${esc(kindLabel(detailItem).toUpperCase())}</div>${(()=>{const logoState=detailTitleLogoState(detailItem,meta);return `<div class="detail-title-slot ${logoState.pending?'logo-pending':''} ${meta.titleLogo?'has-logo':''}" data-detail-title><h2 class="detail-title-text">${esc(meta.title)}</h2><span class="detail-title-wait" aria-hidden="true"></span>${meta.titleLogo?`<img class="detail-title-logo" data-swoop-art="${esc(meta.titleLogo)}" alt="${esc(meta.title)}">`:''}</div>`})()}<div class="detail-meta">${[meta.year,meta.rating?`★ ${meta.rating}`:'',meta.age,detailItem.group].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div><p>${esc(meta.plot||`Available from ${providerSummaryName()}.`)}</p><div class="cta-row">${primary}${trailerButton}<button class="btn secondary detail-list ${saved?'saved':''}" data-toggle-list="${esc(detailItem.id)}"><span>${saved?'✓':'＋'}</span> ${saved?'Saved':'Save to My SwoopTV'}</button>${watchedButton}${removeContinueButton}</div></div>${meta.cover&&!hasCinematicBackdrop?`<img class="detail-poster" data-swoop-art="${esc(meta.cover)}" alt="">`:''}</section>
  <div class="detail-body" data-detail-body>${episodeBlock}${castBlock}<section class="detail-info"><div><span class="eyebrow">ABOUT</span><h3>More about ${esc(meta.title)}</h3></div><div class="detail-facts">${facts.length?facts.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join(''):'<div><span>Source</span><strong>Your connected provider</strong></div>'}</div></section>${related.length?`<section class="detail-related">${rail('More Like This',related,detailItem.kind!=='live')}</section>`:''}</div></div></main>`;
}
function patchDetailHeroFromState(){
  if(!detailItem)return false;
  const route=document.querySelector('.detail-route'),hero=route?.querySelector('.detail-hero');if(!route||!hero)return false;
  const meta=detailMeta(detailItem,detailPayload||{}),title=cleanDisplayTitle({name:meta.title||detailItem.name});route.setAttribute('aria-label',title);
  const slot=hero.querySelector('[data-detail-title]'),titleText=slot?.querySelector('.detail-title-text');if(titleText&&titleText.textContent!==title)titleText.textContent=title;
  const logoState=detailTitleLogoState(detailItem,meta);if(slot){slot.classList.toggle('logo-pending',logoState.pending);slot.classList.toggle('has-logo',Boolean(meta.titleLogo));}
  if(slot&&meta.titleLogo){const current=[...slot.querySelectorAll('.detail-title-logo')].find(x=>x.dataset.swoopArt===meta.titleLogo),old=[...slot.querySelectorAll('.detail-title-logo')].find(x=>x.dataset.swoopArt!==meta.titleLogo);if(!current){const logo=document.createElement('img');logo.className='detail-title-logo detail-title-logo-next';logo.dataset.swoopArt=meta.titleLogo;logo.alt=title;bindDetailTitleLogoFailure(logo);logo.addEventListener('load',()=>setTimeout(()=>{old?.classList.add('detail-title-logo-retiring');setTimeout(()=>old?.remove(),260);logo.classList.remove('detail-title-logo-next')},180),{once:true});slot.appendChild(logo);loadArtwork(logo)}}else if(slot&&!meta.titleLogo&&logoState.settled){slot.querySelectorAll('.detail-title-logo').forEach(x=>x.remove());slot.classList.remove('has-logo','logo-pending')}
  const metaEl=hero.querySelector('.detail-meta');if(metaEl)metaEl.innerHTML=[meta.year,meta.rating?`★ ${meta.rating}`:'',meta.age,detailItem.group].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('');
  const plot=hero.querySelector('.detail-copy>p');if(plot)plot.textContent=meta.plot||`Available from ${providerSummaryName()}.`;
  const cta=hero.querySelector('.detail-copy .cta-row'),currentTrailer=cta?.querySelector('.detail-trailer');if(cta){if(meta.youtube&&!currentTrailer){const btn=document.createElement('button');btn.className='btn secondary detail-trailer';btn.dataset.trailer=meta.youtube;btn.dataset.trailerTitle=meta.trailerName||meta.title;btn.innerHTML='<span>▶</span> Trailer';const anchor=cta.querySelector('.detail-list');cta.insertBefore(btn,anchor||null);bindPatchedDetail(btn)}else if(meta.youtube&&currentTrailer){currentTrailer.dataset.trailer=meta.youtube;currentTrailer.dataset.trailerTitle=meta.trailerName||meta.title}else if(!meta.youtube&&currentTrailer)currentTrailer.remove()}
  const desired=meta.backdrop||meta.cover||detailItem.logo||'',media=hero.querySelector('.detail-media'),currentBackdrop=media?[...media.querySelectorAll('.detail-backdrop')].find(x=>!x.classList.contains('detail-backdrop-next')):null;
  if(media&&desired&&currentBackdrop?.dataset.swoopArt!==desired&&![...media.querySelectorAll('.detail-backdrop-next')].some(x=>x.dataset.swoopArt===desired)){
    const next=document.createElement('img');next.className='detail-backdrop detail-backdrop-next';next.dataset.swoopArt=desired;next.alt='';next.addEventListener('load',()=>setTimeout(()=>{currentBackdrop?.classList.add('detail-backdrop-retiring');hero.classList.toggle('has-backdrop',Boolean(meta.backdrop&&meta.backdrop!==meta.cover));hero.classList.toggle('poster-fallback',!Boolean(meta.backdrop&&meta.backdrop!==meta.cover));if(meta.backdrop&&meta.backdrop!==meta.cover)hero.querySelector('.detail-poster')?.classList.add('detail-poster-retiring');setTimeout(()=>{currentBackdrop?.remove();next.classList.remove('detail-backdrop-next');hero.querySelector('.detail-poster-retiring')?.remove()},380)},120),{once:true});media.appendChild(next);loadArtwork(next)
  }else if(media&&desired&&!currentBackdrop){const img=document.createElement('img');img.className='detail-backdrop';img.dataset.swoopArt=desired;img.alt='';media.appendChild(img);loadArtwork(img)}
  return true;
}
function bindDetailTitleLogoFailure(root=document){
  const logos=root?.matches?.('.detail-title-logo')?[root]:[...(root?.querySelectorAll?.('.detail-title-logo')||[])];
  for(const logo of logos){if(logo.dataset.boundTitleLogoFailure)return;logo.dataset.boundTitleLogoFailure='1';logo.addEventListener('swoop-artwork-failed',()=>{const slot=logo.closest('.detail-title-slot');logo.remove();if(slot){slot.classList.remove('has-logo','logo-pending');slot.classList.add('logo-unavailable')}})}
}

function bindPatchedDetail(root=document){
  bindDynamicCards(root);bindPersonLinks(root);bindDetailTitleLogoFailure(root);
  root.querySelectorAll('[data-season]').forEach(el=>el.onclick=()=>{detailSeason=el.dataset.season;patchDetailSectionsFromState({controls:true})});
  root.querySelectorAll('[data-toggle-list]').forEach(el=>el.onclick=()=>toggleMyList(savedItem(el.dataset.toggleList)||detailItem));
  root.querySelectorAll('[data-toggle-watched]').forEach(el=>el.onclick=()=>toggleWatched(savedItem(el.dataset.toggleWatched)||detailItem));
  root.querySelectorAll('[data-trailer]').forEach(el=>el.onclick=()=>{trailerKey=el.dataset.trailer||'';trailerTitle=el.dataset.trailerTitle||detailItem?.name||'Trailer';render()});
}
function patchDetailSectionsFromState({controls=false}={}){
  if(!detailItem)return false;const route=document.querySelector('.detail-route');if(!route)return false;
  const scroll=route.querySelector('.detail-scroll'),scrollTop=scroll?.scrollTop||0,wrap=document.createElement('div');wrap.innerHTML=detailHtml();const fresh=wrap.firstElementChild;if(!fresh)return false;
  const currentBody=route.querySelector('[data-detail-body]'),freshBody=fresh.querySelector('[data-detail-body]');if(currentBody&&freshBody){currentBody.innerHTML=freshBody.innerHTML;hydrateArtwork(currentBody);bindPatchedDetail(currentBody)}
  if(controls){const currentCta=route.querySelector('.detail-copy .cta-row'),freshCta=fresh.querySelector('.detail-copy .cta-row');if(currentCta&&freshCta){currentCta.innerHTML=freshCta.innerHTML;bindPatchedDetail(currentCta)}}
  if(scroll)scroll.scrollTop=scrollTop;return true;
}
function patchDetailFromState({sections=true,controls=false}={}){const ok=patchDetailHeroFromState();if(sections)patchDetailSectionsFromState({controls});return ok}


async function enrichEpisodeMetadata(item,ep){
  if(!item||!ep?.episodeNum)return null;const key=episodeMetaKey(item,ep.season,ep.episodeNum);if(episodeMetadataCache.has(key))return episodeMetadataCache.get(key);if(episodeMetadataPending.has(key))return episodeMetadataPending.get(key);
  const task=(async()=>{const seed=await getInstallSeedCache(),seeded=installSeedEpisodeMetadata(seed,item,ep.season,ep.episodeNum);const meta=(seeded&&installSeedFresh(seed))?seeded:(await fetchEpisodeMetadata({settings:state.settings,item,season:ep.season,episode:ep.episodeNum}).catch(()=>seeded));if(!meta)return null;const value={plot:String(meta.plot||meta.overview||''),runtime:episodeRuntimeLabel(meta.runtime||meta.duration||''),airDate:String(meta.airDate||meta.air_date||meta.releaseDate||''),still:String(meta.still||meta.stillUrl||meta.image||meta.backdrop||meta.poster||'')};episodeMetadataCache.set(key,value);return value})().catch(()=>null).finally(()=>episodeMetadataPending.delete(key));episodeMetadataPending.set(key,task);return task
}
async function prewarmSelectedEpisodeMetadata(){
  if(!detailItem||detailItem.kind!=='series'||detailLoading)return;const seasons=seriesSeasons(detailItem,detailPayload||{}),selected=seasons.find(s=>s.season===detailSeason)||seasons[0];if(!selected?.episodes?.length)return;
  const candidates=selected.episodes.slice(0,20).filter(ep=>!ep.plot||!ep.duration||!ep.airDate||!ep.logo);if(!candidates.length)return;let changed=false,index=0;
  const worker=async()=>{while(index<candidates.length){const ep=candidates[index++],meta=await enrichEpisodeMetadata(detailItem,ep);if(meta)changed=true}};await Promise.all([worker(),worker()]);if(changed&&detailItem?.kind==='series')patchDetailSectionsFromState({controls:false})
}
function trailerHtml(){return trailerKey?`<div class="trailer-shell" role="dialog" aria-modal="true"><div class="trailer-card"><button class="trailer-close" data-trailer-close>✕</button><iframe src="https://www.youtube.com/embed/${esc(trailerKey)}?autoplay=1&rel=0" title="${esc(trailerTitle||'Trailer')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><div class="trailer-caption"><span class="eyebrow">TRAILER</span><strong>${esc(trailerTitle||'Official Trailer')}</strong></div></div></div>`:''}

async function resolveNativeCatalogItem(item,{includeSources=true}={}){
  if(!item||!nativeCatalogMode||!item._nativeLogicalKey||item.kind==='episode')return item;
  if(includeSources&&Array.isArray(item.sources)&&item.sources.length)return item;
  // A representative SQLite row already contains a playable provider URL. Avoid a bridge round-trip for single-source titles.
  if(item.streamUrl&&Number(item.sourceCount||1)<=1)return item;
  try{
    const result=await nativeCatalogSources(item._nativeLogicalKey),sources=cacheNativeItems(result?.items||[]);
    if(!sources.length)return item;
    const representative=sources.find(x=>x.providerId===item.providerId)||sources[0];
    const resolved={...item,...representative,id:item.id,name:item.name||representative.name,_nativeLogicalKey:item._nativeLogicalKey,_nativeSourceIds:item._nativeSourceIds||sources.map(x=>x.id),sourceCount:Math.max(Number(item.sourceCount||0),sources.length)};
    if(includeSources&&sources.length>1)resolved.sources=sources;
    cacheNativeItems([resolved]);
    return resolved;
  }catch{return item}
}

async function prefetchDetailPayload(item){
  if(!item||!['movie','series'].includes(item.kind)||item.source!=='xtream')return null;
  if(detailCache.has(item.id))return detailCache.get(item.id);
  if(detailPrefetchPending.has(item.id))return detailPrefetchPending.get(item.id);
  const cfg=providerConfigFor(item);
  if(!cfg.server||!cfg.username||!cfg.password)return null;
  const task=(item.kind==='series'?fetchXtreamSeriesInfo(cfg,item.seriesId):fetchXtreamVodInfo(cfg,item.streamId))
    .then(payload=>{const value=payload||{};detailCache.set(item.id,value);return value})
    .catch(()=>null)
    .finally(()=>detailPrefetchPending.delete(item.id));
  detailPrefetchPending.set(item.id,task);
  return task;
}
function prewarmDetail(item){
  if(!item||!['movie','series'].includes(item.kind))return;
  enrichItemMetadata(item,{rerender:false}).catch(()=>null);
  prefetchDetailPayload(item).catch(()=>null);
}

async function openDetail(item){
  if(!item)return;
  if(NATIVE_ANDROID){
    const fromPerson=Boolean(personView),openingId=item.id;
    const metadataTask=['movie','series'].includes(item.kind)?enrichItemMetadata(item,{rerender:false}).catch(()=>null):Promise.resolve(null);
    let resolved=item;try{resolved=await resolveNativeCatalogItem(item,{includeSources:true})||item}catch{}
    let providerTask=prefetchDetailPayload(resolved);if(!providerTask&&resolved.source==='xtream'&&['movie','series'].includes(resolved.kind))providerTask=prefetchDetailPayload(resolved);
    const payload=providerTask?await providerTask.catch(()=>null):detailCache.get(resolved.id)||null;
    await metadataTask;
    if(fromPerson){suspendPersonViewForDetail();resetPersonState();detailItem=null;}
    if(!detailItem&&!fromPerson){detailReturnScroll=window.scrollY||document.documentElement.scrollTop||0;detailScrollTop=0;suspendBaseViewForDetail();}
    detailItem=resolved;detailSeason='';detailError='';detailPayload=payload||detailCache.get(openingId)||null;detailLoading=false;render();return;
  }
  const fromPerson=Boolean(personView);
  if(fromPerson){suspendPersonViewForDetail();resetPersonState();detailItem=null;}
  if(!detailItem&&!fromPerson){detailReturnScroll=window.scrollY||document.documentElement.scrollTop||0;detailScrollTop=0;suspendBaseViewForDetail();}
  // Start both remote lookups before the first detail paint. The shell still routes immediately,
  // but network latency now overlaps rendering instead of beginning after it.
  const openingId=item.id;
  const metadataTask=['movie','series'].includes(item.kind)?enrichItemMetadata(item,{rerender:false}):Promise.resolve(null);
  let providerDetailTask=prefetchDetailPayload(item);
  detailItem=item;detailSeason='';detailError='';detailPayload=detailCache.get(item.id)||null;detailLoading=Boolean(!detailPayload&&item.kind==='series'&&item.source==='xtream');render();
  metadataTask.then(()=>{if(detailItem?.id===openingId)patchDetailFromState({sections:true,controls:false})}).catch(()=>{});
  let resolved=item;
  try{resolved=await resolveNativeCatalogItem(item,{includeSources:true})||item}catch{}
  if(detailItem?.id!==openingId)return;
  if(resolved!==detailItem){detailItem=resolved;cacheNativeItems([resolved]);patchDetailFromState({sections:true,controls:false});}
  if(!providerDetailTask&&resolved.source==='xtream'&&['movie','series'].includes(resolved.kind))providerDetailTask=prefetchDetailPayload(resolved);
  const cachedPayload=detailCache.get(resolved.id);
  if(cachedPayload){detailPayload=cachedPayload;detailLoading=false;patchDetailFromState({sections:true,controls:resolved.kind==='series'});return;}
  if(resolved.source!=='xtream'||!['movie','series'].includes(resolved.kind)){detailLoading=false;patchDetailFromState({sections:true,controls:resolved.kind==='series'});return;}
  const cfg=providerConfigFor(resolved);
  if(!cfg.server||!cfg.username||!cfg.password){detailLoading=false;detailError=`Reconnect ${providerDisplayName(resolved)} or save its Xtream login to load full title details.`;patchDetailSectionsFromState({controls:false});return;}
  detailLoading=true;patchDetailSectionsFromState({controls:false});
  try{
    const payload=await (providerDetailTask||prefetchDetailPayload(resolved));
    if(detailItem?.id===openingId){detailPayload=payload||{};detailLoading=false;patchDetailFromState({sections:true,controls:resolved.kind==='series'});}
  }catch(err){if(detailItem?.id===openingId){detailLoading=false;detailError=err.message||'Could not load title details.';patchDetailSectionsFromState({controls:false});}}
}

function closeDetail(){
  if(suspendedPersonView&&restoreSuspendedPersonView())return;
  detailItem=null;detailPayload=null;detailLoading=false;detailError='';detailSeason='';detailEpisodeItems.clear();detailScrollTop=0;
  if(restoreSuspendedBaseView())return;
  render();requestAnimationFrame(()=>window.scrollTo(0,detailReturnScroll||0));
}
function toggleMyList(item){if(!item)return;clearPersistentPageViews(['home','myswoop','mylist','movies','series']);const ids=new Set(logicalItemIds(item)),saved=state.myList.some(id=>ids.has(id));if(saved){state.myList=state.myList.filter(id=>!ids.has(id));toast('Removed from My SwoopTV')}else{state.myList.unshift(item.id);toast('Saved to My SwoopTV')}persist();if(detailItem)patchDetailSectionsFromState({controls:true});else render()}
function watchHistoryEntry(itemOrId){
  const item=typeof itemOrId==='string'?savedItem(itemOrId):itemOrId,id=typeof itemOrId==='string'?itemOrId:itemOrId?.id;
  const ids=new Set(item?logicalItemIds(item):[id]);
  return state.watchHistory.find(x=>ids.has(String(x?.id||'')))||null;
}
function isWatched(item){const entry=watchHistoryEntry(item);return Boolean(entry?.completed||entry?.manualWatched)}
function toggleWatched(item){
  if(!item||item.kind==='live')return;clearPersistentPageViews(['home','movies','series']);
  const ids=new Set(logicalItemIds(item));
  if(isWatched(item)){
    state.watchHistory=state.watchHistory.filter(x=>!ids.has(String(x?.id||'')));
    state.continueWatching=state.continueWatching.filter(x=>!ids.has(String(x?.id||'')));
    toast('Marked as unwatched');
  }else{
    const existing=watchHistoryEntry(item)||{};
    const entry={...existing,id:item.id,item:compactMediaSnapshot(item),lastPlayed:Date.now(),selectedSourceId:item._selectedSourceId||existing.selectedSourceId||'',completed:true,manualWatched:true,completedAt:Date.now()};
    state.watchHistory=state.watchHistory.filter(x=>!ids.has(String(x?.id||'')));state.watchHistory.unshift(entry);state.watchHistory=state.watchHistory.slice(0,HOME_STANDARD_ROW_LIMIT);
    state.continueWatching=state.continueWatching.filter(x=>!ids.has(String(x?.id||'')));
    toast('Marked as watched');
  }
  persist();if(detailItem)patchDetailSectionsFromState({controls:true});else render();
}
function recordWatchHistory(item,{completed=false}={}){
  if(!item)return;
  const ids=new Set(logicalItemIds(item));
  if(item.kind==='live'){
    state.recentLive=[item.id,...state.recentLive.filter(id=>!ids.has(String(id)))].slice(0,HOME_STANDARD_ROW_LIMIT);
    return;
  }
  const prior=state.watchHistory.find(x=>ids.has(String(x?.id||'')))||{};
  const done=Boolean(completed||prior.completed||prior.manualWatched);
  const entry={...prior,id:item.id,item:compactMediaSnapshot(item),lastPlayed:Date.now(),selectedSourceId:item._selectedSourceId||prior.selectedSourceId||'',completed:done,manualWatched:Boolean(prior.manualWatched),completedAt:done?Number(prior.completedAt||Date.now()):0};
  state.watchHistory=state.watchHistory.filter(x=>!ids.has(String(x?.id||'')));state.watchHistory.unshift(entry);state.watchHistory=state.watchHistory.slice(0,HOME_STANDARD_ROW_LIMIT);
}
function rememberWatching(item){
  if(!item)return;recordWatchHistory(item);
  if(item.kind==='live'){persist();return}
  const old=continueEntry(item.id)||{};
  const entry={id:item.id,item:compactMediaSnapshot(item),lastPlayed:Date.now(),progress:Number(old.progress||0),position:Number(old.position||0),duration:Number(old.duration||0),selectedSourceId:item._selectedSourceId||old.selectedSourceId||''};
  const ids=new Set(logicalItemIds(item));state.continueWatching=state.continueWatching.filter(x=>!ids.has(String(x?.id||'')));state.continueWatching.unshift(entry);state.continueWatching=state.continueWatching.slice(0,HOME_STANDARD_ROW_LIMIT);persist();
}
function resumeSeconds(item){
  const e=continueEntry(item?.id);if(!e)return 0;
  const pos=Number(e.position||0),pct=Number(e.progress||0),duration=Number(e.duration||0);
  if(pos<10)return 0;
  if((pct>0&&pct>=95)||(duration>60&&pos/duration>=.95))return 0;
  return pos;
}
function updateContinueProgress(item,pb,force=false){
  if(!item||item.kind==='live'||!pb)return;
  const pos=Math.max(0,Number(pb.timePos||0)),duration=Math.max(0,Number(pb.duration||0));
  const pct=duration>0?Math.max(0,Math.min(100,(pos/duration)*100)):Math.max(0,Math.min(100,Number(pb.percentPos||0)));
  const complete=Boolean(pb.eofReached)||(duration>60&&pct>=95);
  recordWatchHistory(item,{completed:complete});
  if(complete){const ids=new Set(logicalItemIds(item));state.continueWatching=state.continueWatching.filter(x=>!ids.has(String(x?.id||'')));persist();return}
  if(pos<8&&pct<1&&!force)return;
  const old=continueEntry(item.id)||{};
  const entry={id:item.id,item:compactMediaSnapshot(item),lastPlayed:Date.now(),position:pos||Number(old.position||0),duration:duration||Number(old.duration||0),progress:pct||Number(old.progress||0),selectedSourceId:item._selectedSourceId||old.selectedSourceId||''};
  const ids=new Set(logicalItemIds(item));state.continueWatching=state.continueWatching.filter(x=>!ids.has(String(x?.id||'')));state.continueWatching.unshift(entry);state.continueWatching=state.continueWatching.slice(0,HOME_STANDARD_ROW_LIMIT);
  if(force||Date.now()-lastPlaybackPersist>7000){lastPlaybackPersist=Date.now();persist()}
}
function nextEpisodeFromMap(item){
  if(item?.kind!=='episode')return null;
  const list=[...detailEpisodeItems.values()].filter(x=>x.parentSeriesId===item.parentSeriesId).sort((a,b)=>Number(a.season)-Number(b.season)||Number(a.episodeNum)-Number(b.episodeNum));
  const idx=list.findIndex(x=>x.id===item.id);return idx>=0?list[idx+1]||null:null;
}
async function findNextEpisode(item){
  let next=nextEpisodeFromMap(item);if(next)return next;
  if(item?.kind!=='episode'||!item.seriesId)return null;const cfg=providerConfigFor(item);if(!cfg.server)return null;
  try{const parent=savedItem(item.parentSeriesId)||{id:item.parentSeriesId,seriesId:item.seriesId,name:item.group||'Series',providerId:item.providerId,kind:'series',source:'xtream'};const payload=await fetchXtreamSeriesInfo(cfg,item.seriesId);seriesSeasons(parent,payload);return nextEpisodeFromMap(item)}catch{return null}
}
function clearUpNext(){if(upNextTimer){clearInterval(upNextTimer);upNextTimer=null}upNextItem=null;upNextSeconds=0;document.querySelector('.up-next-overlay')?.remove()}
function showUpNext(next){
  clearUpNext();if(!next)return;upNextItem=next;upNextSeconds=10;
  const shell=document.querySelector('.player-shell');if(!shell)return;
  const el=document.createElement('div');el.className='up-next-overlay';el.innerHTML=`<div class="up-next-card"><span class="eyebrow">UP NEXT</span><h3>${esc(next.name)}</h3><p>Season ${esc(next.season||'')} · Episode ${esc(next.episodeNum||'')}</p><div class="up-next-count">Playing in <strong data-upnext-count>${upNextSeconds}</strong>s</div><div class="cta-row"><button class="btn play-btn" data-upnext-play>▶ Play now</button><button class="btn secondary" data-upnext-cancel>Cancel</button></div></div>`;shell.appendChild(el);
  el.querySelector('[data-upnext-play]').onclick=()=>{clearUpNext();play(next)};el.querySelector('[data-upnext-cancel]').onclick=()=>{clearUpNext();const st=document.querySelector('#playerStatus');if(st)st.textContent='Episode finished'};
  upNextTimer=setInterval(()=>{upNextSeconds--;const c=document.querySelector('[data-upnext-count]');if(c)c.textContent=String(Math.max(0,upNextSeconds));if(upNextSeconds<=0){clearUpNext();play(next)}},1000);
}
async function handlePlaybackFinished(item){
  if(item?.kind==='episode'){const next=await findNextEpisode(item);if(next){showUpNext(next);return}}
  const status=document.querySelector('#playerStatus');if(status)status.textContent=item?.kind==='live'?'Live playback closed':'Playback finished';
}
function updatePlayerProgressUi(pb){
  if(!pb)return;const bar=document.querySelector('#nativeProgressBar'),time=document.querySelector('#nativeProgressTime');
  const pos=Number(pb.timePos||0),dur=Number(pb.duration||0),pct=dur>0?Math.max(0,Math.min(100,pos/dur*100)):Number(pb.percentPos||0);
  if(bar)bar.style.width=`${pct||0}%`;
  const fmt=x=>{x=Math.max(0,Math.floor(Number(x||0)));const h=Math.floor(x/3600),m=Math.floor((x%3600)/60),sec=x%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`};
  if(time)time.textContent=dur>0?`${fmt(pos)} / ${fmt(dur)}`:fmt(pos);
  const tech=document.querySelector('#nativePlaybackTech');if(tech){const res=Number(pb.width)>0&&Number(pb.height)>0?`${Math.round(Number(pb.width))}×${Math.round(Number(pb.height))}`:'',fmtLabel=String(pb.videoFormat||'').toUpperCase(),audio=String(pb.audioCodec||'').toUpperCase();const bits=[res,fmtLabel,audio].filter(Boolean);tech.textContent=bits.length?bits.join(' · '):'Starting stream…'}
}
function stopPlaybackMonitor(){if(playbackMonitorTimer){clearInterval(playbackMonitorTimer);playbackMonitorTimer=null}}
function startPlaybackMonitor(item){
  stopPlaybackMonitor();if(!NATIVE_PLAYBACK)return;let endedHandled=false;
  const poll=async()=>{if(!playerItem||playerItem.id!==item.id)return;try{const diag=await nativeDiagnostics(),pb=diag?.playback;updatePlayerProgressUi(pb);if(item.kind!=='live')updateContinueProgress(item,pb,false);const dur=Number(pb?.duration||0),pos=Number(pb?.timePos||0),finished=Boolean(pb?.eofReached)||(dur>60&&pos/dur>=.992);if(finished&&!endedHandled){endedHandled=true;updateContinueProgress(item,{...(pb||{}),eofReached:true},true);stopPlaybackMonitor();handlePlaybackFinished(item);return}if(!diag?.playing&&Date.now()-playerStartedAt>2500&&!endedHandled){endedHandled=true;if(item.kind!=='live')updateContinueProgress(item,pb,true);stopPlaybackMonitor();handlePlaybackFinished(item)}}catch{}};
  poll();playbackMonitorTimer=setInterval(poll,2200);
}
async function loadPlayerNowNext(item){
  if(item?.kind!=='live')return;const box=document.querySelector('#liveNowNext');if(!box)return;
  try{
    let cached=epgCache.get(item.id);
    if(!cached||Date.now()-cached.loadedAt>EPG_TTL_MS){const src=preferredLiveSource(item),cfg=providerConfigFor(src);if(src.source==='xtream'&&cfg.server){const payload=await fetchXtreamShortEpg(cfg,src.streamId,8);cached={loadedAt:Date.now(),list:normalizeXtreamEpg(payload)};epgCache.set(item.id,cached)}}
    const now=Date.now(),list=cached?.list||[],current=list.find(p=>now>=p.startMs&&now<p.endMs),next=list.find(p=>p.startMs>=now&&p!==current);
    box.innerHTML=current?`<div class="live-program current"><span>NOW</span><strong>${esc(current.title)}</strong><small>${new Date(current.startMs).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}–${new Date(current.endMs).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</small></div>${next?`<div class="live-program"><span>NEXT</span><strong>${esc(next.title)}</strong><small>${new Date(next.startMs).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</small></div>`:''}`:`<div class="live-program"><span>LIVE</span><strong>${esc(item.name)}</strong><small>Programme information unavailable</small></div>`;
  }catch{box.innerHTML=`<div class="live-program"><span>LIVE</span><strong>${esc(item.name)}</strong><small>Open Guide for programme information</small></div>`}
}
function adjacentLive(item,step=1){const list=items('live');if(!list.length)return null;const idx=Math.max(0,list.findIndex(x=>x.id===item?.id));return list[(idx+Number(step)+list.length)%list.length]}
function liveMiniGuideChannels(item,count=7){
  const all=items('live');if(!all.length)return[];
  const same=all.filter(x=>x.group===item?.group),pool=same.length>=Math.min(4,count)?same:all;
  const idx=Math.max(0,pool.findIndex(x=>x.id===item?.id)),half=Math.floor(count/2),out=[];
  for(let offset=-half;offset<=half;offset++){const ch=pool[(idx+offset+pool.length)%pool.length];if(ch&&!out.some(x=>x.id===ch.id))out.push(ch)}
  return out.slice(0,count);
}
function currentProgramme(channel){const cached=epgCache.get(channel?.id),now=Date.now(),list=cached?.list||[];return list.find(p=>now>=p.startMs&&now<p.endMs)||null}
async function ensureLiveEpg(channel){
  if(!channel)return;
  const cached=epgCache.get(channel.id);if(cached&&Date.now()-cached.loadedAt<EPG_TTL_MS)return cached;
  const src=preferredLiveSource(channel),cfg=providerConfigFor(src);if(src.source==='xtream'&&cfg.server&&src.streamId){try{const payload=await fetchXtreamShortEpg(cfg,src.streamId,6),next={loadedAt:Date.now(),list:normalizeXtreamEpg(payload)};epgCache.set(channel.id,next);return next}catch{}}
  return cached||{loadedAt:Date.now(),list:[]};
}
function liveMiniGuideRowsHtml(item){return liveMiniGuideChannels(item).map((ch,index)=>{const p=currentProgramme(ch),active=ch.id===item?.id,q=qualityLabel(ch),number=items('live').findIndex(x=>x.id===ch.id)+1;return `<button class="live-mini-row ${active?'active':''}" data-mini-channel="${esc(ch.id)}"><span class="live-mini-num">${number>0?number:'—'}</span>${ch.logo?`<img data-swoop-art="${esc(ch.logo)}" alt="">`:'<span class="live-mini-logo">TV</span>'}<span class="live-mini-copy"><strong>${esc(ch.name)}</strong><small data-mini-guide-prog="${esc(ch.id)}">${p?esc(p.title):'Loading programme…'}</small></span>${q?`<i>${esc(q)}</i>`:''}${active?'<b>NOW</b>':''}</button>`}).join('')}
async function loadLiveMiniGuide(item){
  if(item?.kind!=='live')return;const token=++liveMiniGuideToken,channels=liveMiniGuideChannels(item);
  await Promise.all(channels.map(ch=>ensureLiveEpg(ch)));
  if(token!==liveMiniGuideToken||playerItem?.id!==item.id)return;
  for(const ch of channels){const el=document.querySelector(`[data-mini-guide-prog="${CSS.escape(ch.id)}"]`),p=currentProgramme(ch);if(el)el.textContent=p?.title||'Programme information unavailable'}
}
async function switchLiveChannel(next){
  if(!next||next.kind!=='live')return;const playable=preferredLiveSource(next);
  if(!(NATIVE_PLAYBACK&&playerItem?.kind==='live')){play(playable);return}
  try{
    const status=document.querySelector('#playerStatus');if(status)status.textContent=`Switching to ${next.name}…`;
    await nativeSwitchLive(playable);rememberWatching(next);playerItem=playable;playerStartedAt=Date.now();render();startPlaybackMonitor(playable);loadPlayerNowNext(playable);loadLiveMiniGuide(playable);
    const st=document.querySelector('#playerStatus');if(st)st.textContent='● LIVE · Channel changed';
  }catch(err){toast(err.message||'Could not change channel')}
}
function compactMediaSnapshot(item){if(!item)return item;const {sources,...rest}=item;if(item.kind==='episode'&&item.parentSeriesId){const parent=savedItem(item.parentSeriesId);rest.seriesPoster=item.seriesPoster||parent?.logo||'';rest.seasonPoster=item.seasonPoster||rest.seriesPoster||'';rest.seriesBackdrop=item.seriesBackdrop||parent?.backdrop||'';rest.seriesTitle=item.seriesTitle||parent?.name||item.group||'';}return rest}
function sourceChoiceHtml(){
  const item=sourceChoiceItem;if(!item)return'';
  const sources=rankSources(Array.isArray(item.sources)?item.sources:[],savedMovieSourcePreference(item)||continueEntry(item.id)?.selectedSourceId||'',providerPriorityMap()),resume=resumeSeconds(item);
  const recommended=sources[0],preferred=savedMovieSourcePreference(item)||continueEntry(item.id)?.selectedSourceId||'';
  return `<div class="source-choice-overlay" role="dialog" aria-modal="true" aria-label="Choose source for ${esc(item.name)}"><div class="source-choice-card smart-source-card"><div class="source-choice-head"><div><span class="eyebrow">SMART SOURCE SELECTION · ${sources.length} OPTIONS</span><h2>Choose how to watch</h2><p>Swoop TV ranked the confidently matched copies of <strong>${esc(item.name)}</strong> using resolution, HDR, codec and provider clues. You always make the final choice${resume>0?` · resume point ${Math.floor(resume/60)}m ${Math.floor(resume%60)}s`:''}.</p>${recommended?`<button class="btn play-btn smart-best-btn" data-source-best="${esc(recommended.id)}">▶ Play Recommended <small>${esc(sourceTechSummary(recommended))}</small></button>`:''}</div><button class="icon-btn" data-source-close aria-label="Close">✕</button></div><div class="source-choice-list">${sources.map((source,index)=>{const t=sourceTraits(source),label=source._sourceLabel||`Source ${index+1}`,isPreferred=preferred&&preferred===source.id,isRecommended=recommended?.id===source.id;const badges=[t.quality,t.hdr,t.codec,t.audio].filter(Boolean);return `<button class="source-option ${isRecommended?'recommended':''}" data-source-play="${esc(source.id)}"><span class="source-option-main"><strong>${esc(label)}</strong><small>${esc(source.name||item.name)}</small><em>${esc(providerDisplayName(source))} · ${esc(source.group||'Provider source')}</em></span><span class="source-option-tech">${badges.length?badges.map(x=>`<i>${esc(x)}</i>`).join(''):'<i>STANDARD</i>'}</span><span class="source-option-flags">${isPreferred?'<b>PREFERRED</b>':''}${isRecommended?'<b>RECOMMENDED</b>':''}${t.tag?`<i>${esc(t.tag)}</i>`:''}<span>Play →</span></span></button>`}).join('')}</div><div class="source-confidence"><span>✓ Confident duplicate stack</span><small>Matched using ${esc(item._stackConfidence||'provider metadata')}. Choosing a source remembers it for this movie. If a recommended source exits immediately, Swoop TV can try the next ranked copy automatically.</small></div></div></div>`;
}
function playableFromSource(logical,source,{attempts=[]}={}){const prior=[...new Set([...(attempts||[]),source.id].filter(Boolean))];return {...logical,...source,id:logical.id,name:logical.name,logo:logical.logo||source.logo,backdrop:logical.backdrop||source.backdrop,sources:logical.sources,sourceCount:logical.sourceCount,_stacked:logical._stacked,_stackConfidence:logical._stackConfidence,_selectedSourceId:source.id,_selectedSourceLabel:source._sourceLabel||'',_sourceAttemptIds:prior}}
function nextSourceFallback(item){const logical=savedItem(item?.id);if(!logical||!Array.isArray(logical.sources)||logical.sources.length<2)return null;const attempted=new Set([...(item?._sourceAttemptIds||[]),item?._selectedSourceId].filter(Boolean));const next=rankSources(logical.sources,'',providerPriorityMap()).find(x=>!attempted.has(x.id));return next?{logical,source:next,attempts:[...attempted]}:null}
async function autoFallbackSource(item){const fallback=nextSourceFallback(item);if(!fallback)return false;const status=document.querySelector('#playerStatus'),msg=document.querySelector('#playerMessage');if(status)status.textContent='Trying another source…';if(msg)msg.textContent=`The selected source closed immediately. Swoop TV is trying ${fallback.source._sourceLabel||'the next ranked source'} automatically.`;await new Promise(r=>setTimeout(r,500));await play(playableFromSource(fallback.logical,fallback.source,{attempts:fallback.attempts}),{sourceSelected:true,fallback:true});return true}
function playerHtml(){
  if(NATIVE_PLAYBACK){
    const live=playerItem?.kind==='live',ce=continueEntry(playerItem?.id),pct=Math.round(Number(ce?.progress||0));
    if(live){
      const item=visualItem(playerItem),fav=isLiveFavourite(item),q=qualityLabel(item),logo=item.logo?`<img class="native-live-logo" data-swoop-art="${esc(item.logo)}" alt="">`:'<span class="native-live-logo-fallback">TV</span>';
      return `<div class="player-shell native-player-shell premium-live-player" role="dialog" aria-modal="true" aria-label="${esc(item?.name||'Swoop TV Live TV')}"><div class="premium-live-layout"><section class="native-live-main"><div class="native-live-channel-head">${logo}<div><div class="eyebrow">● LIVE TV ${q?`· ${esc(q)}`:''}</div><h2>${esc(item?.name||'')}</h2><p>${esc(item?.group||'Live TV')}</p></div><button class="live-fav-control ${fav?'active':''}" data-live-favourite="${esc(item.id)}">${fav?'★ Favourite':'☆ Favourite'}</button></div><div id="playerStatus" class="player-status native-live-status">Starting playback…</div><div id="liveNowNext" class="live-now-next premium-now-next"><div class="live-program"><span>GUIDE</span><strong>Loading Now & Next…</strong></div></div><div class="native-channel-controls premium-channel-controls"><button class="btn secondary" data-channel-step="-1">‹ Channel</button><button class="btn play-btn" data-player-guide>▤ Full TV Guide</button><button class="btn secondary" data-channel-step="1">Channel ›</button></div><div id="playerMessage" class="native-player-copy">Playback is open. Use Swoop TV to browse and change channels.</div><div class="live-shortcuts"><span id="liveChannelNumber" class="channel-number-indicator"></span><span><kbd>PgUp</kbd>/<kbd>PgDn</kbd> change channel</span><span><kbd>0–9</kbd> jump to channel number</span><span><kbd>F</kbd> fullscreen</span></div><div class="cta-row"><button class="btn danger" data-native-stop>Stop playback</button><button class="btn secondary" data-close-player>Back to Swoop TV</button></div></section><aside class="live-mini-guide"><div class="live-mini-head"><div><span class="eyebrow">QUICK GUIDE</span><h3>${esc(item.group||'Nearby Channels')}</h3></div><button class="icon-btn" data-player-guide aria-label="Open full guide">▤</button></div><div class="live-mini-list">${liveMiniGuideRowsHtml(item)}</div></aside></div></div>`;
    }
    const sourceInfo=playerItem?sourceTechSummary(playerItem):'';
    return `<div class="player-shell native-player-shell" role="dialog" aria-modal="true" aria-label="${esc(playerItem?.name||'Swoop TV Player')}"><div class="native-player-card"><div class="eyebrow">SWOOP TV PLAYER</div><h2>${esc(playerItem?.name||'')}</h2>${playerItem?`<div class="native-source-strip"><span>${esc(playerItem._selectedSourceLabel||playerItem.group||'Provider source')}</span><b>${esc(sourceInfo)}</b></div>`:''}<div id="playerStatus" class="player-status">Starting playback…</div><div class="native-progress"><div><span>${pct>1?`Resume ${pct}%`:'Playback progress'}</span><strong id="nativeProgressTime">0:00</strong></div><i><b id="nativeProgressBar" style="width:${pct}%"></b></i></div><div class="native-transport"><button class="mini-control" data-native-control="seek" data-native-value="-10">−10s</button><button class="mini-control" data-native-control="toggle-pause">Pause / Resume</button><button class="mini-control" data-native-control="seek" data-native-value="10">+10s</button></div><div id="nativePlaybackTech" class="native-playback-tech">Starting stream…</div><div id="playerMessage" class="native-player-copy">Your playback position is saved automatically.</div><div class="cta-row"><button class="btn danger" data-native-stop>Stop playback</button><button class="btn secondary" data-close-player>Back to Swoop TV</button></div></div></div>`;
  }
  return `<div class="player-shell" role="dialog" aria-modal="true" aria-label="${esc(playerItem?.name||'Swoop TV Player')}"><video id="swoopVideo" class="swoop-video" controls autoplay playsinline></video><div class="player-top"><button class="player-back" data-close-player>←</button><div><div class="player-title">${esc(playerItem?.name||'')}</div><div id="playerStatus" class="player-status">${playerItem?.kind==='live'?'Preparing live stream…':'Preparing playback…'}</div></div></div><div id="playerMessage" class="player-message" hidden></div></div>`;
}
function setPlayerMessage(message,isError=false){const status=document.querySelector('#playerStatus'),box=document.querySelector('#playerMessage');if(status)status.textContent=isError?'Playback unavailable':'Loading…';if(box){box.hidden=false;box.classList.toggle('error',isError);box.textContent=message}}
async function stopPlayback(capture=true){
  stopPlaybackMonitor();clearUpNext();
  if(NATIVE_PLAYBACK){try{const result=await nativeStop();if(capture&&playerItem?.kind!=='live')updateContinueProgress(playerItem,result?.playback,true)}catch{}}
  try{activeHls?.destroy?.()}catch{}activeHls=null;const video=document.querySelector('#swoopVideo');if(video){try{video.pause()}catch{}video.removeAttribute('src');try{video.load()}catch{}}
}
async function closePlayer(){await stopPlayback(true);playerItem=null;playerUiHidden=false;render()}
function hlsCandidate(item){let url=String(item.streamUrl||'');if(item.kind==='live'&&item.source==='xtream')url=url.replace(/\.(?:ts|m3u8)(?=($|\?))/i,'.m3u8');return url}
function loadHlsLibrary(){if(window.Hls)return Promise.resolve(window.Hls);if(window.__swoopHlsPromise)return window.__swoopHlsPromise;window.__swoopHlsPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/hls.js@1.6.16/dist/hls.min.js';script.async=true;script.onload=()=>window.Hls?resolve(window.Hls):reject(new Error('HLS player did not initialise.'));script.onerror=()=>reject(new Error('Could not load the HLS playback engine.'));document.head.appendChild(script)});return window.__swoopHlsPromise}
async function startPlayback(item){
  if(NATIVE_PLAYBACK){try{const startSeconds=resumeSeconds(item);const result=await nativePlay(item,{startSeconds});playerStartedAt=Date.now();const status=document.querySelector('#playerStatus');if(status)status.textContent=startSeconds>0?`Resuming from ${Math.floor(startSeconds/60)}m ${Math.floor(startSeconds%60)}s…`:'Starting playback…';const msg=document.querySelector('#playerMessage');if(msg&&item.kind!=='live')msg.textContent=startSeconds>0?'Resuming from your saved position…':'Starting playback…';await new Promise(r=>setTimeout(r,1400));const diag=await nativeDiagnostics();if(diag?.playing){if(status)status.textContent=item.kind==='live'?'● LIVE':startSeconds>0?'Playing':'Playing';if(msg&&item.kind!=='live')msg.textContent=`Playback is running. Your Continue Watching position will stay up to date.`;if(item.kind==='movie'&&item._selectedSourceId)rememberMovieSourcePreference(item,item._selectedSourceId);startPlaybackMonitor(item);if(item.kind==='live'){loadPlayerNowNext(item);loadLiveMiniGuide(item)}}else{if(item.kind==='movie'&&Array.isArray(item.sources)&&item.sources.length>1&&await autoFallbackSource(item))return;const lines=Array.isArray(diag?.logTail)?diag.logTail.filter(Boolean):[];const tail=lines.slice(-6).join(' | ');const code=diag?.exitCode!==null&&diag?.exitCode!==undefined?` Exit code ${diag.exitCode}.`:'';setPlayerMessage(`Playback could not start. Try this source again or choose another source.`,true)}}catch(err){if(item.kind==='movie'&&Array.isArray(item.sources)&&item.sources.length>1&&await autoFallbackSource(item))return;setPlayerMessage(err.message||'Could not start playback.',true)}return}
  const video=document.querySelector('#swoopVideo');if(!video||!item)return;const url=hlsCandidate(item);if(location.protocol==='https:'&&/^http:\/\//i.test(url)){setPlayerMessage('This stream cannot be played in the web app. Try another source or the Swoop TV app.',true);return}const lower=url.split('?')[0].toLowerCase(),isHls=/\.m3u8$/.test(lower);if(item.kind==='live'&&!isHls){setPlayerMessage('This live stream is not supported by the web player. Try another source or the Swoop TV app.',true);return}if(isHls){if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;video.addEventListener('loadedmetadata',()=>{const s=document.querySelector('#playerStatus');if(s)s.textContent=item.kind==='live'?'● LIVE':'Playing'},{once:true});video.addEventListener('timeupdate',()=>{if(item.kind!=='live'&&video.duration)updateContinueProgress(item,{timePos:video.currentTime,duration:video.duration,percentPos:video.currentTime/video.duration*100},false)});video.addEventListener('ended',()=>handlePlaybackFinished(item),{once:true});video.addEventListener('error',()=>setPlayerMessage('This stream could not be played. Try another source.',true),{once:true});try{video.currentTime=resumeSeconds(item);await video.play()}catch{}return}try{const Hls=await loadHlsLibrary();if(!Hls.isSupported())throw new Error('This browser does not provide MediaSource playback.');activeHls=new Hls({enableWorker:true,lowLatencyMode:true,backBufferLength:60,maxBufferLength:20});activeHls.attachMedia(video);activeHls.on(Hls.Events.MEDIA_ATTACHED,()=>activeHls?.loadSource(url));activeHls.on(Hls.Events.MANIFEST_PARSED,()=>{const s=document.querySelector('#playerStatus');if(s)s.textContent=item.kind==='live'?'● LIVE':'Playing';if(item.kind!=='live'&&resumeSeconds(item)>0)try{video.currentTime=resumeSeconds(item)}catch{}video.play().catch(()=>{})});video.addEventListener('timeupdate',()=>{if(item.kind!=='live'&&video.duration)updateContinueProgress(item,{timePos:video.currentTime,duration:video.duration,percentPos:video.currentTime/video.duration*100},false)});video.addEventListener('ended',()=>handlePlaybackFinished(item),{once:true});activeHls.on(Hls.Events.ERROR,(_,data)=>{if(!data?.fatal)return;const detail=data?.details?` (${data.details})`:'';setPlayerMessage(`The HLS stream could not be played${detail}. Try another source or the Swoop TV app.`,true);try{activeHls?.destroy()}catch{}activeHls=null})}catch(err){setPlayerMessage(err.message||'Could not start HLS playback.',true)}return}if(/\.(mp4|webm|m4v)$/.test(lower)){video.src=url;video.addEventListener('loadedmetadata',()=>{const s=document.querySelector('#playerStatus');if(s)s.textContent='Playing';const resume=resumeSeconds(item);if(resume>0)try{video.currentTime=resume}catch{}},{once:true});video.addEventListener('timeupdate',()=>{if(video.duration)updateContinueProgress(item,{timePos:video.currentTime,duration:video.duration,percentPos:video.currentTime/video.duration*100},false)});video.addEventListener('ended',()=>handlePlaybackFinished(item),{once:true});video.addEventListener('error',()=>setPlayerMessage('This video could not be played. Try another source.',true),{once:true});try{await video.play()}catch{}return}setPlayerMessage('This video format is not supported by the web player.',true)
}
async function play(item,{sourceSelected=false}={}){
  if(!item)return;
  if(nativeCatalogMode&&item._nativeLogicalKey){
    const resolved=await resolveNativeCatalogItem(item,{includeSources:true});
    if(resolved)item=resolved;
  }
  if(item.kind==='live'&&Array.isArray(item.sources)&&item.sources.length>1)item=preferredLiveSource(item);
  if(NATIVE_PLAYBACK&&item.kind==='live'&&playerItem?.kind==='live'){await switchLiveChannel(item);return}
  if(item.kind==='movie'&&Array.isArray(item.sources)&&item.sources.length>1&&!sourceSelected){sourceChoiceItem=item;render();return}
  if(!item.streamUrl){
    toast(item.kind==='series'?'Open the series to choose an episode.':'Swoop TV could not resolve a playable source for this title.');
    if(item.kind==='series')openDetail(item);
    return;
  }
  sourceChoiceItem=null;
  if(playerItem)await stopPlayback(true);
  rememberWatching(item);playerItem=item;playerUiHidden=false;render();requestAnimationFrame(()=>startPlayback(item));
}

function queueArtworkRelay(task,priority='normal'){return new Promise((resolve,reject)=>{const job={task,resolve,reject};if(priority==='high')artworkRelayQueue.unshift(job);else artworkRelayQueue.push(job);pumpArtworkRelay()})}
function artworkRelayLimit(){return largeLibraryMode()?8:12}
function pumpArtworkRelay(){while(artworkRelayActive<artworkRelayLimit()&&artworkRelayQueue.length){const job=artworkRelayQueue.shift();artworkRelayActive++;Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{artworkRelayActive--;pumpArtworkRelay()})}}
async function relayArtworkUrl(url,priority='normal'){if(artworkCache.has(url))return artworkCache.get(url);const promise=queueArtworkRelay(async()=>{const blob=await fetchXtreamAssetBlob({relayUrl:sessionRelay.url,relayToken:sessionRelay.token},url);return URL.createObjectURL(blob)},priority).catch(err=>{artworkCache.delete(url);throw err});artworkCache.set(url,promise);return promise}
function canRelayArtwork(){return !NATIVE_WINDOWS&&Boolean(sessionRelay.url&&sessionRelay.token&&enabledProviders().some(p=>p.type==='xtream'))}
function optimizedArtworkUrl(url,img){const raw=String(url||'');if(!/image\.tmdb\.org\/t\/p\//i.test(raw))return raw;const cls=img?.className||'';let size='w500';if(/backdrop|hero-art|hero-backdrop|detail-backdrop/i.test(cls))size='w1280';else if(/title-logo/i.test(cls))size='w500';else if(/cast/i.test(cls))size='w185';else if(img?.closest?.('.poster, .poster-content-grid'))size='w342';return raw.replace(/\/t\/p\/(?:original|w\d+)\//i,`/t/p/${size}/`)}
function revealArtwork(img){const show=()=>{img.classList.add('loaded');img.closest?.('.card')?.classList.add('art-ready');if(img.classList.contains('hero-title-logo'))img.closest?.('.hero-title-slot')?.classList.add('logo-ready')};if(typeof img.decode==='function')img.decode().then(show).catch(show);else show()}
function artworkLoadFailed(img){img.dataset.swoopFailed='1';img.classList.add('artwork-failed');img.removeAttribute('src');const card=img.closest?.('[data-imdb-item]'),id=card?.dataset?.imdbItem,item=id?savedItem(id):null;if(item&&['movie','series'].includes(item.kind))queueVisibleMetadata(item,{forceArtwork:true});try{img.dispatchEvent(new Event('swoop-artwork-failed'))}catch{}}
function artworkNearViewport(img,vertical=520,horizontal=1100){const r=img.getBoundingClientRect();return r.bottom>=-vertical&&r.top<=innerHeight+vertical&&r.right>=-horizontal&&r.left<=innerWidth+horizontal}
function loadArtwork(img,{priority='normal'}={}){if(img.dataset.swoopLoaded==='1')return;img.dataset.swoopLoaded='1';const original=img.dataset.swoopArt||'';if(!original)return;const url=optimizedArtworkUrl(original,img);img.decoding='async';const critical=/hero|detail-backdrop|title-logo/i.test(img.className||''),eager=critical||priority==='high'||artworkNearViewport(img);if(!critical){img.loading=eager?'eager':'lazy';try{img.fetchPriority=eager?'high':'low'}catch{}}let relayTried=false;const fallback=async()=>{if(relayTried||!canRelayArtwork()){artworkLoadFailed(img);return}relayTried=true;try{const relay=await relayArtworkUrl(original,eager?'high':priority);img.onload=()=>revealArtwork(img);img.onerror=()=>artworkLoadFailed(img);img.src=relay}catch{artworkLoadFailed(img)}};if(location.protocol==='https:'&&/^http:\/\//i.test(original)&&canRelayArtwork()){fallback();return}img.onload=()=>revealArtwork(img);img.onerror=()=>fallback();img.src=url}
function hydrateArtwork(root=document){const imgs=[...root.querySelectorAll('img[data-swoop-art]')].filter(img=>img.dataset.swoopLoaded!=='1');if(!imgs.length)return;const immediate=imgs.filter(img=>/title-logo|hero|detail-backdrop/i.test(img.className||'')||artworkNearViewport(img,600,1300));immediate.forEach(img=>loadArtwork(img,{priority:'high'}));const deferred=imgs.filter(img=>!immediate.includes(img));if(!deferred.length)return;if(!('IntersectionObserver'in window)){deferred.forEach(img=>loadArtwork(img,{priority:'normal'}));return}if(!artworkObserver)artworkObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){artworkObserver?.unobserve(entry.target);loadArtwork(entry.target,{priority:'high'})}},{rootMargin:largeLibraryMode()?'700px 1200px':'1000px 1800px',threshold:.01});deferred.forEach(img=>artworkObserver.observe(img))}

let searchIndexKey='',searchIndexCache=[];
function searchIndex(){const key=`${activeCatalogContext}|${movieStackPriorityKey}|live-separate|${metadataRevision}`;if(searchIndexKey===key&&searchIndexCache.length)return searchIndexCache;const logical=[...items('movie'),...items('series'),...items('live')];searchIndexCache=logical.map(item=>({item,text:`${item.name||''} ${item.group||''} ${item.year||''}`.toLowerCase()}));searchIndexKey=key;return searchIndexCache}
function searchPeopleMarkup(people=[]){
  if(!people.length)return'';
  return `<section class="search-people-section"><div class="search-section-head"><div><span class="eyebrow">PEOPLE</span><h2>Actors, Actresses & Directors</h2></div><span>${people.length} ${people.length===1?'match':'matches'}</span></div><div class="search-people-rail">${people.map(person=>{const dept=person.knownForDepartment||'Person',known=(person.knownFor||[]).slice(0,3).join(' · ');return `<button class="search-person-card" data-person-id="${esc(person.id||'')}" data-person-name="${esc(person.name||'')}" data-person-profile="${esc(person.profile||'')}" data-person-department="${esc(dept)}" aria-label="Browse ${esc(person.name||'person')} titles in your Swoop TV library">${person.profile?`<img data-swoop-art="${esc(person.profile)}" alt="">`:`<div class="search-person-fallback">${esc((person.name||'?').slice(0,1))}</div>`}<strong>${esc(person.name||'')}</strong><span>${esc(dept)}</span>${known?`<small>${esc(known)}</small>`:''}</button>`}).join('')}</div></section>`;
}
async function runPeopleSearch(term,seq){
  const host=document.querySelector('#searchPeople');if(!host)return;
  if(term.length<2){host.innerHTML='';return}
  if(NATIVE_ANDROID)host.innerHTML='';else host.innerHTML='<div class="search-people-loading"><span class="provider-spinner"></span><span>Searching actors, actresses and directors…</span></div>';
  try{
    const seed=installSeedCache||await getInstallSeedCache(),installHot=seed?searchInstallSeedPeople(seed,term,12):[],hot=[...new Map([...installHot,...starmeterPeopleForSearch(term)].map(p=>[starmeterNormalize(p.name),p])).values()].slice(0,12);if(hot.length){host.innerHTML=searchPeopleMarkup(hot);hydrateArtwork(host);bindPersonLinks(host)}
    const remote=await searchPeople({settings:state.settings,query:term,limit:12}),merged=[...new Map([...hot,...(remote||[])].map(p=>[starmeterNormalize(p.name),p])).values()].slice(0,12);
    if(seq!==peopleSearchSeq||document.querySelector('#searchInput')?.value.trim()!==term)return;
    const current=document.querySelector('#searchPeople');if(!current)return;
    current.innerHTML=searchPeopleMarkup(merged);hydrateArtwork(current);bindPersonLinks(current);
  }catch(err){
    if(seq!==peopleSearchSeq)return;
    const current=document.querySelector('#searchPeople');if(!current)return;
    current.innerHTML=`<div class="search-people-unavailable"><strong>People search unavailable</strong><span>${esc(err.message||'Could not search people right now.')}</span></div>`;
  }
}
async function runSearch(q){
  const out=document.querySelector('#searchResults'),peopleOut=document.querySelector('#searchPeople');if(!out)return;const term=q.trim(),seq=++peopleSearchSeq;
  if(!term&&peopleOut)peopleOut.innerHTML='';else runPeopleSearch(term,seq);
  if(nativeCatalogMode){
    out.innerHTML='<div class="native-query-loading"><div><span class="provider-spinner"></span><strong>Searching Swoop TV…</strong><div class="activity-progress indeterminate"><b></b></div><small>Finding matches…</small></div></div>';
    try{const result=await nativeCatalogSearch(term,{providerId:providerFilter,providerIds:providerFilter==='all'?nativeEnabledProviderIds():[],limit:80,kinds:['movie','series','live']}),res=cacheNativeItems(result?.items||[]);if(!document.querySelector('#searchResults'))return;out.innerHTML=res.length?res.map(x=>card(x,x.kind!=='live')).join(''):empty('No title or channel matches','Try another title, channel, category or person.');hydrateArtwork(out);bindDynamicCards(out)}catch(err){out.innerHTML=empty('Search unavailable',err.message||'Could not search your library.')}return;
  }
  const lower=term.toLowerCase();if(!lower){const starter=[...items('movie').slice(0,24),...items('series').slice(0,12)];out.innerHTML=starter.map(x=>card(x,x.kind!=='live')).join('');hydrateArtwork(out);bindDynamicCards(out);return}
  if(NATIVE_ANDROID&&tvCatalogWorkerReady){
    const result=await tvCatalogWorkerRequest('search',{term:lower,limit:80,kinds:['movie','series','live']},5000);if(seq!==peopleSearchSeq||document.querySelector('#searchInput')?.value.trim()!==term)return;
    const res=Array.isArray(result?.items)?result.items:[];out.innerHTML=res.length?res.map(x=>card(x,x.kind!=='live')).join(''):empty('No title or channel matches','Try another title, channel, category or person.');hydrateArtwork(out);bindDynamicCards(out);return;
  }
  const res=[];const source=searchIndex();for(let i=0;i<source.length;i++){const entry=source[i];if(entry.text.includes(lower)){res.push(entry.item);if(res.length>=80)break}if(NATIVE_ANDROID&&i&&i%900===0)await new Promise(r=>setTimeout(r,0));}
  if(seq!==peopleSearchSeq)return;out.innerHTML=res.length?res.map(x=>card(x,x.kind!=='live')).join(''):empty('No title or channel matches','Try another title, channel, category or person.');hydrateArtwork(out);bindDynamicCards(out)
}
function scheduleSearch(q){clearTimeout(searchDebounceTimer);searchDebounceTimer=setTimeout(()=>runSearch(q),largeLibraryMode()?220:110)}
function persist(bulk=false){syncActiveProfileFromState();const snapshot={...state,page:'home',favourites:state.myList};const localOk=saveState(snapshot);if(NATIVE_ANDROID&&state.catalog.length&&(bulk===true||bulk==='catalog'))scheduleTvHomeSnapshotSave(300);if(!bulk)return Promise.resolve(localOk);const saveCatalog=bulk===true||bulk==='catalog';return saveBulkState(snapshot,{catalog:saveCatalog}).then(bulkOk=>localOk&&bulkOk)}
function normalizeProviderPriorities(){state.providers.sort((a,b)=>Number(a.priority)-Number(b.priority));state.providers.forEach((p,i)=>p.priority=i);syncLegacyProvider();sessionXtream=providerConfigById(state.provider?.id)||{server:'',username:'',password:'',relayUrl:'',relayToken:''};resetMovieStackIndex()}
function upsertProviderRecord(record){const i=state.providers.findIndex(p=>p.id===record.id);const existing=i>=0?state.providers[i]:null;const next={...existing,...record,enabled:record.enabled!==false,priority:existing?.priority??state.providers.length,status:record.status||'connected',lastRefreshed:record.lastRefreshed||Date.now()};if(i>=0)state.providers[i]=next;else state.providers.push(next);normalizeProviderPriorities();return next}
function saveProviderCredentials(profile){const id=providerProfileId(profile);const next={...profile,id,savedAt:Date.now()};const i=savedProviderProfiles.findIndex(p=>providerProfileId(p)===id);if(i>=0)savedProviderProfiles[i]=next;else savedProviderProfiles.push(next);sessionProviderConfigs.set(id,next);saveProviderProfiles(savedProviderProfiles);savedProviderProfile=savedProviderProfiles[0]||null;return next}
function removeSavedProviderCredentials(id){savedProviderProfiles=savedProviderProfiles.filter(p=>providerProfileId(p)!==id);sessionProviderConfigs.delete(id);saveProviderProfiles(savedProviderProfiles);savedProviderProfile=savedProviderProfiles[0]||null}
function replaceProviderCatalog(providerId,newItems=[]){state.catalog=[...state.catalog.filter(x=>x.providerId!==providerId),...newItems];tvMovieStackedCache=null;androidDestinationPrewarmStarted=false;stopTvCatalogWorker();resetMovieStackIndex();syncProviderCounts();if(NATIVE_ANDROID){for(const cache of Object.values(state.webDiscovery||{}))if(cache&&typeof cache==='object')cache.updatedAt=0}else state.webDiscovery={};epgCache.clear();m3uGuideTextCache.delete(providerId);xtreamGuideTextCache.delete(providerId);guideProviderCategoryCache.key='';guideProviderCategoryCache.names=[];guideChannelCache.key='';guideChannelCache.items=[];detailCache.clear()}
function providerStatusCopy(p){if(p.status==='error')return p.lastError||'Provider refresh failed';if(p.status==='refreshing')return`${Math.round(Math.max(0,Math.min(100,Number(p.refreshProgress||0))))}% · ${p.refreshDetail||'Updating your library…'}`;if(p.enabled===false)return'Provider is disabled';return p.lastRefreshed?`Last refreshed ${new Date(p.lastRefreshed).toLocaleString()}`:'Connected'}
async function refreshProvider(id,{quiet=false,manageTask=true,onProgress=null,deferPersist=false}={}){
  const p=providerById(id);if(!p)return false;const cfg=providerConfigById(id)||{};p.status='refreshing';p.lastError='';p.refreshProgress=2;p.refreshDetail='Updating provider…';if(!quiet)render();else patchProviderRefreshCard(p);if(manageTask)taskProgressStart({title:`Refreshing ${p.name||'TV provider'}…`,detail:'Updating provider…',progress:2});
  const report=(progress,detail)=>{p.refreshProgress=Math.max(0,Math.min(100,Number(progress)||0));p.refreshDetail=detail||p.refreshDetail;patchProviderRefreshCard(p);if(manageTask)taskProgressUpdate({title:`Refreshing ${p.name||'TV provider'}…`,detail:p.refreshDetail,progress:p.refreshProgress});try{onProgress?.({provider:p,progress:p.refreshProgress,detail:p.refreshDetail})}catch{}};
  try{
    let resultItems=[],counts={live:0,movie:0,series:0},expiresAt=0,expiryNever=false;
    if(p.type==='xtream'){
      if(!cfg.server||!cfg.username||!cfg.password)throw new Error('Saved Xtream login is required to refresh this provider.');
      report(8,'Connecting…');const auth=await testXtream(cfg);if(String(auth?.user_info?.auth)==='0')throw new Error('Xtream account is not authorised.');expiresAt=providerExpiryFromProfile(auth);expiryNever=!expiresAt&&String(auth?.user_info?.exp_date??'').trim()==='0';report(17,'Loading Live TV, Movies and TV Shows…');
      const completed=new Set(),result=await importXtream(cfg,p.id,info=>{if(info?.phase==='prepare'){const loaded=Number(info.loaded||0),total=Math.max(1,Number(info.total||1)),pct=71+(loaded/total)*5;report(Math.min(76,pct),`Preparing ${loaded.toLocaleString()} of ${total.toLocaleString()} items…`);return}if(!info?.section)return;completed.add(info.section);const loaded=[...completed].map(section=>`${section==='live'?'Live TV':section==='movie'?'Movies':'TV Shows'} ✓`).join(' · '),pct=17+completed.size*18;report(Math.min(71,pct),`${loaded}. ${completed.size<3?'Loading…':'Ready to prepare.'}`)});resultItems=result.items;counts=result.counts||counts;report(76,`Preparing your library…`);
    }else{
      if(!cfg.url&&!p.url)throw new Error('This M3U provider came from a local file and has no URL to refresh. Re-import the file to update it.');
      const url=cfg.url||p.url;report(10,'Loading playlist…');const text=NATIVE_PLAYBACK?await nativeFetchText(url):await (await fetch(url,{cache:'no-store'})).text();report(58,'Preparing your library…');resultItems=parseM3U(text,p.id).filter(x=>!isDemoItem(x));counts={live:resultItems.filter(x=>x.kind==='live').length,movie:resultItems.filter(x=>x.kind==='movie').length,series:resultItems.filter(x=>x.kind==='series').length};report(75,`Preparing your library…`);
    }
    if(!resultItems.length)throw new Error('This provider returned no playable content.');
    replaceProviderCatalog(p.id,resultItems);report(81,'Updating your library…');if(NATIVE_WINDOWS){await nativeCatalogReplaceProvider(p.id,resultItems,{onProgress:info=>{const pct=82+Math.round((Number(info.loaded||0)/Math.max(1,Number(info.total||1)))*14);report(Math.min(96,pct),`Saving ${Number(info.loaded||0).toLocaleString()} of ${Number(info.total||0).toLocaleString()} items…`)}});report(97,'Finishing your library…');await activateNativeCatalogIfAvailable();}Object.assign(p,{lastRefreshed:Date.now(),lastError:'',counts,...(p.type==='xtream'?{expiresAt,expiryNever}:{})});
    const saved=savedProviderProfiles.find(x=>providerProfileId(x)===p.id);if(saved){Object.assign(saved,{lastRefreshed:p.lastRefreshed,counts,name:p.name,enabled:p.enabled,priority:p.priority,expiresAt:p.expiresAt||0,expiryNever:Boolean(p.expiryNever)});saveProviderProfiles(savedProviderProfiles)}
    report(99,'Finishing…');p.status='connected';if(!deferPersist)await persist(NATIVE_WINDOWS?'cache':true);p.refreshProgress=100;p.refreshDetail='Updated';patchProviderRefreshCard(p);try{onProgress?.({provider:p,progress:100,detail:'Updated'})}catch{}if(manageTask)taskProgressEnd({success:true,title:`${p.name||'Provider'} refreshed`,detail:`${Number(counts.live||0).toLocaleString()} live · ${Number(counts.movie||0).toLocaleString()} movies · ${Number(counts.series||0).toLocaleString()} shows`});setTimeout(()=>{delete p.refreshProgress;delete p.refreshDetail;patchProviderRefreshCard(p)},1200);if(!quiet){render();toast(`${p.name} refreshed`)}return true;
  }catch(err){p.status='error';p.lastError=err.message||String(err);p.refreshDetail=p.lastError;patchProviderRefreshCard(p);if(manageTask)taskProgressEnd({success:false,title:`Could not refresh ${p.name||'provider'}`,detail:p.lastError,hold:2200});if(!deferPersist)await persist();if(!quiet){render();toast(`${p.name}: ${p.lastError}`)}return false}
}
async function refreshAllProviders(){const list=enabledProviders();if(!list.length){toast('No enabled providers to refresh');return}taskProgressStart({title:'Refreshing all TV providers…',detail:`Starting provider 1 of ${list.length}.`,progress:1});let ok=0;for(let i=0;i<list.length;i++){const p=list[i];const success=await refreshProvider(p.id,{quiet:true,manageTask:false,onProgress:info=>{const overall=((i+(Number(info.progress||0)/100))/list.length)*100;taskProgressUpdate({title:`Refreshing all TV providers…`,detail:`Provider ${i+1} of ${list.length}: ${p.name} · ${info.detail}`,progress:overall})}});if(success)ok++;}render();taskProgressUpdate({progress:100,detail:`Finished checking ${list.length} provider${list.length===1?'':'s'}.`});taskProgressEnd({success:ok===list.length,title:'Provider refresh finished',detail:`${ok} of ${list.length} provider${list.length===1?'':'s'} refreshed successfully.`,hold:1500});toast(ok===list.length?'Provider refresh finished':`${ok} of ${list.length} providers refreshed`)}
async function removeProvider(id){const p=providerById(id);if(!p)return;state.catalog=state.catalog.filter(x=>x.providerId!==id);if(NATIVE_WINDOWS){await nativeCatalogRemoveProvider(id).catch(()=>{});await refreshNativeCatalogStats();}state.providers=state.providers.filter(x=>x.id!==id);removeSavedProviderCredentials(id);normalizeProviderPriorities();syncProviderCounts();state.webDiscovery={};epgCache.clear();m3uGuideTextCache.delete(id);xtreamGuideTextCache.delete(id);guideProviderCategoryCache.key='';guideProviderCategoryCache.names=[];guideChannelCache.key='';guideChannelCache.items=[];detailCache.clear();await persist(NATIVE_WINDOWS?'cache':true);if(nativeCatalogMode&&nativeCatalogStats?.rowCount)await activateNativeCatalogIfAvailable();render();toast(`${p.name} removed`)}
async function toggleProviderEnabled(id){const p=providerById(id);if(!p)return;p.enabled=p.enabled===false;normalizeProviderPriorities();const saved=savedProviderProfiles.find(x=>providerProfileId(x)===id);if(saved){saved.enabled=p.enabled;saveProviderProfiles(savedProviderProfiles)}if(nativeCatalogMode){for(const k of ['movie','series','live'])nativePageCache[k].key='';nativeHomeRowCache.clear();await activateNativeCatalogIfAvailable()}await persist();render();toast(`${p.name} ${p.enabled?'enabled':'disabled'}`)}
function moveProvider(id,delta){const list=state.providers.slice().sort((a,b)=>Number(a.priority)-Number(b.priority)),i=list.findIndex(p=>p.id===id),j=i+delta;if(i<0||j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];state.providers=list;normalizeProviderPriorities();for(const p of savedProviderProfiles){const idx=state.providers.findIndex(x=>x.id===providerProfileId(p));if(idx>=0)p.priority=idx}saveProviderProfiles(savedProviderProfiles);persist();render()}
function providerFilterOptions(){return enabledProviders().map(p=>({id:p.id,name:p.name}))}
function itemHasProvider(item,id){if(!id||id==='all')return true;if(item.providerId===id)return true;return Array.isArray(item.sources)&&item.sources.some(s=>s.providerId===id)}
function providerFiltered(list){return providerFilter==='all'?list:list.filter(x=>itemHasProvider(x,providerFilter))}

function bindDynamicCards(root=document){
  hydrateVisibleImdbRatings(root);bindRailStability(root);
  // Continue Watching removal is handled by one delegated listener so lazy rows and
  // persistent/restored page DOM cannot lose the action binding.
  if(!document.documentElement.dataset.swoopContinueRemoveDelegated){
    document.documentElement.dataset.swoopContinueRemoveDelegated='1';
    document.addEventListener('click',async event=>{
      const el=event.target?.closest?.('[data-remove-continue]');if(!el)return;
      event.preventDefault();event.stopPropagation();
      const id=String(el.dataset.removeContinue||''),seriesId=String(el.dataset.removeContinueSeries||'');if(!id)return;
      const changed=removeFromContinueWatching(id,seriesId);
      if(!changed){toast('This title is no longer in Continue Watching');return;}
      // Keep the active profile snapshot in lock-step before any cached view is restored.
      syncActiveProfileFromState();
      await persist();
      if(detailItem){patchDetailHeroFromState();patchDetailSectionsFromState({controls:true});}
      if(modal==='continueOptions'){modal=null;continueOptionsTarget=null;render();}
      // Patch the visible Home row and also invalidate any detached cached Home snapshot,
      // so a later return cannot resurrect the removed item.
      if(state.page==='home'&&!detailItem&&!playerItem)patchMountedHomeRows(['continue']);
      else clearPersistentPageViews('home');
      toast('Removed from Continue Watching');
    },true);
  }
  root.querySelectorAll('[data-play]').forEach(el=>{
    if(el.dataset.boundPlay)return;el.dataset.boundPlay='1';
    el.onclick=async()=>{
      if(el.dataset.playBusy==='1')return;
      el.dataset.playBusy='1';const original=el.innerHTML;el.classList.add('interaction-pending');
      if(el.classList.contains('detail-play'))el.innerHTML='▶ Opening…';
      try{
        const id=el.dataset.play;
        let item=(detailItem?.id===id?detailItem:null)||detailEpisodeItems.get(id)||savedItem(id);
        if(!item&&nativeCatalogMode){try{const result=await nativeCatalogGet([id]);item=cacheNativeItems(result?.items||[])[0]||null}catch{}}
        if(!item){toast('Swoop TV could not resolve this title.');return;}
        await play(item);
      }finally{
        if(document.contains(el)){el.dataset.playBusy='0';el.classList.remove('interaction-pending');el.innerHTML=original;}
      }
    }
  });
  root.querySelectorAll('[data-detail]').forEach(el=>{
    if(el.dataset.boundDetail)return;el.dataset.boundDetail='1';
    const warm=()=>{const item=savedItem(el.dataset.detail);if(item)prewarmDetail(item)};
    el.addEventListener('pointerenter',warm,{passive:true});
    el.addEventListener('focus',warm,{passive:true});
    el.addEventListener('touchstart',warm,{passive:true});
    el.onclick=()=>{const item=savedItem(el.dataset.detail);if(item)openDetail(item);else toast('Opening title…')}
  })
}

function bind(){
  document.querySelectorAll('[data-starmeter-retry]').forEach(el=>el.onclick=()=>{starmeterLoaded=false;starmeterLoading=false;starmeterError='';starmeterPeople=[];starmeterVisibleCount=STARMETER_INITIAL_VISIBLE;ensureStarmeterLoaded();render()});
  document.querySelectorAll('[data-profile-picker]').forEach(el=>el.onclick=()=>{syncActiveProfileFromState();persist();profilePickerOpen=true;modal=null;profileEditId='';render()});
  document.querySelectorAll('[data-profile-manage]').forEach(el=>el.onclick=()=>{profilePickerOpen=false;modal='profiles';render()});
  document.querySelectorAll('[data-profile-add]').forEach(el=>el.onclick=()=>{profilePickerOpen=false;profileEditId='';modal='profileEdit';render()});
  document.querySelectorAll('[data-profile-edit]').forEach(el=>el.onclick=()=>{profilePickerOpen=false;profileEditId=el.dataset.profileEdit||state.activeProfileId;modal='profileEdit';render()});
  document.querySelectorAll('[data-profile-select]').forEach(el=>el.onclick=()=>switchProfile(el.dataset.profileSelect));
  document.querySelectorAll('[data-profile-avatar]').forEach(el=>el.onclick=()=>{const value=el.dataset.profileAvatar,input=document.querySelector('#profileAvatarValue');if(input)input.value=value;document.querySelectorAll('[data-profile-avatar]').forEach(x=>{const active=x===el;x.classList.toggle('active',active);x.setAttribute('aria-pressed',active?'true':'false')})});
  document.querySelector('[data-profile-pin-activate]')?.addEventListener('click',()=>{const input=document.querySelector('[data-profile-pin-input]');if(!input)return;input.readOnly=false;input.tabIndex=0;input.focus();try{input.click()}catch{}});
  document.querySelector('[data-profile-pin-input]')?.addEventListener('blur',e=>{if(!NATIVE_ANDROID)return;e.currentTarget.readOnly=true;e.currentTarget.tabIndex=-1});
  document.querySelectorAll('[data-profile-theme]').forEach(el=>el.onclick=()=>{const value=themeById(el.dataset.profileTheme).id,input=document.querySelector('#profileThemeValue');if(input)input.value=value;document.querySelectorAll('[data-profile-theme]').forEach(x=>x.classList.toggle('active',x===el))});
  document.querySelector('[data-pin-cancel]')?.addEventListener('click',()=>{pendingProfileId='';profilePinError='';modal=null;profilePickerOpen=true;render()});
  document.querySelector('#profilePinForm')?.addEventListener('submit',async e=>{e.preventDefault();const target=state.profiles.find(p=>p.id===pendingProfileId),pin=String(new FormData(e.currentTarget).get('pin')||'');if(!target)return;const digest=await pinDigest(pin,target.pinSalt);if(digest!==target.pinHash){profilePinError='Incorrect PIN. Try again.';render();return}const id=target.id;pendingProfileId='';profilePinError='';await switchProfile(id,{skipPin:true})});
  document.querySelector('#profileForm')?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),id=String(fd.get('id')||''),existing=state.profiles.find(p=>p.id===id)||null,name=String(fd.get('name')||'Profile').trim(),avatar=String(fd.get('avatar')||'lion'),kids=Boolean(fd.get('kids')),smartHome=Boolean(fd.get('smartHome')),themeId=themeById(String(fd.get('themeId')||existing?.profileSettings?.themeId||'swoop')).id,pin=String(fd.get('pin')||'').trim(),removePin=Boolean(fd.get('removePin'));if(!name){toast('Enter a profile name');return}if(pin&&!/^\d{4,8}$/.test(pin)){toast('Profile PIN must be 4–8 digits');return}if(existing?.id===state.activeProfileId)syncActiveProfileFromState();let next=existing?normalizeProfile(state.profiles.find(p=>p.id===id)||existing):makeProfile({name,avatar,kids,profileSettings:{themeId:'swoop',backgroundColor:'#030306',backgroundOverride:false,movieSourcePreferences:{},homeRows:[...DEFAULT_HOME_ROWS],smartHomeOrder:true}});next={...next,name:name.slice(0,24),avatar:avatarById(avatar).id,kids,profileSettings:{...(next.profileSettings||{}),smartHomeOrder:smartHome,themeId}};if(kids){const rawById=x=>state.catalog.find(item=>item.id===x)||next.continueWatching.find(e=>e.id===x)?.item||next.watchHistory.find(e=>e.id===x)?.item||null;next.myList=next.myList.filter(id=>{const item=rawById(id);return !item||profileAllowsMedia(next,item,state.metadataCache?.[item.id]||{})});next.continueWatching=next.continueWatching.filter(e=>!e?.item||profileAllowsMedia(next,e.item,state.metadataCache?.[e.id]||{}));next.watchHistory=next.watchHistory.filter(e=>!e?.item||profileAllowsMedia(next,e.item,state.metadataCache?.[e.id]||{}));}if(removePin){next.pinHash='';next.pinSalt=''}else if(pin){next.pinSalt=randomSalt();next.pinHash=await pinDigest(pin,next.pinSalt)}if(existing){const i=state.profiles.findIndex(p=>p.id===existing.id);state.profiles[i]=next;if(existing.id===state.activeProfileId){applyProfileToState(next)}}else{state.profiles.push(next);state.activeProfileId=next.id;applyProfileToState(next)}profileEditId='';modal=null;profilePickerOpen=false;await persist();render();toast(existing?'Profile updated':`Welcome, ${next.name}`)});
  document.querySelectorAll('[data-profile-delete]').forEach(el=>el.onclick=async()=>{const id=el.dataset.profileDelete;if(state.profiles.length<=1){toast('Swoop TV needs at least one profile');return}const wasActive=id===state.activeProfileId;state.profiles=state.profiles.filter(p=>p.id!==id);if(wasActive){state.activeProfileId=state.profiles[0].id;applyProfileToState(state.profiles[0])}profileEditId='';modal='profiles';await persist();render();toast('Profile deleted')});
  document.querySelectorAll('[data-page]').forEach(el=>el.onclick=()=>{const target=el.dataset.page;if(NATIVE_ANDROID&&target==='settings')noteTvHardwareSettingsTap();navigatePage(target);if(NATIVE_ANDROID&&target==='search')requestAnimationFrame(()=>document.querySelector('#searchInput')?.focus?.({preventScroll:true}))});
  document.querySelectorAll('[data-modal]').forEach(el=>el.onclick=()=>{modal=el.dataset.modal;render()});
  document.querySelectorAll('[data-hardware-test]').forEach(el=>el.onclick=()=>{setTvHardwareTest(el.dataset.hardwareTest||'');render()});
  document.querySelector('[data-hardware-export]')?.addEventListener('click',()=>exportTvHardwareDiagnostics());
  document.querySelector('[data-hardware-clear]')?.addEventListener('click',clearTvHardwareDiagnostics);
  document.querySelector('[data-hardware-exit]')?.addEventListener('click',()=>setTvHardwareTestMode(false));
  document.querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>{modal=null;render()});
  document.querySelectorAll('[data-close-modal]').forEach(el=>el.onclick=e=>{if(e.target===el){modal=null;render()}});
  bindDynamicCards(document);bindPersonLinks(document);bindDetailTitleLogoFailure(document);
  document.querySelectorAll('[data-source-close]').forEach(el=>el.onclick=()=>{sourceChoiceItem=null;render()});
  document.querySelectorAll('[data-source-play]').forEach(el=>el.onclick=()=>{const logical=sourceChoiceItem,source=logical?.sources?.find(x=>x.id===el.dataset.sourcePlay);if(logical&&source){rememberMovieSourcePreference(logical,source.id);play(playableFromSource(logical,source),{sourceSelected:true})}});
  document.querySelectorAll('[data-source-best]').forEach(el=>el.onclick=()=>{const logical=sourceChoiceItem,source=logical?.sources?.find(x=>x.id===el.dataset.sourceBest);if(logical&&source){rememberMovieSourcePreference(logical,source.id);play(playableFromSource(logical,source),{sourceSelected:true})}});
  document.querySelectorAll('[data-detail-close]').forEach(el=>el.onclick=closeDetail);
  document.querySelectorAll('[data-toggle-list]').forEach(el=>el.onclick=()=>toggleMyList(savedItem(el.dataset.toggleList)||detailItem));
  document.querySelectorAll('[data-toggle-watched]').forEach(el=>el.onclick=()=>toggleWatched(savedItem(el.dataset.toggleWatched)||detailItem));
  document.querySelectorAll('[data-season]').forEach(el=>el.onclick=()=>{detailSeason=el.dataset.season;patchDetailSectionsFromState({controls:true})});
  document.querySelectorAll('[data-close-player]').forEach(el=>el.onclick=()=>{if(playerItem?.kind==='live'){playerUiHidden=true;state.page='live';render()}else closePlayer()});
  document.querySelectorAll('[data-live-controls]').forEach(el=>el.onclick=()=>{playerUiHidden=false;render()});
  document.querySelectorAll('[data-live-stop]').forEach(el=>el.onclick=()=>closePlayer());
  document.querySelectorAll('[data-native-stop]').forEach(el=>el.onclick=async()=>{try{const result=await nativeStop();stopPlaybackMonitor();if(playerItem?.kind!=='live')updateContinueProgress(playerItem,result?.playback,true);const status=document.querySelector('#playerStatus');if(status)status.textContent='Playback stopped'}catch{}});
  document.querySelectorAll('[data-native-control]').forEach(el=>el.onclick=async()=>{try{const result=await nativeControl(el.dataset.nativeControl,el.dataset.nativeValue!==undefined?Number(el.dataset.nativeValue):null);updatePlayerProgressUi(result?.playback)}catch(err){toast(err.message||'Player control failed')}});
  document.querySelectorAll('[data-channel-step]').forEach(el=>el.onclick=()=>{const next=adjacentLive(playerItem,Number(el.dataset.channelStep||1));if(next)switchLiveChannel(next)});
  document.querySelectorAll('[data-mini-channel]').forEach(el=>el.onclick=()=>{const next=savedItem(el.dataset.miniChannel);if(next)switchLiveChannel(next)});
  document.querySelectorAll('[data-live-favourite]').forEach(el=>el.onclick=()=>{const item=savedItem(el.dataset.liveFavourite)||playerItem;if(item)toggleLiveFavourite(item)});
  document.querySelectorAll('[data-live-category]').forEach(el=>el.onclick=()=>{liveCategory=el.dataset.liveCategory||'';viewLimits.live=96;if(nativeCatalogMode)nativePageCache.live.key='';render()});
  document.querySelectorAll('[data-live-more-categories]').forEach(el=>el.onclick=()=>{liveRailCategoryLimit+=LIVE_RAIL_CATEGORY_BATCH;render()});
  document.querySelectorAll('[data-media-more-categories]').forEach(el=>el.onclick=()=>{const kind=el.dataset.mediaMoreCategories||'movie';if(mediaRailCategoryLimit[kind]!==undefined){mediaRailCategoryLimit[kind]+=MEDIA_RAIL_CATEGORY_BATCH;render()}});
  document.querySelectorAll('[data-player-guide]').forEach(el=>el.onclick=async()=>{if(playerItem?.kind==='live'){playerUiHidden=true;state.page='guide';render()}else{await closePlayer();state.page='guide';render()}});
  document.querySelectorAll('[data-trailer]').forEach(el=>el.onclick=()=>{trailerKey=el.dataset.trailer||'';trailerTitle=el.dataset.trailerTitle||detailItem?.name||'Trailer';render()});
  document.querySelectorAll('[data-trailer-close]').forEach(el=>el.onclick=()=>{trailerKey='';trailerTitle='';render()});
  document.querySelectorAll('[data-load-more]').forEach(el=>el.onclick=()=>{const kind=el.dataset.loadMore;viewLimits[kind]=(viewLimits[kind]||(kind==='live'?96:72))+(kind==='live'?96:72);if(nativeCatalogMode&&nativePageCache[kind])nativePageCache[kind].key='';render()});
  document.querySelectorAll('[data-search-term]').forEach(el=>el.onclick=()=>{state.page='search';render();const input=document.querySelector('#searchInput');if(input){input.value=el.dataset.searchTerm;runSearch(input.value)}});document.querySelectorAll('[data-page-category]').forEach(el=>el.onclick=()=>{const kind=el.dataset.pageCategory,group=el.dataset.pageGroup||'';if(nativeCatalogMode&&['movie','series'].includes(kind)){pageCategory[kind]=group;viewLimits[kind]=100;nativePageCache[kind].key='';render()}else{state.page='search';render();const input=document.querySelector('#searchInput');if(input){input.value=group;runSearch(group)}}});
  document.querySelector('[data-guide-now]')?.addEventListener('click',()=>{guideStart=Math.floor(Date.now()/1800000)*1800000;guideLoadToken++;render()});
  document.querySelectorAll('[data-guide-category]').forEach(el=>el.onclick=()=>{const next=el.dataset.guideCategory||'';if(next===guideCategory)return;guideCategory=next;guideLimit=48;guideError='';guideLoading=false;guideLoadToken++;guideChannelCache.key='';guideChannelCache.items=[];guideChannelCache.total=0;render()});
  document.querySelector('[data-guide-more]')?.addEventListener('click',()=>{guideLimit+=48;guideError='';guideLoadToken++;guideChannelCache.key='';render()});
  document.querySelectorAll('[data-provider-filter]').forEach(el=>el.onclick=()=>{clearPersistentPageViews(['live','guide','movies','series']);providerFilter=el.dataset.providerFilter||'all';viewLimits.live=100;viewLimits.movie=100;viewLimits.series=100;liveRailCategoryLimit=LIVE_RAIL_CATEGORY_BATCH;mediaRailCategoryLimit.movie=MEDIA_RAIL_CATEGORY_BATCH;mediaRailCategoryLimit.series=MEDIA_RAIL_CATEGORY_BATCH;liveRailCache.clear();liveRailRenderLimits.clear();mediaRailCache.clear();mediaRailRenderLimits.clear();mediaRailBrowserFullCache.clear();if(nativeCatalogMode)for(const k of ['live','movie','series'])nativePageCache[k].key='';render()});
  document.querySelectorAll('[data-provider-toggle]').forEach(el=>el.onclick=()=>toggleProviderEnabled(el.dataset.providerToggle));
  document.querySelectorAll('[data-provider-refresh]').forEach(el=>el.onclick=()=>refreshProvider(el.dataset.providerRefresh));
  document.querySelectorAll('[data-provider-edit]').forEach(el=>el.onclick=()=>{const id=el.dataset.providerEdit,p=providerById(id),cfg=providerConfigById(id)||p;if(!p)return;const tab=document.querySelector(`[data-provider-tab="${p.type}"]`);tab?.click();const form=document.querySelector(p.type==='xtream'?'#xtreamForm':'#m3uForm');if(!form)return;const set=(name,value)=>{const input=form.querySelector(`[name="${name}"]`);if(input)input.value=value||''};set('name',p.name);if(p.type==='xtream'){set('server',cfg.server||p.server);set('username',cfg.username||'');set('password',cfg.password||'');set('relayUrl',cfg.relayUrl||p.relayUrl||'');set('relayToken',cfg.relayToken||'')}else{set('url',cfg.url||p.url||'');set('epgUrl',cfg.epgUrl||p.epgUrl||'')}form.scrollIntoView({behavior:'smooth',block:'start'});toast(`Editing ${p.name}`)});
  document.querySelectorAll('[data-provider-remove]').forEach(el=>el.onclick=()=>removeProvider(el.dataset.providerRemove));
  document.querySelectorAll('[data-provider-up]').forEach(el=>el.onclick=()=>moveProvider(el.dataset.providerUp,-1));
  document.querySelectorAll('[data-provider-down]').forEach(el=>el.onclick=()=>moveProvider(el.dataset.providerDown,1));
  document.querySelectorAll('[data-provider-refresh-all]').forEach(el=>el.onclick=()=>refreshAllProviders());
  document.querySelector('[data-action="clear-history"]')?.addEventListener('click',()=>{state.continueWatching=[];persist();render();toast('Continue Watching cleared')});
  document.querySelector('[data-action="clear-viewing"]')?.addEventListener('click',()=>{state.watchHistory=[];persist();render();toast('Recommendation history reset')});
  document.querySelector('[data-action="clear-source-preferences"]')?.addEventListener('click',()=>{state.settings.movieSourcePreferences={};persist();render();toast('Remembered movie source choices cleared')});
  document.querySelector('[data-action="clear-live-favourites"]')?.addEventListener('click',()=>{state.liveFavourites=[];persist();render();toast('Favourite channels cleared')});
  document.querySelectorAll('[data-continue-resume]').forEach(el=>el.onclick=()=>{const item=savedItem(el.dataset.continueResume);modal=null;continueOptionsTarget=null;if(item){if(item.kind==='episode'||item.kind==='live')play(item);else openDetail(item)}else render()});
  document.querySelectorAll('[data-whats-new-done]').forEach(el=>el.onclick=()=>{state.settings.lastWhatsNewVersion=ANDROID_CURRENT_VERSION;modal=null;persist();render()});
  document.querySelectorAll('[data-show-whats-new]').forEach(el=>el.onclick=()=>{androidLatestManifest={version:ANDROID_CURRENT_VERSION,versionCode:834,changes:[...ANDROID_CURRENT_CHANGELOG]};modal='whatsNew';render()});
  document.querySelectorAll('[data-remove-row]').forEach(el=>el.onclick=()=>{const row=state.mdblistRows[Number(el.dataset.removeRow)];if(row)state.settings.homeRows=state.settings.homeRows.filter(id=>id!==`custom:${row.uid}`);state.mdblistRows.splice(Number(el.dataset.removeRow),1);persist('cache');render()});
  const search=document.querySelector('#searchInput');if(search)search.oninput=e=>scheduleSearch(e.target.value);
  document.querySelectorAll('[data-provider-tab]').forEach(el=>el.onclick=()=>{document.querySelectorAll('[data-provider-tab]').forEach(x=>x.classList.toggle('active',x===el));document.querySelector('#m3uForm').hidden=el.dataset.providerTab!=='m3u';document.querySelector('#xtreamForm').hidden=el.dataset.providerTab!=='xtream';document.querySelector('#providerStatus').innerHTML=''});
  document.querySelector('[data-provider-progress-open]')?.addEventListener('click',finishProviderSetup);
  document.querySelector('[data-provider-progress-back]')?.addEventListener('click',providerProgressBack);
  document.querySelector('#homeDiscoveryForm')?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),key=String(fd.get('apiKey')||'').trim();state.settings.mdblistApiKey=key;persist();toast(key?'Custom MDBList key saved':'Custom MDBList key cleared');await refreshDiscoveryRows(true)});
  const bgPicker=document.querySelector('#homeBgColor'),bgHex=document.querySelector('#homeBgHex');
  const setBg=value=>{const c=validHex(value);state.settings.backgroundColor=c;state.settings.backgroundOverride=true;if(bgPicker){bgPicker.value=c;bgPicker.disabled=false}if(bgHex){bgHex.value=c;bgHex.disabled=false}applyTheme();persist()};
  if(bgPicker)bgPicker.oninput=e=>setBg(e.target.value);
  if(bgHex)bgHex.onchange=e=>setBg(e.target.value);
  document.querySelectorAll('[data-active-theme]').forEach(el=>el.onclick=()=>{const t=themeById(el.dataset.activeTheme);state.settings.themeId=t.id;if(!state.settings.backgroundOverride)state.settings.backgroundColor=t.bg;applyTheme();persist();render();toast(`${t.name} theme applied to ${activeProfile()?.name||'this profile'}`)});
  document.querySelector('[data-bg-override]')?.addEventListener('change',e=>{const enable=Boolean(e.target.checked);if(enable&&!state.settings.backgroundOverride)state.settings.backgroundColor=currentTheme().bg;state.settings.backgroundOverride=enable;applyTheme();persist();render()});
  document.querySelector('[data-bg-reset]')?.addEventListener('click',()=>{state.settings.backgroundOverride=false;state.settings.backgroundColor=currentTheme().bg;applyTheme();persist();render();toast(`${currentTheme().name} background restored`)});
  document.querySelector('[data-refresh-discovery]')?.addEventListener('click',()=>refreshDiscoveryRows(true,true));
  document.querySelector('[data-smart-home-toggle]')?.addEventListener('change',e=>{state.settings.smartHomeOrder=Boolean(e.target.checked);persist();render();toast(state.settings.smartHomeOrder?'Smart Home ordering enabled':'Smart Home ordering disabled')});
  document.querySelectorAll('[data-performance-mode]').forEach(el=>el.onclick=()=>{state.settings.performanceMode=el.dataset.performanceMode||'auto';persist();render();toast(state.settings.performanceMode==='cinematic'?'Full cinematic rendering enabled':'Automatic performance mode enabled')});
  document.querySelectorAll('[data-home-toggle]').forEach(el=>el.onclick=()=>{const id=el.dataset.homeToggle;if(PINNED_HOME_ROWS.includes(id))return;const index=state.settings.homeRows.indexOf(id);if(index>=0)state.settings.homeRows.splice(index,1);else state.settings.homeRows.push(id);state.settings.homeRows=normalizeHomeRows(state.settings.homeRows);persist();render()});
  document.querySelectorAll('[data-home-up]').forEach(el=>el.onclick=()=>{const id=el.dataset.homeUp,i=state.settings.homeRows.indexOf(id);if(i>PINNED_HOME_ROWS.length){[state.settings.homeRows[i-1],state.settings.homeRows[i]]=[state.settings.homeRows[i],state.settings.homeRows[i-1]];state.settings.homeRows=normalizeHomeRows(state.settings.homeRows);persist();render()}});
  document.querySelectorAll('[data-home-down]').forEach(el=>el.onclick=()=>{const id=el.dataset.homeDown,i=state.settings.homeRows.indexOf(id);if(!PINNED_HOME_ROWS.includes(id)&&i>=PINNED_HOME_ROWS.length&&i<state.settings.homeRows.length-1){[state.settings.homeRows[i+1],state.settings.homeRows[i]]=[state.settings.homeRows[i],state.settings.homeRows[i+1]];state.settings.homeRows=normalizeHomeRows(state.settings.homeRows);persist();render()}});
  document.querySelector('[data-reset-home]')?.addEventListener('click',()=>{state.settings.homeRows=normalizeHomeRows([...DEFAULT_HOME_ROWS,...state.mdblistRows.map(r=>`custom:${r.uid}`)]);persist();render();toast('Home rows reset')});
  document.querySelector('#m3uForm')?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),file=fd.get('file'),url=String(fd.get('url')||'').trim(),name=String(fd.get('name')||'M3U Provider').trim()||'M3U Provider',epgUrl=String(fd.get('epgUrl')||'').trim(),remember=Boolean(fd.get('remember'));providerProgressStart('m3u',name);try{providerProgressUpdate({step:'read',progress:12,title:`Reading ${name}…`,detail:file&&file.size?'Loading your playlist.':'Loading your playlist.'});let text;if(file&&file.size)text=await file.text();else if(url){if(NATIVE_PLAYBACK)text=await nativeFetchText(url);else{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`Playlist returned HTTP ${r.status}`);text=await r.text()}}else throw new Error('Choose an M3U file or enter a playlist URL.');providerProgressMark('read','Complete');providerProgressUpdate({step:'parse',progress:55,title:'Parsing channels…',detail:'Preparing channels.'});await new Promise(r=>setTimeout(r,40));const providerId=`m3u-${Math.abs(hash(`${url||name}`))}`,cat=parseM3U(text,providerId).filter(x=>!isDemoItem(x));if(!cat.length)throw new Error('No playable entries were found in that M3U playlist.');providerProgressMark('parse',`${cat.length.toLocaleString()} items`);providerProgressUpdate({step:'save',progress:86,title:'Adding provider…',detail:`Saving your library.`});const counts={live:cat.filter(x=>x.kind==='live').length,movie:cat.filter(x=>x.kind==='movie').length,series:cat.filter(x=>x.kind==='series').length};replaceProviderCatalog(providerId,cat);if(NATIVE_WINDOWS){providerProgressUpdate({step:'save',progress:91,title:'Saving your library…',detail:'Saving your provider library.'});await nativeCatalogReplaceProvider(providerId,cat,{onProgress:info=>providerProgressUpdate({step:'save',progress:91+Math.round((info.loaded/Math.max(1,info.total))*6),stepDetail:`${info.loaded.toLocaleString()} / ${info.total.toLocaleString()} saved`})});await activateNativeCatalogIfAvailable();}upsertProviderRecord({id:providerId,type:'m3u',name,url,epgUrl,enabled:true,status:'connected',lastRefreshed:Date.now(),counts});if(remember&&url)saveProviderCredentials({id:providerId,type:'m3u',name,url,epgUrl,enabled:true,priority:providerById(providerId)?.priority??state.providers.length-1,lastRefreshed:Date.now(),counts});else if(url)sessionProviderConfigs.set(providerId,{id:providerId,type:'m3u',name,url,epgUrl});state.mdblistRows.forEach(r=>{r.items=[];r.updatedAt=0;r.error=''});state.webDiscovery={};m3uGuideTextCache.delete(providerId);xtreamGuideTextCache.delete(providerId);guideProviderCategoryCache.key='';guideProviderCategoryCache.names=[];guideChannelCache.key='';guideChannelCache.items=[];await persist(NATIVE_WINDOWS?'cache':true);providerProgressMark('save','Ready');providerProgressSuccess(`${name} added · ${counts.live.toLocaleString()} live · ${counts.movie.toLocaleString()} movies · ${counts.series.toLocaleString()} shows`)}catch(err){providerProgressError(err.message||String(err))}});
  document.querySelector('#xtreamForm')?.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),relayUrl=String(fd.get('relayUrl')||'').trim(),relayToken=String(fd.get('relayToken')||''),name=String(fd.get('name')||'Xtream Provider').trim()||'Xtream Provider',cfg={server:String(fd.get('server')).trim(),username:String(fd.get('username')),password:String(fd.get('password')),relayUrl,relayToken};providerProgressStart('xtream',name);try{providerProgressUpdate({step:'contact',progress:7,title:`Contacting ${name}…`,detail:NATIVE_PLAYBACK?'Connecting to this provider.':relayUrl?'Connecting to this provider.':'Connecting directly to this Xtream server.'});const profile=await testXtream(cfg),expiresAt=providerExpiryFromProfile(profile),expiryNever=!expiresAt&&String(profile?.user_info?.exp_date??'').trim()==='0';providerProgressMark('contact','Reached');providerProgressUpdate({step:'auth',progress:18,title:'Verifying your Xtream login…',detail:'Checking that the account is active and authorised.'});if(String(profile?.user_info?.auth)==='0')throw new Error('Xtream account was not authorised.');providerProgressMark('auth','Authorised');providerProgressUpdate({step:'live',progress:26,title:'Loading this provider library…',detail:'Live TV, Movies and TV Shows are loading. Your existing providers remain available.'});const providerId=`xtream-${Math.abs(hash(`${cfg.server}|${cfg.username}`))}`,completedSections=new Set();const result=await importXtream(cfg,providerId,info=>{if(info?.section){completedSections.add(info.section);providerProgressMark(info.section,`${Number(info.count||0).toLocaleString()} items`);const next=['live','movie','series'].find(x=>!completedSections.has(x))||'save',progress=next==='live'?30:next==='movie'?47:next==='series'?64:80,nextLabel=next==='live'?'Live TV':next==='movie'?'Movies':next==='series'?'TV Shows':'your library';providerProgressUpdate({step:next,progress,title:next==='save'?'Provider loaded — finishing setup…':`Loading ${nextLabel}…`,detail:next==='save'?'Finishing setup.':'The remaining sections are still loading.'})}});if(!result.items.length)throw new Error('Connected, but this provider returned no playable content.');providerProgressUpdate({step:'save',progress:88,title:'Adding provider…',detail:'Saving your library.'});const remember=Boolean(fd.get('remember')),counts=result.counts||{live:result.items.filter(x=>x.kind==='live').length,movie:result.items.filter(x=>x.kind==='movie').length,series:result.items.filter(x=>x.kind==='series').length};replaceProviderCatalog(providerId,result.items);if(NATIVE_WINDOWS){providerProgressUpdate({step:'save',progress:90,title:'Saving your library…',detail:'Saving your provider library.'});await nativeCatalogReplaceProvider(providerId,result.items,{onProgress:info=>providerProgressUpdate({step:'save',progress:90+Math.round((info.loaded/Math.max(1,info.total))*7),stepDetail:`${info.loaded.toLocaleString()} / ${info.total.toLocaleString()} saved`})});await activateNativeCatalogIfAvailable();}upsertProviderRecord({id:providerId,type:'xtream',name,server:cfg.server,connection:NATIVE_WINDOWS?'windows-native':NATIVE_ANDROID?'android-native':relayUrl?'helper':'direct',relayUrl,enabled:true,status:'connected',lastRefreshed:Date.now(),counts,expiresAt,expiryNever});sessionProviderConfigs.set(providerId,{...cfg,id:providerId,type:'xtream',name,expiresAt,expiryNever});if(remember)saveProviderCredentials({id:providerId,type:'xtream',name,...cfg,enabled:true,priority:providerById(providerId)?.priority??state.providers.length-1,lastRefreshed:Date.now(),counts,expiresAt,expiryNever});state.settings.xtreamRelayUrl=relayUrl||state.settings.xtreamRelayUrl;state.settings.xtreamRelayToken=remember&&relayToken?relayToken:state.settings.xtreamRelayToken;state.mdblistRows.forEach(r=>{r.items=[];r.updatedAt=0;r.error=''});state.webDiscovery={};await persist(NATIVE_WINDOWS?'cache':true);providerProgressMark('save','Ready');providerProgressSuccess(`${name} added · ${counts.live.toLocaleString()} live · ${counts.movie.toLocaleString()} movies · ${counts.series.toLocaleString()} shows`)}catch(err){providerProgressError(err.message||String(err))}});
  document.querySelector('#mdblistForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!state.catalog.length){setStatus('#mdbStatus','Connect a TV provider first.','err');return}const fd=new FormData(e.currentTarget),apiKey=String(fd.get('apiKey')||'').trim();try{setStatus('#mdbStatus','Finding titles from this list in your library…');const payload=await getMDBListItems({apiKey,listId:String(fd.get('listId')||'').trim(),username:String(fd.get('username')||'').trim(),listName:String(fd.get('listName')||'').trim()});const matched=nativeCatalogMode?[...cacheNativeItems((await nativeCatalogMatchPayload(payload,'movie',{sourceLimit:300,limit:150,providerIds:nativeEnabledProviderIds()})).items||[]),...cacheNativeItems((await nativeCatalogMatchPayload(payload,'show',{sourceLimit:300,limit:150,providerIds:nativeEnabledProviderIds()})).items||[])]:matchMDBListToCatalog(payload,activeCatalog());state.settings.mdblistApiKey=apiKey;const uid=`mdb-${Date.now()}-${Math.abs(hash(String(fd.get('rowName')||'MDBList')))%10000}`;const source={listId:String(fd.get('listId')||'').trim(),username:String(fd.get('username')||'').trim(),listName:String(fd.get('listName')||'').trim()};state.mdblistRows.push({uid,name:String(fd.get('rowName')||'MDBList'),items:matched,source,updatedAt:Date.now(),error:''});state.settings.homeRows.push(`custom:${uid}`);persist('cache');setStatus('#mdbStatus',`Added ${matched.length} matching titles to Home.`,'ok');setTimeout(()=>{modal=null;state.page='home';render()},650)}catch(err){setStatus('#mdbStatus',err.message||String(err),'err')}});
}


window.__swoopHandleAndroidBack=()=>{
  if(trailerKey){trailerKey='';trailerTitle='';render();return true}
  if(playerItem){closePlayer();return true}
  if(sourceChoiceItem){sourceChoiceItem=null;render();return true}
  if(personView){closePerson();return true}
  if(detailItem){closeDetail();return true}
  if(modal){modal=null;render();return true}
  if(state.page!=='home'){state.page='home';render();return true}
  return false
};
window.addEventListener('swoop-native-return',e=>{
  const pb=e?.detail||{};
  if(playerItem?.kind!=='live')updateContinueProgress(playerItem,pb,true);
  stopPlaybackMonitor();clearUpNext();playerItem=null;playerUiHidden=false;render();
});
window.addEventListener('swoop-native-ended',e=>{
  const pb={...(e?.detail||{}),eofReached:true};const item=playerItem;
  if(item?.kind!=='live')updateContinueProgress(item,pb,true);
  stopPlaybackMonitor();if(item)handlePlaybackFinished(item);
});
window.addEventListener('swoop-native-error',e=>{
  const item=playerItem,message=e?.detail?.message||'Playback could not start.';
  stopPlaybackMonitor();
  if(item?.kind==='movie'&&Array.isArray(item.sources)&&item.sources.length>1){autoFallbackSource(item).then(ok=>{if(!ok)setPlayerMessage(message,true)}).catch(()=>setPlayerMessage(message,true));return}
  setPlayerMessage(message,true);
});

let tvFocusMemory=null;
function tvModalRoot(){return NATIVE_ANDROID&&modal?document.querySelector('.modal-backdrop'):null}
function tvFocusableElements(){
  const selector='button:not([disabled]):not([hidden]),a[href],[tabindex]:not([tabindex="-1"]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary';
  const root=tvModalRoot()||document;
  return [...root.querySelectorAll(selector)].filter(el=>{
    if(el.offsetParent===null||el.tabIndex<0||el.hidden||el.getAttribute('aria-hidden')==='true')return false;
    return el.getClientRects().length>0&&el.offsetWidth>0&&el.offsetHeight>0;
  });
}
function tvFocusSignature(el){
  if(!el||el===document.body||el===document.documentElement)return null;
  if(el.id)return {id:el.id};
  const attrs=el.getAttributeNames?.().filter(name=>name.startsWith('data-'))||[];
  for(const name of attrs){
    const value=el.getAttribute(name);
    if(value&&value.length<180)return {attr:name,value,tag:el.tagName};
  }
  const text=(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,100);
  return text?{text,tag:el.tagName}:null;
}
function rememberTvFocus(){
  if(!NATIVE_ANDROID)return;
  const el=document.activeElement;
  if(el&&el.offsetParent!==null)tvFocusMemory=tvFocusSignature(el);
}
function restoreTvFocus(){
  if(!NATIVE_ANDROID)return;
  const focusables=tvFocusableElements();if(!focusables.length)return;
  let target=null,m=tvFocusMemory,modalRoot=tvModalRoot();
  if(modalRoot){
    if(m?.id){const found=document.getElementById(m.id);if(found&&modalRoot.contains(found))target=found}
    if(!target&&m?.attr)target=focusables.find(el=>el.tagName===m.tag&&el.getAttribute(m.attr)===m.value);
    if(!target&&m?.text)target=focusables.find(el=>el.tagName===m.tag&&(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,100)===m.text);
    if(!target)target=modalRoot.querySelector('[data-whats-new-done],.btn.accent,[data-close],button:not([disabled])')||focusables[0];
    if(target)setTimeout(()=>{try{target.focus({preventScroll:true})}catch{target.focus()}},0);
    return;
  }
  if(m?.id)target=document.getElementById(m.id);
  if(!target&&m?.attr){target=focusables.find(el=>el.tagName===m.tag&&el.getAttribute(m.attr)===m.value)}
  if(!target&&m?.text){target=focusables.find(el=>el.tagName===m.tag&&(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,100)===m.text)}
  if(target&&target.offsetParent!==null)setTimeout(()=>{try{target.focus({preventScroll:true})}catch{target.focus()}},0);
}
function tvInitialFocus(focusables){
  return focusables.find(el=>el.matches('.nav-btn.active,[aria-current="page"]'))||
    focusables.find(el=>el.matches('.hero-actions button,.detail-actions button,.provider-primary'))||focusables[0]||null;
}
const TV_HOME_TOP_NAV_SCROLL_THRESHOLD=18;
function tvIsTopNavigationElement(el){return Boolean(el?.closest?.('.topbar'))}
function tvHomeIsAtTop(){return (window.scrollY||document.documentElement.scrollTop||0)<=TV_HOME_TOP_NAV_SCROLL_THRESHOLD}
function tvScrollHomeUpOneViewport(){
  const y=window.scrollY||document.documentElement.scrollTop||0;if(y<=0)return false;
  window.scrollBy({top:-Math.min(y,Math.max(180,Math.round(window.innerHeight*.58))),behavior:'auto'});
  return true;
}
function tvSpatialTarget(current,key,focusables){
  const from=current.getBoundingClientRect(),fx=(from.left+from.right)/2,fy=(from.top+from.bottom)/2;
  const horizontal=key==='ArrowLeft'||key==='ArrowRight',positive=key==='ArrowRight'||key==='ArrowDown';
  let best=null,bestScore=Infinity;
  for(const el of focusables){
    if(el===current)continue;const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
    const tx=(r.left+r.right)/2,ty=(r.top+r.bottom)/2,dx=tx-fx,dy=ty-fy;
    const primary=horizontal?dx:dy,secondary=horizontal?dy:dx;
    if(positive?primary<=4:primary>=-4)continue;
    const p=Math.abs(primary),s=Math.abs(secondary);
    const overlap=horizontal?(r.bottom>from.top+2&&r.top<from.bottom-2):(r.right>from.left+2&&r.left<from.right-2);
    const angle=s/Math.max(1,p);
    const score=p+s*(horizontal?3.2:2.15)+angle*90+(overlap?0:75);
    if(score<bestScore){bestScore=score;best=el}
  }
  return best;
}
function expandAndroidHomeRail(current,key){
  if(!NATIVE_ANDROID||state.page!=='home'||key!=='ArrowRight'||!current)return false;
  const section=current.closest?.('[data-home-row-mounted]'),rail=current.closest?.('.rail');
  if(!section||!rail)return false;
  const rowId=String(section.dataset.homeRowMounted||'');if(!rowId||rowId==='continue')return false;
  const rendered=rail.children.length,total=Number(section.dataset.homeRowTotal||0);
  if(!total||rendered>=total)return false;
  const children=[...rail.children],pos=children.indexOf(current.closest('.card')||current);
  if(pos<Math.max(0,rendered-24))return false;
  const def=homeRowDef(rowId),data=homeRowItems(rowId),end=Math.min(data.length,rendered+ANDROID_TV_HOME_EXPAND_CHUNK);
  if(end<=rendered)return false;
  const ranked=Boolean(def?.ranked),poster=def?.poster!==false;
  const html=data.slice(rendered,end).map((item,i)=>card(item,poster,{progress:continueEntry(item.id)?.progress,rank:ranked?rendered+i+1:null})).join('');
  rail.insertAdjacentHTML('beforeend',html);section.dataset.homeRowTotal=String(data.length);
  hydrateArtwork(rail);hydrateVisibleImdbRatings(rail);bindDynamicCards(rail);bindRailStability(section);
  return true;
}
function longRailAppend(current){
  const track=current?.closest?.('[data-long-rail]');if(!track)return false;
  const type=track.dataset.longRail,rendered=track.querySelectorAll(':scope > button,:scope > .card,:scope > .continue-card-shell').length;
  if(type==='media'){
    const kind=track.dataset.longRailKind||'movie',category=track.dataset.longRailCategory||'',key=mediaRailKey(kind,category);let snap=mediaRailSnapshot(kind,category);
    if(rendered>=snap.items.length-LONG_RAIL_PREFETCH_THRESHOLD&&snap.items.length<Number(snap.total||0)){prefetchMediaRail(kind,category);snap=mediaRailSnapshot(kind,category)}
    const end=Math.min(snap.items.length,rendered+LONG_RAIL_RENDER_CHUNK);if(end<=rendered)return false;
    track.insertAdjacentHTML('beforeend',snap.items.slice(rendered,end).map(x=>card(x,true)).join(''));mediaRailRenderLimits.set(key,end);track.dataset.longRailLoaded=String(snap.items.length);track.dataset.longRailTotal=String(snap.total||snap.items.length);hydrateArtwork(track);hydrateVisibleImdbRatings(track);bindDynamicCards(track);return true;
  }
  if(type==='live'){
    const category=track.dataset.longRailCategory||'',key=liveRailKey(category);let snap=liveRailSnapshot(category);
    if(rendered>=snap.items.length-LONG_RAIL_PREFETCH_THRESHOLD&&snap.items.length<Number(snap.total||0)){prefetchLiveRail(category);snap=liveRailSnapshot(category)}
    const end=Math.min(snap.items.length,rendered+LONG_RAIL_RENDER_CHUNK);if(end<=rendered)return false;
    track.insertAdjacentHTML('beforeend',snap.items.slice(rendered,end).map(liveRailCard).join(''));liveRailRenderLimits.set(key,end);track.dataset.longRailLoaded=String(snap.items.length);track.dataset.longRailTotal=String(snap.total||snap.items.length);hydrateArtwork(track);bindDynamicCards(track);return true;
  }
  return false;
}
function tvPrefetchArtworkWindow(current,ahead=28,behind=3){
  const cardEl=current?.closest?.('.card,.live-rail-card');if(!cardEl)return;const rail=cardEl.parentElement;if(!rail)return;let cards=[...rail.querySelectorAll(':scope > .card,:scope > .live-rail-card,:scope > .continue-card-shell > .card')],index=cards.indexOf(cardEl);if(index<0)return;
  if(NATIVE_ANDROID&&state.page==='home'&&index>=Math.max(0,cards.length-24)){expandAndroidHomeRail(cardEl,'ArrowRight');cards=[...rail.querySelectorAll(':scope > .card,:scope > .live-rail-card,:scope > .continue-card-shell > .card')];index=cards.indexOf(cardEl)}
  const start=Math.max(0,index-Math.max(0,behind)),end=Math.min(cards.length,index+Math.max(8,ahead)+1);for(const el of cards.slice(start,end)){for(const img of el.querySelectorAll('img[data-swoop-art]'))if(img.dataset.swoopLoaded!=='1')loadArtwork(img,{priority:'high'})}
}
function longRailPrefetchForFocus(current){
  const track=current?.closest?.('[data-long-rail]');if(!track)return;const cards=[...track.querySelectorAll(':scope > button,:scope > .card')],index=cards.indexOf(current.closest?.('button,.card')||current);if(index<0)return;
  if(index>=Math.max(0,cards.length-10))longRailAppend(current);
  if(track.dataset.longRail==='media'){
    const kind=track.dataset.longRailKind||'movie',category=track.dataset.longRailCategory||'',snap=mediaRailSnapshot(kind,category);if(index>=Math.max(0,snap.items.length-LONG_RAIL_PREFETCH_THRESHOLD))prefetchMediaRail(kind,category);
  }else if(track.dataset.longRail==='live'){
    const category=track.dataset.longRailCategory||'',snap=liveRailSnapshot(category);if(index>=Math.max(0,snap.items.length-LONG_RAIL_PREFETCH_THRESHOLD))prefetchLiveRail(category);
  }
}
function tvRailSection(el){return el?.closest?.('[data-home-row-mounted],.media-category-section,.live-category-section,.live-hub-content>.section,.myswoop-content>.section,.starmeter-person-section')||null}
function tvRailCards(section){
  if(!section)return[];return [...section.querySelectorAll('.rail > .card,.rail > .continue-card-shell > .card,.media-category-rail-track > .card,.live-category-rail-track > .live-rail-card,.starmeter-title-rail > .card')].filter(el=>el.offsetParent!==null);
}
function tvRailSectionKey(section){return section?.dataset?.homeRowMounted?`home:${section.dataset.homeRowMounted}`:section?.dataset?.mediaRailCategory?`media:${section.dataset.mediaRailKind||''}:${section.dataset.mediaRailCategory}`:section?.dataset?.liveRailCategory?`live:${section.dataset.liveRailCategory}`:`section:${[...document.querySelectorAll('.live-hub-content>.section')].indexOf(section)}`}
function tvPageRailSections(){
  if(state.page==='home')return tvHomeMountedSectionsWithCards();
  if(state.page==='myswoop')return [...document.querySelectorAll('.myswoop-content>.section')].filter(x=>x.offsetParent!==null&&tvRailCards(x).length);
  if(state.page==='movies'||state.page==='series')return [...document.querySelectorAll('.media-category-section')].filter(x=>x.offsetParent!==null&&tvRailCards(x).length);
  if(state.page==='live')return [...document.querySelectorAll('.live-hub-content>.section,.live-category-section')].filter((x,i,a)=>x.offsetParent!==null&&tvRailCards(x).length&&a.indexOf(x)===i);
  if(state.page==='starmeter')return [...document.querySelectorAll('.starmeter-person-section')].filter(x=>x.offsetParent!==null&&tvRailCards(x).length);
  return [];
}
let tvRailAdvancePending=false;
async function tvAdvanceLongRailRight(current){
  if(tvRailAdvancePending||!current?.isConnected)return false;const track=current.closest?.('[data-long-rail]');if(!track)return false;tvRailAdvancePending=true;
  try{
    const before=tvRailCards(tvRailSection(current)),index=before.indexOf(current.closest?.('.card,.live-rail-card')||current);if(index<0)return false;
    if(track.dataset.longRail==='media'){const kind=track.dataset.longRailKind||'movie',category=track.dataset.longRailCategory||'';await prefetchMediaRail(kind,category);longRailAppend(current)}
    else if(track.dataset.longRail==='live'){const category=track.dataset.longRailCategory||'';await prefetchLiveRail(category);longRailAppend(current)}
    const after=tvRailCards(tvRailSection(current)),freshIndex=after.indexOf(current.closest?.('.card,.live-rail-card')||current),next=freshIndex>=0?after[freshIndex+1]:after[index+1];if(next){tvHomeFocus(next,'nearest');return true}return false;
  }finally{tvRailAdvancePending=false}
}
function tvTopbarDirectionalTarget(current,key){
  if(!tvIsTopNavigationElement(current)||(key!=='ArrowLeft'&&key!=='ArrowRight'))return null;const controls=[...document.querySelectorAll('.topbar .brand,.topbar .desktop-nav .nav-btn,.topbar .top-actions button')].filter(el=>el.offsetParent!==null&&!el.disabled),index=controls.indexOf(current.closest('button'));if(index<0)return null;return controls[index+(key==='ArrowRight'?1:-1)]||null;
}
function tvTopbarDownTarget(current){
  if(!tvIsTopNavigationElement(current))return null;const page=String(current?.dataset?.page||state.page||'');
  if(page==='search')return document.querySelector('#searchInput');
  if(page==='home')return tvHomeHeroAction();
  if(page==='myswoop')return document.querySelector('.myswoop-content .card,.myswoop-content .live-rail-card');
  if(page==='live')return document.querySelector('.live-hub-copy .btn');
  if(page==='movies'||page==='series')return document.querySelector('.media-category-page .page-hero .btn');
  if(page==='guide')return document.querySelector('.guide-page [data-guide-category],.guide-page button');
  if(page==='starmeter')return document.querySelector('.starmeter-person-card,.starmeter-title-rail .card');
  if(page==='mylist'||page==='myswoop')return document.querySelector('.myswoop-page .card,.myswoop-page .live-rail-card');
  return document.querySelector('main button,main input,main .card');
}
function tvGenericRailDirectionalTarget(current,key){
  const card=current?.closest?.('.card,.live-rail-card'),section=tvRailSection(card);if(!card||!section)return null;
  let cards=tvRailCards(section),index=cards.indexOf(card);if(index<0)return null;
  if(key==='ArrowLeft')return index>0?cards[index-1]:null;
  if(key==='ArrowRight'){
    if(index>=Math.max(0,cards.length-16)){longRailAppend(card);longRailPrefetchForFocus(card)}cards=tvRailCards(section);index=cards.indexOf(card);
    return index>=0&&index<cards.length-1?cards[index+1]:null;
  }
  if(key!=='ArrowUp'&&key!=='ArrowDown')return null;
  const sections=tvPageRailSections(),sectionIndex=sections.indexOf(section),next=sections[sectionIndex+(key==='ArrowDown'?1:-1)];if(!next)return null;
  const nextCards=tvRailCards(next);if(!nextCards.length)return null;
  const r=card.getBoundingClientRect(),cx=(r.left+r.right)/2;
  return nextCards.reduce((best,el)=>{const b=el.getBoundingClientRect(),d=Math.abs(((b.left+b.right)/2)-cx);return !best||d<best.d?{el,d}:best},null)?.el||nextCards[0];
}
function tvQueueVerticalMove(key){
  const delta=key==='ArrowDown'?1:-1;tvVerticalQueue=Math.max(-14,Math.min(14,tvVerticalQueue+delta));if(tvVerticalFrame)return true;
  const pump=()=>{tvVerticalFrame=0;if(!tvVerticalQueue)return;const step=tvVerticalQueue>0?'ArrowDown':'ArrowUp';tvVerticalQueue+=tvVerticalQueue>0?-1:1;tvMoveFocus(step);if(tvVerticalQueue)tvVerticalFrame=requestAnimationFrame(pump)};
  tvVerticalFrame=requestAnimationFrame(pump);return true;
}

function tvHomeSectionCards(section){return [...(section?.querySelectorAll?.('.rail > .card,.rail > .continue-card-shell > .card')||[])].filter(el=>el.offsetParent!==null)}
function tvHomeMountedSectionsWithCards(){return [...document.querySelectorAll('[data-home-row-mounted]')].filter(el=>el.offsetParent!==null&&tvHomeSectionCards(el).length)}
function tvHomeFirstMountedSection(){return tvHomeMountedSectionsWithCards()[0]||null}
function tvHomeHeroAction(){return [...document.querySelectorAll('.hero-actions button')].find(el=>el.offsetParent!==null)||null}
function tvHomeRailDirectionalTarget(current,key){
  const card=current?.closest?.('.card'),section=card?.closest?.('[data-home-row-mounted]');if(!card||!section)return null;
  let cards=tvHomeSectionCards(section),index=cards.indexOf(card);if(index<0)return null;
  if(key==='ArrowLeft')return index>0?cards[index-1]:null;
  if(key==='ArrowRight'){
    if(index>=Math.max(0,cards.length-10))expandAndroidHomeRail(card,key);cards=tvHomeSectionCards(section);index=cards.indexOf(card);
    return index>=0&&index<cards.length-1?cards[index+1]:null;
  }
  if(key!=='ArrowUp'&&key!=='ArrowDown')return null;
  let sections=tvHomeMountedSectionsWithCards(),sectionIndex=sections.indexOf(section);
  if(key==='ArrowDown'&&sectionIndex===sections.length-1&&mountNextAndroidHomeRows(1)){sections=tvHomeMountedSectionsWithCards();sectionIndex=sections.indexOf(section)}
  const nextSection=sections[sectionIndex+(key==='ArrowDown'?1:-1)];if(!nextSection)return null;
  const nextCards=tvHomeSectionCards(nextSection);if(!nextCards.length)return null;
  const r=card.getBoundingClientRect(),cx=(r.left+r.right)/2;
  return nextCards.reduce((best,el)=>{const b=el.getBoundingClientRect(),d=Math.abs(((b.left+b.right)/2)-cx);return !best||d<best.d?{el,d}:best},null)?.el||nextCards[0];
}
function tvForceRouteTop(){
  if(!NATIVE_ANDROID)return false;const reset=()=>{try{window.scrollTo(0,0)}catch{}document.documentElement.scrollTop=0;document.body.scrollTop=0};reset();requestAnimationFrame(()=>{reset();requestAnimationFrame(reset)});return true
}
function tvHomeFocus(target,block='nearest'){
  if(!target)return false;rememberTvFocus();
  const preserveTop=NATIVE_ANDROID&&Boolean(target.closest?.('.topbar')||(state.page==='home'&&target.closest?.('.hero')));
  if(preserveTop)tvForceRouteTop();
  try{target.focus({preventScroll:true})}catch{target.focus()}
  if(!preserveTop)target.scrollIntoView({behavior:'auto',block,inline:'nearest'});
  tvFocusMemory=tvFocusSignature(target);return true
}
function tvNearestByX(elements=[],from){if(!elements.length)return null;if(!from)return elements[0];const r=from.getBoundingClientRect(),cx=(r.left+r.right)/2;return elements.reduce((best,el)=>{const b=el.getBoundingClientRect(),d=Math.abs(((b.left+b.right)/2)-cx);return !best||d<best.d?{el,d}:best},null)?.el||elements[0]}
function tvStarmeterDirectionalTarget(current,key){
  if(state.page!=='starmeter')return null;const section=current?.closest?.('.starmeter-person-section'),person=current?.closest?.('.starmeter-person-card'),card=current?.closest?.('.starmeter-title-rail .card');if(!section)return null;
  const sections=[...document.querySelectorAll('.starmeter-person-section')].filter(x=>x.offsetParent!==null),idx=sections.indexOf(section),titles=tvRailCards(section),personButton=section.querySelector('.starmeter-person-card');
  if(person){if(key==='ArrowRight')return titles[0]||null;if(key==='ArrowUp'){if(idx<=0)return document.querySelector('.desktop-nav [data-page="starmeter"]');return sections[idx-1]?.querySelector('.starmeter-person-card')||null}if(key==='ArrowDown'){if(idx===sections.length-1&&starmeterVisibleCount<starmeterPeople.length)appendStarmeterSections(STARMETER_APPEND_BATCH);const fresh=[...document.querySelectorAll('.starmeter-person-section')].filter(x=>x.offsetParent!==null);return fresh[idx+1]?.querySelector('.starmeter-person-card')||null}}
  if(card){const pos=titles.indexOf(card);if(key==='ArrowLeft'&&pos<=0)return personButton;if(key==='ArrowUp'||key==='ArrowDown'){const delta=key==='ArrowDown'?1:-1;if(key==='ArrowDown'&&idx===sections.length-1&&starmeterVisibleCount<starmeterPeople.length)appendStarmeterSections(STARMETER_APPEND_BATCH);const fresh=[...document.querySelectorAll('.starmeter-person-section')].filter(x=>x.offsetParent!==null),target=fresh[idx+delta];if(!target)return key==='ArrowUp'&&idx===0?document.querySelector('.desktop-nav [data-page="starmeter"]'):null;const targetTitles=tvRailCards(target);return tvNearestByX(targetTitles,card)||target.querySelector('.starmeter-person-card')}}
  return null;
}
function tvDetailDirectionalTarget(current,key){
  const detail=current?.closest?.('.detail-route'),person=current?.closest?.('.person-route');if(!detail&&!person)return null;
  if(person){const close=person.querySelector('[data-person-close]'),cards=[...person.querySelectorAll('.person-results .card')].filter(x=>x.offsetParent!==null);if(key==='ArrowUp'&&cards.includes(current.closest?.('.card'))){const firstY=Math.min(...cards.map(x=>x.getBoundingClientRect().top));if(current.getBoundingClientRect().top<=firstY+8)return close}if(key==='ArrowDown'&&current===close)return cards[0]||null;return null}
  const close=detail.querySelector('[data-detail-close]'),hero=[...detail.querySelectorAll('.detail-copy .cta-row button')].filter(x=>x.offsetParent!==null),seasons=[...detail.querySelectorAll('.season-pills button')].filter(x=>x.offsetParent!==null),episodes=[...detail.querySelectorAll('.episode-card')].filter(x=>x.offsetParent!==null),cast=[...detail.querySelectorAll('.cast-card')].filter(x=>x.offsetParent!==null),related=[...detail.querySelectorAll('.detail-related .card')].filter(x=>x.offsetParent!==null),curEpisode=current.closest?.('.episode-card'),curSeason=current.closest?.('.season-pills button'),curCast=current.closest?.('.cast-card'),curRelated=current.closest?.('.detail-related .card');
  if(curEpisode){const i=episodes.indexOf(curEpisode);if(key==='ArrowDown')return episodes[i+1]||tvNearestByX(cast,curEpisode)||tvNearestByX(related,curEpisode);if(key==='ArrowUp')return episodes[i-1]||tvNearestByX(seasons,curEpisode)||tvNearestByX(hero,curEpisode)}
  if(curSeason){if(key==='ArrowDown')return tvNearestByX(episodes,curSeason)||tvNearestByX(cast,curSeason);if(key==='ArrowUp')return tvNearestByX(hero,curSeason)}
  if(hero.includes(current)){if(key==='ArrowDown')return tvNearestByX(seasons,current)||tvNearestByX(episodes,current)||tvNearestByX(cast,current);if(key==='ArrowUp')return close}
  if(curCast){if(key==='ArrowUp')return episodes.at(-1)||tvNearestByX(seasons,curCast)||tvNearestByX(hero,curCast);if(key==='ArrowDown')return tvNearestByX(related,curCast)}
  if(curRelated&&key==='ArrowUp')return tvNearestByX(cast,curRelated)||episodes.at(-1)||tvNearestByX(seasons,curRelated)||tvNearestByX(hero,curRelated);
  if(current===close&&key==='ArrowDown')return hero[0]||seasons[0]||episodes[0]||cast[0]||related[0]||null;
  return null;
}
function tvMoveFocus(key){
  let focusables=tvFocusableElements();if(!focusables.length)return false;
  let current=document.activeElement;
  if(!focusables.includes(current)){const first=tvInitialFocus(focusables);if(first){first.focus();first.scrollIntoView({block:'nearest',inline:'nearest'});return true}return false}
  if(NATIVE_ANDROID){const topbarTarget=tvTopbarDirectionalTarget(current,key);if(topbarTarget)return tvHomeFocus(topbarTarget,'nearest');if(key==='ArrowDown'&&tvIsTopNavigationElement(current)){const down=tvTopbarDownTarget(current);if(down)return tvHomeFocus(down,'nearest')}}
  if(NATIVE_ANDROID&&(detailItem||personView)){
    const routeTarget=tvDetailDirectionalTarget(current,key);if(routeTarget)return tvHomeFocus(routeTarget,key==='ArrowUp'?'start':'nearest');
  }
  if(NATIVE_ANDROID&&state.page==='starmeter'){
    const starTarget=tvStarmeterDirectionalTarget(current,key);if(starTarget)return tvHomeFocus(starTarget,key==='ArrowUp'?'start':'nearest');
  }
  if(NATIVE_ANDROID&&state.page==='home'){
    const heroAction=tvHomeHeroAction(),firstSection=tvHomeFirstMountedSection(),currentSection=current.closest?.('[data-home-row-mounted]');
    if(key==='ArrowUp'&&firstSection&&currentSection===firstSection&&heroAction)return tvHomeFocus(heroAction,'start');
    if(key==='ArrowDown'&&tvIsTopNavigationElement(current)&&heroAction)return tvHomeFocus(heroAction,'start');
    if(key==='ArrowDown'&&current.closest?.('.hero-actions')&&firstSection){const firstCard=firstSection.querySelector('.card,button');if(firstCard)return tvHomeFocus(firstCard,'nearest')}
    const railTarget=tvHomeRailDirectionalTarget(current,key);if(railTarget)return tvHomeFocus(railTarget,'nearest');
    if((key==='ArrowLeft'||key==='ArrowRight')&&currentSection)return true;
  }
  if(NATIVE_ANDROID&&['myswoop','movies','series','live','starmeter'].includes(state.page)){
    const railTarget=tvGenericRailDirectionalTarget(current,key);if(railTarget)return tvHomeFocus(railTarget,'nearest');
    if(key==='ArrowRight'&&tvRailSection(current)){tvAdvanceLongRailRight(current);return true}
    if((key==='ArrowLeft'||key==='ArrowRight')&&tvRailSection(current))return true;
    const sections=tvPageRailSections(),first=sections[0],currentSection=tvRailSection(current);
    if(key==='ArrowUp'&&first&&currentSection===first){const heroAction=document.querySelector('.page-hero .btn,.live-hub-hero .btn');if(heroAction)return tvHomeFocus(heroAction,'nearest');const routeTab=document.querySelector(`.desktop-nav [data-page="${CSS.escape(state.page)}"]`);if(routeTab)return tvHomeFocus(routeTab,'start')}
  }
  const scrollFirstHomeUp=NATIVE_ANDROID&&state.page==='home'&&key==='ArrowUp'&&!tvHomeIsAtTop()&&!tvIsTopNavigationElement(current);
  if(scrollFirstHomeUp)focusables=focusables.filter(el=>!tvIsTopNavigationElement(el));
  let target=tvSpatialTarget(current,key,focusables);
  if(!target&&NATIVE_ANDROID&&state.page==='home'&&key==='ArrowDown'&&mountNextAndroidHomeRows(2)){
    focusables=tvFocusableElements();target=tvSpatialTarget(current,key,focusables);
  }
  if(!target&&scrollFirstHomeUp)return tvScrollHomeUpOneViewport();
  if(!target)return false;
  if(NATIVE_ANDROID&&tvIsTopNavigationElement(target))return tvHomeFocus(target,'start');
  rememberTvFocus();
  try{target.focus({preventScroll:true})}catch{target.focus()}
  target.scrollIntoView({behavior:NATIVE_ANDROID?'auto':'smooth',block:'nearest',inline:'nearest'});
  tvFocusMemory=tvFocusSignature(target);
  return true;
}


function appendLiveCategorySections(count=LIVE_RAIL_CATEGORY_BATCH){const browser=document.querySelector('.live-category-browser'),sentinel=browser?.querySelector('[data-live-category-sentinel]');if(!browser||!sentinel)return false;const cats=liveRailCategories(),start=liveRailCategoryLimit,end=Math.min(cats.length,start+Math.max(1,Number(count||LIVE_RAIL_CATEGORY_BATCH)));if(end<=start)return false;const wrap=document.createElement('div');wrap.innerHTML=cats.slice(start,end).map(liveCategoryRailMarkup).join('');const nodes=[...wrap.children];for(const node of nodes)browser.insertBefore(node,sentinel);liveRailCategoryLimit=end;for(const node of nodes){hydrateArtwork(node);bindDynamicCards(node)}primeLiveCategoryRails();if(end>=cats.length)sentinel.remove();return true}
function setupLiveCategoryAutoLoad(){
  if(state.page!=='live')return;const sentinel=document.querySelector('[data-live-category-sentinel]');if(!sentinel)return;const total=liveRailCategories().length;if(liveRailCategoryLimit>=total){sentinel.remove();return}
  if('IntersectionObserver'in globalThis){const obs=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;obs.disconnect();appendLiveCategorySections(LIVE_RAIL_CATEGORY_BATCH);setupLiveCategoryAutoLoad()},{root:null,rootMargin:'650px 0px',threshold:.01});obs.observe(sentinel)}
}
function maybeAutoLoadGuideFromFocus(el){
  if(!NATIVE_ANDROID||state.page!=='guide'||guideAutoLoadPending)return;const row=el?.closest?.('[data-guide-row]');if(!row)return;
  const rows=[...document.querySelectorAll('[data-guide-row]')],index=rows.indexOf(row),snapshot=guideChannelSnapshot();if(index<0||index<rows.length-8||snapshot.items.length>=Number(snapshot.total||0))return;
  guideAutoLoadPending=true;const focusId=row.dataset.guideRow||'';guideLimit+=48;guideError='';guideLoadToken++;guideChannelCache.key='';
  setTimeout(async()=>{try{await ensureGuideChannels({force:true});if(state.page==='guide'){render();requestAnimationFrame(()=>{const target=[...document.querySelectorAll('[data-guide-row]')].find(x=>x.dataset.guideRow===focusId)?.querySelector('button');target?.focus?.({preventScroll:true})})}}finally{guideAutoLoadPending=false}},0);
}

document.addEventListener('focusin',e=>{
  if(!NATIVE_ANDROID)return;
  const el=e.target;
  if(el&&el instanceof HTMLElement){
    document.querySelector('[data-swoop-tv-focused="1"]')?.removeAttribute('data-swoop-tv-focused');
    el.dataset.swoopTvFocused='1';tvLastFocusedElement=el;tvDiagRecord('focus',{focus:tvDiagnosticElement(el)});
    const section=tvRailSection(el),cards=tvRailCards(section),card=el.closest?.('.card,.live-rail-card');if(section&&card){const index=cards.indexOf(card);if(index>=0)tvRowColumnMemory.set(tvRailSectionKey(section),index);tvPrefetchArtworkWindow(card,state.page==='home'?32:24,4);longRailPrefetchForFocus(card)}
    if((detailItem||personView)&&el.closest?.('[data-detail-close],[data-person-close]')){const scroller=document.querySelector(detailItem?'.detail-scroll':'.person-scroll');if(scroller)scroller.scrollTop=0}
    if(state.page==='live'){const playEl=el.closest?.('[data-play]'),item=playEl?savedItem(playEl.dataset.play):null;if(item?.kind==='live'){patchLiveHeroFocusedChannel(item);scheduleLiveHeroPreview(item,450)}}
    if(state.page==='starmeter'){const personSection=el.closest?.('[data-starmeter-rank]'),rank=Number(personSection?.dataset?.starmeterRank||0),idx=rank?starmeterPeople.findIndex(x=>Number(x.rank)===rank):-1;if(idx>=0){queueStarmeterPerson(starmeterPeople[idx],{priority:true});for(let ahead=1;ahead<=STARMETER_PREFETCH_AHEAD;ahead++){const next=starmeterPeople[idx+ahead];if(next)queueStarmeterPerson(next,{priority:ahead<=6})}}}
    if(state.page==='guide')maybeAutoLoadGuideFromFocus(el);
  }
},true);
document.addEventListener('click',()=>{if(NATIVE_ANDROID)tvLastActivationAt=performance.now()},true);

window.__swoopTvFocusedSupportsLongPress=()=>{
  if(!NATIVE_ANDROID)return false;
  const active=(document.activeElement&&document.activeElement!==document.body)?document.activeElement:tvLastFocusedElement;
  return Boolean(active?.closest?.('[data-continue-options-id]'));
};
window.__swoopTvLongPressFocused=()=>{
  if(!NATIVE_ANDROID)return false;
  const active=(document.activeElement&&document.activeElement!==document.body)?document.activeElement:tvLastFocusedElement;
  const shell=active?.closest?.('[data-continue-options-id]');if(!shell)return false;
  continueOptionsTarget={id:String(shell.dataset.continueOptionsId||''),seriesId:String(shell.dataset.continueOptionsSeries||'')};
  modal='continueOptions';render();return true;
};

window.__swoopTvActivateFocused=(source='')=>{
  if(!NATIVE_ANDROID)return false;
  const now=performance.now();
  if(now-tvLastActivationAt<160)return true;
  let active=document.activeElement;
  if(!active||active===document.body||active===document.documentElement||!active.isConnected)active=tvLastFocusedElement;
  if(!active||!active.isConnected)active=document.querySelector('[data-swoop-tv-focused="1"]');
  if(!active||!active.isConnected)return false;
  active=active.closest?.('button,a,input,select,textarea,[role="button"],[tabindex]')||active;
  tvLastFocusedElement=active;tvLastActivationAt=now;tvDiagRecord('activate',{source,focus:tvDiagnosticElement(active)});
  if(active.matches?.('[data-profile-select]')){
    const id=active.dataset.profileSelect;
    if(id){Promise.resolve(switchProfile(id)).catch(()=>{});return true}
  }
  if(active.matches?.('[data-profile-pin-input]')&&active.readOnly)return true;
  try{
    if(typeof active.click==='function'){active.click();return true}
    active.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return true;
  }catch{return false}
};

if(NATIVE_ANDROID){
  window.addEventListener('error',e=>{const info={at:Date.now(),page:state.page,message:String(e?.message||'error'),source:String(e?.filename||''),line:Number(e?.lineno||0)};tvDiagRecord('error',info);try{sessionStorage.setItem('swoop-tv-last-runtime-error',JSON.stringify(info));sessionStorage.setItem('swoop-tv-last-route',state.page||'home')}catch{}},true);
  window.addEventListener('unhandledrejection',e=>{const info={at:Date.now(),page:state.page,message:String(e?.reason?.message||e?.reason||'rejection')};tvDiagRecord('rejection',info);try{sessionStorage.setItem('swoop-tv-last-runtime-error',JSON.stringify(info));sessionStorage.setItem('swoop-tv-last-route',state.page||'home')}catch{}},true);
}

window.addEventListener('keydown',e=>{
  if(NATIVE_ANDROID)tvDiagRecord('key',{key:e.key,repeat:Boolean(e.repeat),focus:tvDiagnosticElement(document.activeElement)});
  if(NATIVE_ANDROID&&e.key==='Enter'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){
    if(window.__swoopTvActivateFocused?.('keydown')){e.preventDefault();e.stopPropagation();return}
  }
  if(e.key==='Escape'&&trailerKey){trailerKey='';trailerTitle='';render();return}
  if(e.key==='Escape'&&playerItem){if(playerItem.kind==='live'&&!playerUiHidden){playerUiHidden=true;render()}else closePlayer();return}
  if(e.key==='Escape'&&sourceChoiceItem){sourceChoiceItem=null;render();return}
  if(e.key==='Escape'&&detailItem){closeDetail();return}
  if(e.key==='Escape'&&modal){modal=null;render();return}
  if(playerItem?.kind==='live'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)){
    if(e.key==='PageUp'||e.key==='PageDown'){e.preventDefault();const next=adjacentLive(playerItem,e.key==='PageUp'?-1:1);if(next)switchLiveChannel(next);return}
    if(/^\d$/.test(e.key)){
      e.preventDefault();channelNumberBuffer=(channelNumberBuffer+e.key).slice(-4);const indicator=document.querySelector('#liveChannelNumber');if(indicator)indicator.textContent=`Channel ${channelNumberBuffer}`;
      if(channelNumberTimer)clearTimeout(channelNumberTimer);channelNumberTimer=setTimeout(()=>{const n=Number(channelNumberBuffer),next=items('live')[n-1];channelNumberBuffer='';if(indicator)indicator.textContent='';if(next)switchLiveChannel(next);else toast(`Channel ${n} is not available`)},800);return;
    }
  }
  if(NATIVE_ANDROID&&profilePickerOpen&&(e.key==='Enter'||e.key==='NumpadEnter')){const active=document.activeElement;if(active?.matches?.('[data-profile-select]')){e.preventDefault();active.click();return}}
  if(NATIVE_ANDROID&&['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(e.key)&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)){
    if(e.key==='ArrowUp'||e.key==='ArrowDown'){tvQueueVerticalMove(e.key);e.preventDefault();e.stopPropagation();return}
    if(tvMoveFocus(e.key)){e.preventDefault();e.stopPropagation()}
  }
});
if(!NATIVE_PLAYBACK&&'serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});

async function restoreDurableLibrary(){
  if(libraryRestored||(state.catalog.length&&!tvHomeSnapshotActive)){libraryRestored=true;return true}
  const bulk=await loadBulkState({onProgress:updateRestoreProgress});
  if(!bulk){libraryRestored=true;return false}
  if(Array.isArray(bulk.catalog)){state.catalog=bulk.catalog;tvHomeSnapshotActive=false;tvMovieStackedCache=null;androidDestinationPrewarmStarted=false;stopTvCatalogWorker();resetMovieStackIndex();}
  if(bulk.webDiscovery&&typeof bulk.webDiscovery==='object')state.webDiscovery=bulk.webDiscovery;
  if(!invalidateMetadataArtwork&&bulk.metadataCache&&typeof bulk.metadataCache==='object')state.metadataCache=bulk.metadataCache;else if(invalidateMetadataArtwork||bulk.droppedLegacyMetadata)state.metadataCache={};metadataRevision++;
  if(Array.isArray(bulk.mdblistRows)&&bulk.mdblistRows.length){const compact=new Map((state.mdblistRows||[]).map(r=>[r.uid,r]));state.mdblistRows=bulk.mdblistRows.map(r=>({...compact.get(r.uid),...r}));}
  syncProviderCounts();normalizeProviderPriorities();
  sessionRelay={url:state.settings.xtreamRelayUrl||state.provider?.relayUrl||savedProviderProfile?.relayUrl||'',token:state.settings.xtreamRelayToken||state.provider?.relayToken||savedProviderProfile?.relayToken||''};
  sessionXtream=providerConfigById(state.provider?.id)||{server:'',username:'',password:'',relayUrl:'',relayToken:''};
  if(bulk.legacy&&!NATIVE_WINDOWS)await persist('catalog');
  if(NATIVE_WINDOWS&&state.catalog.length){
    updateRestoreProgress({phase:'sqlite',loaded:0,total:state.catalog.length,items:0});
    await migrateCatalogToNative();
    await activateNativeCatalogIfAvailable();
    await retireBrowserCatalog();
  }
  libraryRestored=true;if(NATIVE_ANDROID){scheduleTvHomeSnapshotSave(700);startTvMovieStackWorker()}
  return true;
}
async function ensureDurableLibraryRestored(){
  if(libraryRestored||(state.catalog.length&&!tvHomeSnapshotActive)){libraryRestored=true;storageRestoring=false;return true}
  if(libraryRestorePromise)return libraryRestorePromise;
  libraryRestorePromise=(async()=>{try{return await restoreDurableLibrary()}finally{storageRestoring=false;libraryRestorePromise=null}})();
  return libraryRestorePromise;
}


async function prepareAndroidEpgBeforeEntry(onProgress=null){
  if(!NATIVE_ANDROID||!state.catalog.length)return {providers:0,matched:0,programmes:0,failed:0};
  const live=state.catalog.filter(x=>x?.kind==='live'&&!isDemoItem(x));
  const sources=[];
  for(const provider of enabledProviders()){
    const cfg=providerConfigById(provider.id)||providerConfigFor(provider.id)||provider||{};
    let url='';
    if(provider.type==='xtream'&&cfg.server&&cfg.username&&cfg.password){
      try{url=buildXtreamXmltvUrl(cfg.server,cfg.username,cfg.password)}catch{}
    }else if(provider.type==='m3u')url=String(cfg.epgUrl||provider.epgUrl||'').trim();
    if(!url)continue;
    const channels=live.filter(ch=>ch.providerId===provider.id);
    const keyByItem=new Map(),wanted=[];
    for(const ch of channels){const key=String(ch.tvgId||ch.epgChannelId||((provider.type==='m3u')?ch.name:'')||'').trim();if(!key)continue;keyByItem.set(ch.id,key);wanted.push(key)}
    if(wanted.length)sources.push({provider,url,channels,keyByItem,wanted:[...new Set(wanted)]});
  }
  if(!sources.length)return {providers:0,matched:0,programmes:0,failed:0};
  let matched=0,programmes=0,failed=0;
  const now=Date.now(),windowStartMs=now-90*60000,windowEndMs=now+8*3600000;
  for(let i=0;i<sources.length;i++){
    const src=sources[i],label=src.provider.name||'TV provider';
    try{onProgress?.({providerIndex:i,totalProviders:sources.length,label,phase:'download',detail:`Downloading ${label} programme guide…`})}catch{}
    try{
      const payload=await nativeFetchXmltvIndex(src.url,src.wanted,{windowStartMs,windowEndMs,timeoutMs:240000});
      const index=payload?.channels&&typeof payload.channels==='object'?payload.channels:{};
      const loadedAt=Date.now();let providerMatched=0;
      for(const ch of src.channels){const key=src.keyByItem.get(ch.id);if(!key)continue;const list=Array.isArray(index[key])?index[key]:[];epgCache.set(ch.id,{loadedAt,list});if(list.length)providerMatched++}
      matched+=providerMatched;programmes+=Number(payload?.programmes||0);
      try{onProgress?.({providerIndex:i+1,totalProviders:sources.length,label,phase:'ready',detail:`${label} guide ready · ${providerMatched.toLocaleString()} channels`})}catch{}
    }catch(err){failed++;try{onProgress?.({providerIndex:i+1,totalProviders:sources.length,label,phase:'error',detail:`${label} programme guide unavailable`})}catch{}}
    await new Promise(r=>setTimeout(r,0));
  }
  await persistDurableEpgCache().catch(()=>false);
  return {providers:sources.length,matched,programmes,failed};
}

async function prepareAndroidHomeBeforeEntry(onProgress=null,{refreshDiscovery=true}={}){
  if(!NATIVE_ANDROID||!state.catalog.length){androidPreparedHomeReady=true;return}
  clearAndroidPreparedHome();tvHomeSnapshotActive=false;resetAndroidFastCatalog();
  try{onProgress?.({phase:'catalog',progress:0,detail:'Organising your library…'});}catch{}
  androidFastCatalog();
  const workerReady=await ensureTvCatalogWorkerReady(45000,info=>{try{onProgress?.({phase:'index',progress:Math.min(.45,Number(info.loaded||0)/Math.max(1,Number(info.total||1))*.45),detail:`Indexing ${Number(info.loaded||0).toLocaleString()} of ${Number(info.total||0).toLocaleString()} items…`});}catch{}});
  try{onProgress?.({phase:'index',progress:.5,detail:workerReady?'Library index ready.':'Finishing library index…'});}catch{}
  const rows=selectedHomeRows();
  // Only the two priority ranking feeds are network-refreshed during launch. The much larger
  // curated Home set is built from its last good match or an immediate provider-library
  // fallback, so launch never becomes 20+ sequential web requests before the customer can watch.
  if(refreshDiscovery){
    await refreshDiscoveryRows(true,false,info=>{const fraction=Number(info.completed||0)/Math.max(1,Number(info.total||1));try{onProgress?.({phase:'discovery',progress:.5+fraction*.22,detail:info.label?`Preparing ${info.label}…`:'Preparing Top 100…',label:info.label||''});}catch{}},['top20-movies','top20-shows']);
  }else{
    try{onProgress?.({phase:'discovery',progress:.72,detail:'Using saved Home rankings.',label:'Saved Home'});}catch{}
  }
  const prepared=rows.filter(def=>!ANDROID_DYNAMIC_HOME_ROWS.has(def.id)),total=Math.max(1,prepared.length);let done=0;
  for(const def of prepared){
    const data=androidFastHomeMode()?androidFastRowItems(def.id):homeRowItems(def.id);
    androidPreparedHomeRows.set(def.id,(data||[]).slice(0,String(def.id).startsWith('top20-')?ANDROID_TV_HOME_DATA_RANKED_LIMIT:ANDROID_TV_HOME_DATA_STANDARD_LIMIT));
    done++;try{onProgress?.({phase:'rows',progress:.72+(done/total)*.26,detail:`Preparing ${def.label}…`,label:def.label});}catch{}
    await new Promise(r=>setTimeout(r,0));
  }
  androidPreparedHomeReady=true;
  const warm=[];for(const def of rows.slice(0,5))warm.push(...homeRowItems(def.id).slice(0,8));
  try{onProgress?.({phase:'artwork',progress:.985,detail:'Loading Home artwork…',label:'Home artwork'});}catch{}
  await preloadCriticalArtwork(warm,36,4200);prewarmArtworkUrls(warm,40);
  try{onProgress?.({phase:'ready',progress:1,detail:'Home is ready.'});}catch{}
}

async function runAndroidStartupGate(){
  if(!NATIVE_ANDROID||androidStartupGateComplete)return true;
  if(androidStartupGatePromise)return androidStartupGatePromise;
  androidStartupGatePromise=(async()=>{
    // A valid saved catalogue always wins the launch race. Home opens immediately and all
    // provider/app freshness checks are scheduled only after remote input is available.
    if(state.catalog.length){
      startupRefreshActive=false;state.page='home';clearAndroidPreparedHome();androidPreparedHomeReady=true;clearPersistentPageViews(['home']);
      await prewarmAndroidEntryArtwork(1800).catch(()=>null);androidStartupGateComplete=true;render();forceAndroidHomeEntry();
      restoreDurableEpgCache().catch(()=>false);
      setTimeout(()=>{startAndroidBackgroundRestore();scheduleAndroidDestinationPrewarm()},700);
      return true;
    }

    startupRefreshActive=true;startupRefreshState={progress:2,title:'Preparing Swoop TV…',detail:'Checking your saved library…',provider:'Getting ready…',summary:'This one-time setup will be reused on future launches.'};render();
    let ok=0,failed=0;
    try{
      // First try the durable local catalogue. App updates preserve this store, so an update
      // must not force a provider download simply because the WebView process restarted.
      updateStartupRefreshProgress({progress:5,provider:'Saved library',detail:'Loading your saved TV library…'});
      try{await ensureDurableLibraryRestored()}catch{}
      if(state.catalog.length){
        await restoreDurableEpgCache().catch(()=>false);
        updateStartupRefreshProgress({progress:72,provider:'Preparing Home',detail:'Preparing your saved Home screen…'});
        await prepareAndroidHomeBeforeEntry(info=>{
          const mapped=72+Math.max(0,Math.min(1,Number(info.progress||0)))*26;
          updateStartupRefreshProgress({progress:mapped,provider:info.label||'Preparing Home',detail:info.detail||'Preparing Home…'});
        },{refreshDiscovery:false});
        updateStartupRefreshProgress({progress:100,provider:'Ready',detail:'Your saved library is ready.',summary:'Future launches will open from this saved library.'});
        scheduleTvHomeSnapshotSave(0);
        androidStartupGateComplete=true;startupRefreshActive=false;state.page='home';clearPersistentPageViews(['home']);render();forceAndroidHomeEntry();return true;
      }

      // No valid local library exists: this is the one-time network import/recovery path.
      const providers=enabledProviders(),refreshable=providers.filter(providerCanRefreshOnLaunch),skipped=providers.length-refreshable.length;
      if(refreshable.length){
        for(let i=0;i<refreshable.length;i++){
          const provider=refreshable[i],base=8+(i/refreshable.length)*46,span=46/refreshable.length;
          updateStartupRefreshProgress({progress:base,provider:`${provider.name||'TV Provider'} · ${i+1} of ${refreshable.length}`,detail:'Downloading channels, movies and TV shows…'});
          const success=await refreshProvider(provider.id,{quiet:true,manageTask:false,deferPersist:true,onProgress:info=>{
            const fraction=Math.max(0,Math.min(1,Number(info.progress||0)/100));
            updateStartupRefreshProgress({progress:base+fraction*span,provider:`${provider.name||'TV Provider'} · ${i+1} of ${refreshable.length}`,detail:info.detail||'Updating your library…'});
          }});
          if(success)ok++;else failed++;
          await new Promise(r=>setTimeout(r,0));
        }
      }
      let epgSummary={providers:0,matched:0,programmes:0,failed:0};
      if(state.catalog.length){
        tvHomeSnapshotActive=false;libraryRestored=true;resetMovieStackIndex();syncProviderCounts();
        updateStartupRefreshProgress({progress:55,provider:'TV Guide',detail:'Downloading programme guide data…'});
        epgSummary=await prepareAndroidEpgBeforeEntry(info=>{
          const fraction=Math.max(0,Math.min(1,Number(info.providerIndex||0)/Math.max(1,Number(info.totalProviders||1))));
          updateStartupRefreshProgress({progress:55+fraction*14,provider:`TV Guide · ${info.label||''}`.replace(/ · $/,''),detail:info.detail||'Preparing programme guide…'});
        });
        updateStartupRefreshProgress({progress:70,provider:'TV Guide ready',detail:epgSummary.matched?`${epgSummary.matched.toLocaleString()} channels have programme data ready.`:(epgSummary.providers?'Programme guide checked.':'No programme guide source configured.')});
        updateStartupRefreshProgress({progress:72,provider:`${catalogLogicalTotal().toLocaleString()} items`,detail:'Saving your TV library…'});
        await persist(true);
        updateStartupRefreshProgress({progress:75,provider:'Preparing Home',detail:'Building your Home screen…'});
        await prepareAndroidHomeBeforeEntry(info=>{
          const mapped=75+Math.max(0,Math.min(1,Number(info.progress||0)))*23;
          updateStartupRefreshProgress({progress:mapped,provider:info.label||'Preparing Home',detail:info.detail||'Preparing Home…'});
        });
        updateStartupRefreshProgress({progress:99,provider:'Finalising',detail:'Saving your prepared Home screen…'});
        await persist('cache');scheduleTvHomeSnapshotSave(0);
      }else{clearAndroidPreparedHome();androidPreparedHomeReady=true;}
      const parts=[];if(ok)parts.push(`${ok} provider${ok===1?'':'s'} downloaded`);if(epgSummary?.matched)parts.push(`${epgSummary.matched.toLocaleString()} guide channels ready`);if(failed)parts.push(`${failed} failed`);if(skipped)parts.push(`${skipped} unchanged`);
      updateStartupRefreshProgress({progress:100,provider:'Ready',detail:state.catalog.length?'Your library is ready.':'Swoop TV is ready.',summary:parts.join(' · ')||'Ready to watch.'});
      androidStartupGateComplete=true;startupRefreshActive=false;state.page='home';clearPersistentPageViews(['home']);render();forceAndroidHomeEntry();return true;
    }catch(err){
      startupRefreshActive=false;androidStartupGateComplete=true;state.page='home';render();if(state.catalog.length)forceAndroidHomeEntry();toast(err?.message||'Could not prepare your library');return false;
    }finally{androidStartupGatePromise=null}
  })();
  return androidStartupGatePromise;
}

async function bootstrapApp(){
  if(NATIVE_ANDROID){render();setTimeout(()=>prepareStarmeterBeforeLogin().catch(()=>false),0);return}
  const providers=enabledProviders();
  if(!providers.length){render();return}
  const refreshable=providers.filter(providerCanRefreshOnLaunch);
  if(!refreshable.length){render();return}
  startupRefreshActive=true;
  startupRefreshState={progress:2,title:'Updating your TV library…',detail:'Getting your TV library ready.',provider:'Loading your library…',summary:'Keep Swoop TV open while your library updates.'};
  render();

  // Load the last durable catalogue behind the startup gate first. It is never shown before
  // the refresh finishes, but it gives Swoop TV a safe fallback if a provider is temporarily
  // offline and preserves unrefreshable/local-file providers while other providers update.
  updateStartupRefreshProgress({progress:3,provider:'Loading your library…',detail:'Loading your library…'});
  try{
    if(NATIVE_WINDOWS){
      const nativeReady=await activateNativeCatalogIfAvailable().catch(()=>false);
      if(!nativeReady&&!state.catalog.length)await ensureDurableLibraryRestored().catch(()=>false);
    }else if(!state.catalog.length)await ensureDurableLibraryRestored().catch(()=>false);
  }catch{}

  let ok=0,failed=0;
  const skipped=providers.length-refreshable.length;
  for(let i=0;i<refreshable.length;i++){
    const provider=refreshable[i];
    updateStartupRefreshProgress({progress:5+(i/refreshable.length)*93,provider:`${provider.name||'TV Provider'} · provider ${i+1} of ${refreshable.length}`,detail:'Updating your library…'});
    const success=await refreshProvider(provider.id,{quiet:true,manageTask:false,onProgress:info=>{
      const fraction=(i+(Math.max(0,Math.min(100,Number(info.progress||0)))/100))/refreshable.length;
      updateStartupRefreshProgress({progress:5+fraction*93,provider:`${provider.name||'TV Provider'} · provider ${i+1} of ${refreshable.length}`,detail:info.detail||'Updating your library…'});
    }});
    if(success)ok++;else failed++;
  }

  if(NATIVE_WINDOWS)await activateNativeCatalogIfAvailable().catch(()=>false);
  syncProviderCounts();
  const resultParts=[`${ok} updated`];
  if(failed)resultParts.push(`${failed} kept previous content`);
  if(skipped)resultParts.push(`${skipped} unchanged`);
  updateStartupRefreshProgress({progress:100,provider:'Your library is ready',detail:failed?'Your library is ready. Some content may be from the last successful update.':'Your library is ready.',summary:resultParts.join(' · ')});
  startupRefreshActive=false;
  render();
}

bootstrapApp();
