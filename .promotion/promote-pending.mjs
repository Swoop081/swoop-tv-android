import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let s=fs.readFileSync(path,'utf8');
const anchor="              console.log(`app.trakt.tv node52 imports ${mediaType}: ${JSON.stringify(imports)}`);\n";
const replacement="              console.log(`app.trakt.tv node52 imports ${mediaType}: ${JSON.stringify(imports)}`);\n              const importSignals=[];\n              for(const chunk of imports){\n                try{\n                  const chunkUrl='https://app.trakt.tv/_app/immutable/chunks/'+chunk;\n                  const chunkJs=execLocalFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','15','--connect-timeout','8','--http1.1','--compressed',chunkUrl],{encoding:'utf8',maxBuffer:24*1024*1024});\n                  const lower=chunkJs.toLowerCase();\n                  const needles=['users.lists.list','list.items','list_id','api.trakt.tv','apiz','trakt-api-key','trakt-api-version','client_id','client-id','authorization','/users/','/lists/','items({','items:','pagination','limit:'];\n                  const hits=[];\n                  for(const needle of needles){\n                    let from=0,count=0;\n                    while(count<3){const at=lower.indexOf(needle.toLowerCase(),from);if(at<0)break;hits.push(needle+': '+chunkJs.slice(Math.max(0,at-650),Math.min(chunkJs.length,at+2400)).replace(/\\s+/g,' '));from=at+needle.length;count++;}\n                  }\n                  if(hits.length)importSignals.push({chunk,size:chunkJs.length,hits});\n                }catch(err){importSignals.push({chunk,error:String(err?.message||err)});}\n              }\n              console.log(`app.trakt.tv node52 import API signals ${mediaType}: ${JSON.stringify(importSignals).slice(0,60000)}`);\n";
if(!s.includes(anchor))throw new Error('node52 imports anchor not found');
s=s.replace(anchor,replacement);
fs.writeFileSync(path,s);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Inspect Trakt list-items client chunks [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Trakt list-items client chunk diagnostics promoted.');
