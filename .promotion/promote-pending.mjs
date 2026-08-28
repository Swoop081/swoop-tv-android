import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function replaceOnce(text,from,to,label){if(!text.includes(from))throw new Error(`Missing promotion anchor: ${label}`);return text.replace(from,to)}

// Keep the app-facing curated keys stable while translating them to the Worker's real allow-list keys.
{
  const path='app/src/main/assets/src/discovery.js';
  let s=read(path);
  const from=`export async function fetchSwoopCuratedList({settings={},listKey='' }={}){\n  if(!listKey)throw new Error('Swoop TV curated-list key is missing.');\n  return postDiscovery(settings,{mode:'snoak-list',listKey:String(listKey)});\n}\n`;
  const to=`export async function fetchSwoopCuratedList({settings={},listKey='' }={}){\n  if(!listKey)throw new Error('Swoop TV curated-list key is missing.');\n  const aliases={'trending-movies':'movies-trakt','trending-shows':'shows-trakt'};\n  const workerKey=aliases[String(listKey)]||String(listKey);\n  return postDiscovery(settings,{mode:'snoak-list',listKey:workerKey});\n}\n`;
  s=replaceOnce(s,from,to,'Snoak worker key alias');
  write(path,s);
}

// Seed through the authenticated Worker first. Preserve the public parser only as a fallback.
{
  const path='scripts/refresh-seed-cache.mjs';
  let s=read(path);
  const from=`let curated={};\nif(!OFFLINE){\n  const jobs=[['trending-movies','https://mdblist.com/lists/snoak/trending-movies','movie'],['trending-shows','https://mdblist.com/lists/snoak/trakt-s-trending-shows','tv']];\n  for(const [key,url,type] of jobs){try{curated[key]=await fetchPublicMdbList(url,type);console.log(\`Seed Snoak \${key}: \${curated[key].items.length} source entries.\`)}catch(err){console.warn(\`Snoak \${key} seed refresh unavailable: \${err.message}\`);if(previous?.curated?.[key]?.items?.length>=100)curated[key]=previous.curated[key]}}\n}\nif(!Object.keys(curated).length&&previous?.curated&&typeof previous.curated==='object')curated=previous.curated;\n`;
  const to=`let curated={};\nif(!OFFLINE){\n  const jobs=[\n    ['trending-movies','movies-trakt','https://mdblist.com/lists/snoak/trending-movies','movie'],\n    ['trending-shows','shows-trakt','https://mdblist.com/lists/snoak/trakt-s-trending-shows','tv']\n  ];\n  for(const [key,workerKey,url,type] of jobs){\n    try{\n      const payload=await post({mode:'snoak-list',listKey:workerKey},20000),items=Array.isArray(payload?.items)?payload.items:[];\n      if(items.length<100)throw new Error(\`Worker returned only \${items.length} entries for \${workerKey}\`);\n      curated[key]={...payload,listKey:key,items:items.slice(0,100)};\n      console.log(\`Seed Snoak \${key}: \${curated[key].items.length} authenticated source entries.\`);\n    }catch(workerErr){\n      try{curated[key]=await fetchPublicMdbList(url,type);console.log(\`Seed Snoak \${key}: \${curated[key].items.length} public fallback entries.\`)}\n      catch(publicErr){console.warn(\`Snoak \${key} seed refresh unavailable: \${workerErr.message}; public fallback: \${publicErr.message}\`);if(previous?.curated?.[key]?.items?.length>=100)curated[key]=previous.curated[key]}\n    }\n  }\n}\nif(!Object.keys(curated).length&&previous?.curated&&typeof previous.curated==='object')curated=previous.curated;\n`;
  s=replaceOnce(s,from,to,'authenticated Snoak seed source');
  write(path,s);
}

try{
  const res=await fetch('https://swoop-tv-connection.justinbelot8.workers.dev',{headers:{accept:'application/json'}});
  console.log('Worker root probe:',res.status,(await res.text()).slice(0,600));
}catch(err){console.warn('Worker root probe unavailable:',err.message)}

try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Fix v0.8.41 Snoak worker list keys [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 Snoak worker key repair promoted.');
