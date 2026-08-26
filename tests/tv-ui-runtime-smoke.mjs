import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../app/src/main/assets/app.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../app/src/main/assets/styles.css', import.meta.url), 'utf8');
const nativeSource = fs.readFileSync(new URL('../app/src/main/assets/src/native.js', import.meta.url), 'utf8');
const activitySource = fs.readFileSync(new URL('../app/src/main/java/tv/swoop/player/MainActivity.java', import.meta.url), 'utf8');

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
if (!appSource.includes('const TOP100_RANKING_SCHEMA=2;')) throw new Error('Top 100 ranking cache schema missing');

// v0.8.23+ deterministic remote/focus system.
if (!appSource.includes('function tvQueueVerticalMove(key)')) throw new Error('Queued vertical D-pad navigation missing');
if (!appSource.includes('const tvRowColumnMemory=new Map()')) throw new Error('Per-row horizontal focus memory missing');
if (!appSource.includes('function tvGenericRailDirectionalTarget(current,key)')) throw new Error('Deterministic generic rail navigation missing');
if (appSource.includes('const style=getComputedStyle(el);')) throw new Error('TV focus hot path still performs getComputedStyle');
if (!cssSource.includes('scroll-behavior:auto!important')) throw new Error('TV rails still use animated scroll behaviour');

// v0.8.23 continuous 100-at-a-time catalogue rails.
if (!appSource.includes('const LONG_RAIL_BATCH_SIZE=100')) throw new Error('100-item long-rail batches missing');
if (!appSource.includes('LONG_RAIL_PREFETCH_THRESHOLD=24')) throw new Error('Ahead-of-end long-rail prefetch missing');
if (!appSource.includes('data-long-rail="media"') || !appSource.includes('data-long-rail="live"')) throw new Error('Long-rail pagination markers missing');
if (!appSource.includes('function prefetchMediaRail(') || !appSource.includes('function prefetchLiveRail(')) throw new Error('Long-rail prefetch functions missing');

// Home masthead and persistent TV navigation.
if (!cssSource.includes('height:260px!important')) throw new Error('v0.8.23 bounded Home hero missing');
if (!cssSource.includes('position:fixed!important') || !cssSource.includes('z-index:160!important')) throw new Error('Persistent Google TV top navigation missing');
if (!appSource.includes("key==='ArrowUp'&&firstSection&&currentSection===firstSection&&heroAction")) throw new Error('First Home row → hero Up routing missing');
if (!appSource.includes("key==='ArrowDown'&&tvIsTopNavigationElement(current)&&heroAction")) throw new Error('Top navigation → hero Down routing missing');
if (!appSource.includes('function updateAndroidTvViewportProfile()')) throw new Error('Adaptive TV viewport density missing');
if (!cssSource.includes('data-tv-density="compact"') || !cssSource.includes('data-tv-density="tight"')) throw new Error('Adaptive TV density CSS missing');

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
if (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.24';")) throw new Error('Current Android UI version marker missing');
if (!appSource.includes('function tvModalRoot()')) throw new Error('TV modal focus scope missing');
if (!appSource.includes("document.documentElement.classList.toggle('tv-modal-open'")) throw new Error('TV modal scroll lock class missing');
if (!appSource.includes('data-whats-new-done autofocus')) throw new Error('What’s New primary-action autofocus missing');
if (!cssSource.includes('html.android-tv.tv-modal-open')) throw new Error('TV modal background scroll lock CSS missing');
if (!appSource.includes('modalRoot.contains(found)')) throw new Error('TV focus restore can still escape behind an open modal');

console.log('Google TV UI runtime smoke passed');
