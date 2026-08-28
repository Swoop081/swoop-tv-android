import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let source=fs.readFileSync(path,'utf8');
const marker=`let curated={};\nif(!OFFLINE){`;
if(!source.includes(marker)) throw new Error('Curated seed marker not found');
const helper=`async function fetchPublicTraktTrending(url,mediaType){\n  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);\n  try{\n    const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; SwoopTV-Seed/0.8.41; +https://github.com/Swoop081/swoop-tv-android)','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});\n    if(!res.ok)throw new Error(\`Trakt trending HTTP \${res.status}\`);\n    const html=await res.text();\n    const text=decodeHtmlText(html.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi,' ').replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi,' ').replace(/<[^>]+>/g,'\\n'));\n    const out=[],seen=new Set();\n    for(const rawLine of text.split(/\\r?\\n/)){\n      const line=rawLine.replace(/\\s+/g,' ').trim();\n      const m=line.match(/^(.{1,140}?)\\s+((?:19|20)\\d{2})$/);\n      if(!m)continue;\n      const title=m[1].trim(),year=m[2],norm=normalize(title);\n      if(!norm||seen.has(\`\${norm}|\${year}\`))continue;\n      if(/^(movies?|shows?|trakt|image|available to watch on)$/i.test(title)||/watchers?|plays?|comments?|followers?/i.test(title))continue;\n      seen.add(\`\${norm}|\${year}\`);out.push({title,year,media_type:mediaType,ids:{}});\n      if(out.length>=100)break;\n    }\n    if(out.length<100)throw new Error(\`Trakt trending parser found only \${out.length} \${mediaType} entries\`);\n    return {items:out.slice(0,100),source:'Snoak · Trakt Trending direct fallback',sourceUrl:url,sourceUpdatedAt:Date.now()};\n  }finally{clearTimeout(timer)}\n}\n\n`;
source=source.replace(marker,helper+marker);
const old=`      try{curated[key]=await fetchPublicMdbList(url,type);console.log(\`Seed Snoak \${key}: \${curated[key].items.length} public fallback entries.\`)}\n      catch(publicErr){console.warn(\`Snoak \${key} seed refresh unavailable: \${workerErr.message}; public fallback: \${publicErr.message}\`);if(previous?.curated?.[key]?.items?.length>=100)curated[key]=previous.curated[key]}`;
const next=`      try{\n        const traktUrl=type==='movie'?'https://media-og.trakt.tv/movies/trending':'https://trakt.tv/shows/trending';\n        curated[key]=await fetchPublicTraktTrending(traktUrl,type);\n        console.log(\`Seed Snoak \${key}: \${curated[key].items.length} direct Trakt fallback entries.\`);\n      }catch(traktErr){\n        try{curated[key]=await fetchPublicMdbList(url,type);console.log(\`Seed Snoak \${key}: \${curated[key].items.length} MDBList public fallback entries.\`)}\n        catch(publicErr){console.warn(\`Snoak \${key} seed refresh unavailable: \${workerErr.message}; Trakt fallback: \${traktErr.message}; MDBList fallback: \${publicErr.message}\`);if(previous?.curated?.[key]?.items?.length>=100)curated[key]=previous.curated[key]}\n      }`;
if(!source.includes(old)) throw new Error('Worker/public fallback anchor not found');
source=source.replace(old,next);
fs.writeFileSync(path,source);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Add direct Trakt Top 100 seed fallback for v0.8.41 [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 direct Trakt seed fallback promoted.');
