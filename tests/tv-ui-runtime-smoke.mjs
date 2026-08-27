import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../app/src/main/assets/app.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../app/src/main/assets/styles.css', import.meta.url), 'utf8');
const nativeSource = fs.readFileSync(new URL('../app/src/main/assets/src/native.js', import.meta.url), 'utf8');
const activitySource = fs.readFileSync(new URL('../app/src/main/java/tv/swoop/player/MainActivity.java', import.meta.url), 'utf8');

const starmeterManifest = JSON.parse(fs.readFileSync(new URL('../app/src/main/assets/starmeter.json', import.meta.url), 'utf8'));
const starmeterPeople = Array.isArray(starmeterManifest?.people) ? starmeterManifest.people : [];
if (starmeterPeople.length !== 100) throw new Error(`STARmeter manifest must contain 100 people, got ${starmeterPeople.length}`);
const starmeterRanks = starmeterPeople.map(x=>Number(x.rank));
if (starmeterRanks.some((rank,index)=>rank!==index+1)) throw new Error('STARmeter ranks must be contiguous 1–100');
const starmeterNames = starmeterPeople.map(x=>String(x.name||'').trim().toLowerCase());
if (starmeterNames.some(x=>!x) || new Set(starmeterNames).size !== 100) throw new Error('STARmeter people must contain 100 unique non-empty names');
const releaseStarmeter = JSON.parse(fs.readFileSync(new URL('../swoop-tv-starmeter.json', import.meta.url), 'utf8'));
if (JSON.stringify(releaseStarmeter.people) !== JSON.stringify(starmeterManifest.people)) throw new Error('Bundled and release STARmeter manifests diverge');

const start = appSource.indexOf('function homeVisibleTitleKey(');
const end = appSource.indexOf('\nfunction androidFastRowItems(', start);
if (start < 0 || end < 0) throw new Error('Unable to locate Home title de-duplication helpers');
const dedupeSource = appSource.slice(start, end);
const prelude = `
const cleanDisplayTitle=x=>x?.name||'';
const normalizeMediaTitle=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function yearNumber(item){const m=String(item?.year||item?.name||'').match(/(?:19|20)\\d{2}/);return m?Number(m[0]):0}
`;
const dedupeHomeTitles = new Function(`${prelude}\n${dedupeSource}\nreturn dedupeHomeTitles;`)();
const input = [
  {id:'a',kind:'movie',name:'Villains Unite',year:'2026'},
  {id:'b',kind:'movie',name:'Villains Unite',year:'2026'},
  {id:'c',kind:'movie',name:'Villains Unite',year:'2017'},
  {id:'d',kind:'movie',name:'Another Film',year:'2026',tmdbId:'44'},
  {id:'e',kind:'movie',name:'Another Film Alt',year:'2026',tmdbId:'44'},
];
const output = dedupeHomeTitles(input);
if (output.length !== 3) throw new Error(`Expected 3 unique visible titles, got ${output.length}`);
if (output.filter(x=>x.name==='Villains Unite').length !== 2) throw new Error('Known different-year remakes should remain distinct');

// Existing ranked/trending guarantees.
if (!appSource.includes("if(id==='top20-movies'||id==='top20-shows')return '';")) throw new Error('Top 100 availability label suppression missing');
if (!appSource.includes("if(String(id).startsWith('top20-'))return'hot';")) throw new Error('Top 100 hot/trending mode missing');
if (!appSource.includes('const HOME_RANKED_ROW_LIMIT=100;')) throw new Error('Top 100 100-title cap missing');
if (!appSource.includes('const TOP100_RANKING_SCHEMA=3;')) throw new Error('Top 100 ranking cache schema missing');

// v0.8.23+ deterministic remote/focus system.
if (!appSource.includes('function tvQueueVerticalMove(key)')) throw new Error('Queued vertical D-pad navigation missing');
if (!appSource.includes('const tvRowColumnMemory=new Map()')) throw new Error('Per-row horizontal focus memory missing');
if (!appSource.includes('function tvGenericRailDirectionalTarget(current,key)')) throw new Error('Deterministic generic rail navigation missing');
if (appSource.includes('const style=getComputedStyle(el);')) throw new Error('TV focus hot path still performs getComputedStyle');
if (!cssSource.includes('scroll-behavior:auto!important')) throw new Error('TV rails still use animated scroll behaviour');

