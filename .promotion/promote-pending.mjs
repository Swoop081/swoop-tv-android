import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function replaceOnce(text,from,to,label){if(!text.includes(from))throw new Error(`Missing promotion anchor: ${label}`);return text.replace(from,to)}
function edit(path,fn){const before=read(path),after=fn(before);if(after===before)throw new Error(`No changes produced for ${path}`);write(path,after)}

edit('scripts/refresh-seed-cache.mjs',s=>{
  const old=`let curated={};
if(!OFFLINE){try{const [movies,shows]=await Promise.all([post({mode:'snoak-list',listKey:'trending-movies'},18000),post({mode:'snoak-list',listKey:'trending-shows'},18000)]);if(movies&&typeof movies==='object')curated['trending-movies']=movies;if(shows&&typeof shows==='object')curated['trending-shows']=shows;console.log('Seed Snoak Top 100 source lists refreshed.')}catch(err){console.warn(\`Snoak Top 100 seed refresh unavailable: \${err.message}\`)}}
if(!Object.keys(curated).length&&previous?.curated&&typeof previous.curated==='object')curated=previous.curated;
`;
  const next=`function decodeHtmlText(value=''){
  return String(value).replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#(\\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function parsePublicMdbList(html,mediaType='movie'){
  const source=String(html||'').replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi,' ').replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi,' '),out=[],seen=new Set();
  const titlePattern=/>\\s*([^<>\\r\\n]{1,180}?)\\s*\\(((?:19|20)\\d{2})\\)\\s*</g;let match;
  while((match=titlePattern.exec(source))){
    const title=decodeHtmlText(match[1]).replace(/\\s+/g,' ').trim(),year=String(match[2]||'');
    if(!title||title.length>130||title.split(/\\s+/).length>20||/[.!?]\\s/.test(title))continue;
    const key=\`\${normalize(title)}|\${year}\`;if(!normalize(title)||seen.has(key))continue;
    const prefix=source.slice(Math.max(0,match.index-7000),match.index);
    const imdbMatches=[...prefix.matchAll(/href=["'][^"']*imdb\\.com\\/title\\/(tt\\d+)/gi)],tmdbMatches=[...prefix.matchAll(/href=["'][^"']*themoviedb\\.org\\/(?:movie|tv)\\/(\\d+)/gi)];
    const imdb=imdbMatches.length?imdbMatches[imdbMatches.length-1][1]:'',tmdb=tmdbMatches.length?tmdbMatches[tmdbMatches.length-1][1]:'';
    seen.add(key);out.push({title,year,media_type:mediaType,ids:{...(tmdb?{tmdb}:{}),...(imdb?{imdb}: {})}});if(out.length>=300)break;
  }
  return out;
}
async function fetchPublicMdbList(url,mediaType){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; SwoopTV-Seed/0.8.41; +https://github.com/Swoop081/swoop-tv-android)','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});
    if(!res.ok)throw new Error(\`MDBList page HTTP \${res.status}\`);const html=await res.text(),items=parsePublicMdbList(html,mediaType);if(items.length<100)throw new Error(\`MDBList page parser found only \${items.length} \${mediaType} entries\`);
    return {items,source:'Snoak · Trakt Trending via MDBList',sourceUrl:url,sourceUpdatedAt:Date.now()};
  }finally{clearTimeout(timer)}
}
let curated={};
if(!OFFLINE){
  const jobs=[['trending-movies','https://mdblist.com/lists/snoak/trending-movies','movie'],['trending-shows','https://mdblist.com/lists/snoak/trakt-s-trending-shows','tv']];
  for(const [key,url,type] of jobs){try{curated[key]=await fetchPublicMdbList(url,type);console.log(\`Seed Snoak \${key}: \${curated[key].items.length} source entries.\`)}catch(err){console.warn(\`Snoak \${key} seed refresh unavailable: \${err.message}\`);if(previous?.curated?.[key]?.items?.length>=100)curated[key]=previous.curated[key]}}
}
if(!Object.keys(curated).length&&previous?.curated&&typeof previous.curated==='object')curated=previous.curated;
`;
  return replaceOnce(s,old,next,'public Snoak seed scraper');
});

edit('tests/tv-ui-runtime-smoke.mjs',s=>{
  s=replaceOnce(s,
    "const swSource = fs.readFileSync(new URL('../app/src/main/assets/sw.js', import.meta.url), 'utf8');\n",
    "const swSource = fs.readFileSync(new URL('../app/src/main/assets/sw.js', import.meta.url), 'utf8');\nconst installSeed = JSON.parse(fs.readFileSync(new URL('../app/src/main/assets/seed-cache.json', import.meta.url), 'utf8'));\n",
    'seed test fixture');
  const old="if (!appSource.includes('installSeedCuratedList') || !appSource.includes(\"listKey:'trending-movies'\") || !appSource.includes(\"listKey:'trending-shows'\")) throw new Error('Packaged Snoak Top 100 seed fallback missing');";
  const next="const snoakMovies=installSeed?.curated?.['trending-movies']?.items||[],snoakShows=installSeed?.curated?.['trending-shows']?.items||[];\nif (!appSource.includes('installSeedCuratedList') || !appSource.includes(\"['top20-movies','trending-movies']\") || !appSource.includes(\"['top20-shows','trending-shows']\")) throw new Error('Snoak Top 100 runtime mapping/seed fallback missing');\nif (snoakMovies.length<100 || snoakShows.length<100) throw new Error(`Packaged Snoak Top 100 source lists incomplete: movies=${snoakMovies.length}, shows=${snoakShows.length}`);";
  return replaceOnce(s,old,next,'Snoak seed content regression guard');
});

try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Fix v0.8.41 Snoak Top 100 seed source [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 Snoak seed source fix applied and pushed.');
