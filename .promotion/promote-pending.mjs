import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let s=fs.readFileSync(path,'utf8');
const old=`async function fetchPublicMdbList(url,mediaType){
  const items=[],seen=new Set();
  for(let page=0;page<6&&items.length<120;page++){
    const pageUrl=new URL(url);pageUrl.searchParams.set('page',String(page));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const res=await fetch(pageUrl,{headers:{'user-agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});
      if(!res.ok)throw new Error(\`MDBList page \${page} HTTP \${res.status}\`);
      const html=await res.text(),pageItems=parsePublicMdbList(html,mediaType);let added=0;
      for(const item of pageItems){const key=\`\${normalize(item.title)}|\${item.year}\`;if(!normalize(item.title)||seen.has(key))continue;seen.add(key);items.push(item);added++;}
      if(!pageItems.length||(page>0&&!added))break;
    }finally{clearTimeout(timer)}
  }
  if(items.length<100)throw new Error(\`MDBList paged parser found only \${items.length} \${mediaType} entries\`);
  return {items:items.slice(0,100),source:'Snoak · Trakt Trending via MDBList',sourceUrl:url,sourceUpdatedAt:Date.now()};
}`;
const next=`async function fetchPublicMdbList(url,mediaType){
  const items=[],seen=new Set(),pages=[null,1,2,3,4,5,6];
  for(const page of pages){
    if(items.length>=120)break;
    const pageUrl=new URL(url);if(page!==null)pageUrl.searchParams.set('page',String(page));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const res=await fetch(pageUrl,{headers:{'user-agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});
      if(!res.ok)throw new Error(\`MDBList page \${page??'base'} HTTP \${res.status}\`);
      const html=await res.text(),pageItems=parsePublicMdbList(html,mediaType);let added=0;
      for(const item of pageItems){const key=\`\${normalize(item.title)}|\${item.year}\`;if(!normalize(item.title)||seen.has(key))continue;seen.add(key);items.push(item);added++;}
      console.log(\`MDBList \${mediaType} page \${page??'base'}: \${pageItems.length} parsed, \${added} new, \${items.length} total.\`);
      if(!pageItems.length)break;
    }finally{clearTimeout(timer)}
  }
  if(items.length<100)throw new Error(\`MDBList paged parser found only \${items.length} \${mediaType} entries\`);
  return {items:items.slice(0,100),source:'Snoak · Trakt Trending via MDBList',sourceUrl:url,sourceUpdatedAt:Date.now()};
}`;
if(!s.includes(old))throw new Error('Expected MDBList paging block was not found');
s=s.replace(old,next);
fs.writeFileSync(path,s);
execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Fix v0.8.41 MDBList list page traversal [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 MDBList one-based page traversal promoted.');