// v0.8.23 continuous 100-at-a-time catalogue rails.
if (!appSource.includes('const LONG_RAIL_BATCH_SIZE=100')) throw new Error('100-item long-rail batches missing');
if (!appSource.includes('LONG_RAIL_PREFETCH_THRESHOLD=30')) throw new Error('Ahead-of-end long-rail prefetch missing');
if (!appSource.includes('data-long-rail="media"') || !appSource.includes('data-long-rail="live"')) throw new Error('Long-rail pagination markers missing');
if (!appSource.includes('function prefetchMediaRail(') || !appSource.includes('function prefetchLiveRail(')) throw new Error('Long-rail prefetch functions missing');

// Home masthead and persistent TV navigation.
if (!cssSource.includes('height:440px!important')) throw new Error('v0.8.23 bounded Home hero missing');
if (!cssSource.includes('position:fixed!important') || !cssSource.includes('z-index:160!important')) throw new Error('Persistent Google TV top navigation missing');
if (!appSource.includes("key==='ArrowUp'&&firstSection&&currentSection===firstSection&&heroAction")) throw new Error('First Home row → hero Up routing missing');
if (!appSource.includes("key==='ArrowDown'&&tvIsTopNavigationElement(current)&&heroAction")) throw new Error('Top navigation → hero Down routing missing');
if (!appSource.includes('function updateAndroidTvViewportProfile()')) throw new Error('Adaptive TV viewport density missing');
if (!cssSource.includes('data-tv-density="compact"') || !cssSource.includes('data-tv-density="tight"')) throw new Error('Adaptive TV density CSS missing');


// v0.8.25 long-rail/vertical-position regressions.
if (!appSource.includes("if((key==='ArrowLeft'||key==='ArrowRight')&&tvRailSection(current))return true")) throw new Error('Horizontal rail ownership guard missing; focus can escape to another row at a render boundary');
if (!appSource.includes("const r=card.getBoundingClientRect(),cx=(r.left+r.right)/2")) throw new Error('Visual-column Up/Down targeting missing');
if (!appSource.includes('LONG_RAIL_INITIAL_RENDER=36') || !appSource.includes('LONG_RAIL_RENDER_CHUNK=36')) throw new Error('Larger lazy-render safety window missing');
if (!appSource.includes("['home','Home'],['live','Live TV'],['guide','Guide'],['starmeter','STARmeter'],['movies','Movies']")) throw new Error('STARmeter primary navigation placement missing');
if (!appSource.includes('function starmeterPage()') || !appSource.includes('function prewarmStarmeterHotCache')) throw new Error('STARmeter page/hot-cache implementation missing');
if (!appSource.includes("fetch('./starmeter.json'")) throw new Error('Bundled STARmeter fallback manifest missing');
if (!appSource.includes("[data-starmeter-retry]") || !appSource.includes('starmeterObserver?.disconnect?.()')) throw new Error('STARmeter retry/observer cleanup missing');
if (!appSource.includes('function prewarmSelectedEpisodeMetadata()') || !appSource.includes('fetchEpisodeMetadata')) throw new Error('Episode metadata background enrichment missing');
if (!cssSource.includes('grid-template-columns:minmax(0,39%) minmax(0,31%) minmax(0,30%)')) throw new Error('Live TV left/preview/brand three-column hero missing');
if (!cssSource.includes('grid-auto-columns:minmax(0,168px)!important')) throw new Error('Larger Browse Live TV tiles missing');
if (!cssSource.includes('font-size:8px!important')) throw new Error('Smaller TV IMDb badge missing');

// Continue Watching long-press options.
if (!appSource.includes('window.__swoopTvFocusedSupportsLongPress')) throw new Error('Continue Watching long-press capability hook missing');
if (!appSource.includes('window.__swoopTvLongPressFocused')) throw new Error('Continue Watching long-press action hook missing');
if (!activitySource.includes('__swoopTvLongPressFocused')) throw new Error('Android long-press Select bridge missing');
if (!appSource.includes('data-continue-options-id')) throw new Error('Continue Watching context-menu target marker missing');

