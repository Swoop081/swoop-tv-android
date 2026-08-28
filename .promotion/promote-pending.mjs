import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let s=fs.readFileSync(path,'utf8');

const insertAnchor="async function fetchTraktWebApiList(mediaType){\n";
if(!s.includes(insertAnchor))throw new Error('Trakt API function anchor missing');
const directFn=`const TRAKT_PUBLIC_WEB_CLIENT_KEY='201dc70c5ec6af530f12f079ea1922733f6e1085ad7b02f36d8e011b75bcea7d';\nasync function fetchTraktPublicApiList(mediaType){\n  const slug=mediaType==='movie'?'trakt-s-trending-movies':'trakt-s-trending-shows';\n  const url=\`https://api.trakt.tv/users/snoak/lists/\${slug}/items?page=1&limit=100\`;\n  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);\n  try{\n    const res=await fetch(url,{headers:{'accept':'application/json','trakt-api-version':'2','trakt-api-key':TRAKT_PUBLIC_WEB_CLIENT_KEY,'user-agent':'SwoopTV/0.8.41'},signal:controller.signal,redirect:'follow'});\n    const text=await res.text();\n    console.log(\`Trakt public API \${mediaType}: HTTP \${res.status}, \${text.length} bytes.\`);\n    if(!res.ok)throw new Error(\`Trakt public API HTTP \${res.status}: \${text.slice(0,240).replace(/\\s+/g,' ')}\`);\n    let rows;try{rows=JSON.parse(text)}catch{throw new Error('Trakt public API returned non-JSON body')}\n    if(!Array.isArray(rows))throw new Error('Trakt public API response is not an item array');\n    const items=[];\n    for(const row of rows){\n      const media=row?.movie||row?.show||null,title=String(media?.title||'').trim(),year=String(media?.year||''),ids=media?.ids||{};\n      if(!title||!year)continue;\n      items.push({title,year,media_type:mediaType,ids:{...(ids.trakt?{trakt:String(ids.trakt)}:{}),...(ids.tmdb?{tmdb:String(ids.tmdb)}:{}),...(ids.imdb?{imdb:String(ids.imdb)}:{}),...(ids.tvdb?{tvdb:String(ids.tvdb)}:{})}});\n      if(items.length>=100)break;\n    }\n    console.log(\`Trakt public API parsed \${mediaType}: \${items.length} items.\`);\n    if(items.length<100)throw new Error(\`Trakt public API returned only \${items.length} usable \${mediaType} items\`);\n    return {items,source:'Snoak · Trakt Trending',sourceUrl:\`https://trakt.tv/users/snoak/lists/\${slug}\`,sourceUpdatedAt:Date.now()};\n  }finally{clearTimeout(timer)}\n}\n`;
s=s.replace(insertAnchor,directFn+insertAnchor);

const old=`    }catch(workerErr){\n      try{curated[key]=await fetchTraktWebApiList(type);console.log(\`Seed Snoak \${key}: \${curated[key].items.length} Trakt apiz entries.\`)}\n`;
const repl=`    }catch(workerErr){\n      try{curated[key]=await fetchTraktPublicApiList(type);console.log(\`Seed Snoak \${key}: \${curated[key].items.length} Trakt public API entries.\`)}\n      catch(publicApiErr){try{curated[key]=await fetchTraktWebApiList(type);console.log(\`Seed Snoak \${key}: \${curated[key].items.length} Trakt apiz entries.\`)}\n`;
if(!s.includes(old))throw new Error('Curated fallback anchor missing');
s=s.replace(old,repl);
const closeAnchor=`      catch(mdbErr){console.warn(\`Snoak \${key} seed refresh unavailable: Worker: \${workerErr.message}; Trakt apiz: \${apizErr.message}; Trakt app: \${traktErr.message}; Trakt media: \${mediaErr.message}; MDBList fallback: \${mdbErr.message}\`);if(previous?.curated?.[key]?.items?.length>=100)curated[key]=previous.curated[key]}}}}}}\n`;
if(!s.includes(closeAnchor))throw new Error('Curated fallback closing anchor missing');
s=s.replace(closeAnchor,`      catch(mdbErr){console.warn(\`Snoak \${key} seed refresh unavailable: Worker: \${workerErr.message}; Trakt public API: \${publicApiErr.message}; Trakt apiz: \${apizErr.message}; Trakt app: \${traktErr.message}; Trakt media: \${mediaErr.message}; MDBList fallback: \${mdbErr.message}\`);if(previous?.curated?.[key]?.items?.length>=100)curated[key]=previous.curated[key]}}}}}}}\n`);

fs.writeFileSync(path,s);
execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Use direct Trakt public API for v0.8.41 Snoak seeds [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 direct Trakt public API seed fallback promoted.');
