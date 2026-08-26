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
if (!cssSource.includes('height:clamp(225px,24vh,260px)')) throw new Error('Compact Home hero sizing missing');
if (!cssSource.includes('html.android-tv .live-hub-art.loaded{opacity:1}')) throw new Error('Live TV logo visibility override missing');

console.log('Google TV UI runtime smoke passed');