// Clean artwork + Live TV preview/contained branding.
if (!cssSource.includes('html.android-tv .card.poster .card-copy')) throw new Error('TV poster overlay suppression missing');
if (!appSource.includes('live-preview-anchor')) throw new Error('Live TV preview anchor missing');
if (!nativeSource.includes('export async function nativePreviewLive')) throw new Error('Native Live TV preview bridge missing');
if (!activitySource.includes('startPreviewPlayer')) throw new Error('Media3 muted preview player missing');
if (!activitySource.includes('import android.util.Log;') || !activitySource.includes('WebView renderer exited')) throw new Error('Android renderer-loss diagnostics missing');
if (!cssSource.includes('object-fit:contain!important') || !cssSource.includes('transform:none!important')) throw new Error('Contained Live TV logo treatment missing');

// Guide redesign and automatic continuation.
if (!appSource.includes('function guidePage()') || !appSource.includes('hours=2')) throw new Error('Two-hour TV Guide window missing');
if (!appSource.includes('guide-main-header')) throw new Error('TV Guide main/right title header missing');
if (!cssSource.includes('grid-template-columns:minmax(285px,22vw)')) throw new Error('Wider TV Guide category sidebar missing');
if (!appSource.includes('function maybeAutoLoadGuideFromFocus')) throw new Error('Automatic Guide channel pagination missing');

// Actor shell speed-up.
if (!appSource.includes('const personLibraryCache=new Map()')) throw new Error('Actor/person catalogue cache missing');
if (!appSource.includes('loadAndroidPersonData')) throw new Error('Actor/person asynchronous hydration path missing');

// GitHub update manifest + one-time What’s New.
if (!appSource.includes('swoop-tv-latest.json')) throw new Error('GitHub build manifest update check missing');
if (!appSource.includes('function maybeShowWhatsNewOnLogin()')) throw new Error('One-time What’s New login presentation missing');
if (!appSource.includes('data-show-whats-new')) throw new Error('Settings What’s New route missing');
if (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.26';")) throw new Error('Current Android UI version marker missing');
if (!appSource.includes('function tvModalRoot()')) throw new Error('TV modal focus scope missing');
if (!appSource.includes("document.documentElement.classList.toggle('tv-modal-open'")) throw new Error('TV modal scroll lock class missing');
if (!appSource.includes('data-whats-new-done autofocus')) throw new Error('What’s New primary-action autofocus missing');
if (!cssSource.includes('html.android-tv.tv-modal-open')) throw new Error('TV modal background scroll lock CSS missing');
if (!appSource.includes('modalRoot.contains(found)')) throw new Error('TV focus restore can still escape behind an open modal');


// v0.8.26 hardware performance/stability regressions.
if (!appSource.includes('async function tvAdvanceLongRailRight(current)')) throw new Error('Async long-rail boundary continuation missing');
if (!appSource.includes('ANDROID_HEAVY_NONPERSISTENT_PAGES')) throw new Error('Android heavy-page DOM eviction missing');
if (!appSource.includes('STARMETER_INITIAL_VISIBLE=5,STARMETER_APPEND_BATCH=4')) throw new Error('STARmeter visible-window virtualization constants missing');
if (!appSource.includes('function appendStarmeterSections(') || !appSource.includes('function setupStarmeterAutoLoad()')) throw new Error('STARmeter virtual append/autoload missing');
if (!appSource.includes('function hydrateStarmeterIdentity(')) throw new Error('STARmeter identity-only prewarm path missing');
if (!appSource.includes('function appendLiveCategorySections(')) throw new Error('Live TV in-place category append missing');
if (!appSource.includes('function patchLiveHeroFocusedChannel(')) throw new Error('Focused Live TV hero update missing');
if (!appSource.includes('function tvTopbarDirectionalTarget(') || !appSource.includes('function tvTopbarDownTarget(')) throw new Error('Deterministic topbar focus routing missing');
if (!cssSource.includes('.hero-rotation-dots i.active')) throw new Error('Small non-focusable Home hero dots missing');
if (!cssSource.includes('.media-category-page .page-hero') || !cssSource.includes('height:440px!important')) throw new Error('Movies/TV Shows approved Home hero parity missing');
if (!cssSource.includes('grid-template-columns:230px minmax(0,1fr)!important')) throw new Error('Large people-first STARmeter layout missing');
if (!cssSource.includes('border-radius:999px!important;object-fit:cover!important')) throw new Error('Circular STARmeter portraits missing');
if (!cssSource.includes('width:75%!important;height:75%!important')) throw new Error('Reduced centered Live TV brand treatment missing');
console.log('Google TV UI runtime smoke passed');
