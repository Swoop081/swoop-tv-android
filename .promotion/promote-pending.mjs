import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let source=fs.readFileSync(path,'utf8');
const old=`async function fetchPublicMdbList(url,mediaType){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; SwoopTV-Seed/0.8.41; +https://github.com/Swoop081/swoop-tv-android)','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});
    if(!res.ok)throw new Error(\`MDBList page HTTP \${res.status}\`);const html=await res.text(),items=parsePublicMdbList(html,mediaType);if(items.length<100)throw new Error(\`MDBList page parser found only \${items.length} \${mediaType} entries\`);
    return {items,source:'Snoak · Trakt Trending via MDBList',sourceUrl:url,sourceUpdatedAt:Date.now()};
  }finally{clearTimeout(timer)}
}`;
const next=`async function fetchPublicMdbList(url,mediaType){
  const items=[],seen=new Set();
  for(let page=0;page<6&&items.length<120;page++){
    const pageUrl=new URL(url);pageUrl.searchParams.set('page',String(page));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const res=await fetch(pageUrl,{headers:{'user-agent':'Mozilla/5.0 (compatible; SwoopTV-Seed/0.8.41; +https://github.com/Swoop081/swoop-tv-android)','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});
      if(!res.ok)throw new Error(\`MDBList page \${page} HTTP \${res.status}\`);
      const html=await res.text(),pageItems=parsePublicMdbList(html,mediaType);let added=0;
      for(const item of pageItems){const key=\`\${normalize(item.title)}|\${item.year}\`;if(!normalize(item.title)||seen.has(key))continue;seen.add(key);items.push(item);added++;}
      if(!pageItems.length||(page>0&&!added))break;
    }finally{clearTimeout(timer)}
  }
  if(items.length<100)throw new Error(\`MDBList paged parser found only \${items.length} \${mediaType} entries\`);
  return {items:items.slice(0,100),source:'Snoak · Trakt Trending via MDBList',sourceUrl:url,sourceUpdatedAt:Date.now()};
}`;
if(!source.includes(old))throw new Error('Expected single-page MDBList seed loader was not found');
source=source.replace(old,next);
fs.writeFileSync(path,source);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Fix v0.8.41 paged Snoak seed ingestion [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 MDBList seed ingestion now merges pages into a true Top 100.');
