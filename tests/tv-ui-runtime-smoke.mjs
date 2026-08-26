import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../app/src/main/assets/app.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../app/src/main/assets/styles.css', import.meta.url), 'utf8');

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

if (!appSource.includes("if(id==='top20-movies'||id==='top20-shows')return '';")) throw new Error('Top 100 availability label suppression missing');
if (!appSource.includes("key==='ArrowUp'&&firstSection&&currentSection===firstSection&&heroAction")) throw new Error('First Home row → hero Up routing missing');
if (!appSource.includes("key==='ArrowDown'&&tvIsTopNavigationElement(current)&&heroAction")) throw new Error('Top navigation → hero Down routing missing');
if (!cssSource.includes('html.android-tv .card.poster.art-ready .card-shade{background:transparent!important}')) throw new Error('Poster haze removal missing');
if (!cssSource.includes('height:clamp(285px,30vh,325px)')) throw new Error('Safe compact Home hero sizing missing');
if (!cssSource.includes('html.android-tv .live-hub-art.loaded{opacity:1}')) throw new Error('Live TV logo visibility override missing');

if (!appSource.includes("if(String(id).startsWith('top20-'))return'hot';")) throw new Error('Top 100 hot/trending mode missing');
if (!appSource.includes("/^(top20-|trending|new-hot|streaming|box-office)/")) throw new Error('Top 100 fast refresh cadence missing');
if (!appSource.includes('const TOP100_RANKING_SCHEMA=2;')) throw new Error('Top 100 ranking cache schema missing');
if (!appSource.includes("refreshDiscoveryRows(false,false,null,['top20-movies','top20-shows'])")) throw new Error('Android background Top 100 refresh missing');
if (!appSource.includes('current.contains(document.activeElement)')) throw new Error('Focused Home row refresh deferral missing');
if (!appSource.includes('const ANDROID_TV_HOME_EAGER_ROWS=3;') || !appSource.includes('const ANDROID_TV_HOME_INITIAL_RENDER=12;')) throw new Error('Android Home DOM budget reduction missing');
if (!appSource.includes('function tvHomeRailDirectionalTarget(current,key)')) throw new Error('Fast deterministic Home rail navigation missing');
if (!appSource.includes("target.closest?.('.topbar,.hero')")) throw new Error('Home hero top-preserving focus missing');
if (appSource.includes("const style=getComputedStyle(el);")) throw new Error('TV focus hot path still performs getComputedStyle');

console.log('Google TV UI runtime smoke passed');
