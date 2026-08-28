import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let s=fs.readFileSync(path,'utf8');
const anchor="        console.log(`app.trakt.tv JS API signals ${mediaType}: ${JSON.stringify(jsSignals).slice(0,24000)}`);\n";
const replacement="        console.log(`app.trakt.tv JS API signals ${mediaType}: ${JSON.stringify(jsSignals).slice(0,24000)}`);\n        try{\n          const appPath=jsPaths.find(p=>/\\/entry\\/app\\./.test(p));\n          if(appPath){\n            const appJs=execLocalFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','15','--http1.1','--compressed','https://app.trakt.tv'+appPath],{encoding:'utf8',maxBuffer:20*1024*1024});\n            const nodeChunks=[...appJs.matchAll(/import\\(\\`?\\.\\.\\/nodes\\/([^\\`\"')]+\\.js)\\`?\\)/g)].map(m=>m[1]);\n            console.log(`app.trakt.tv route node chunks ${mediaType}: count=${nodeChunks.length}, node52=${nodeChunks[52]||'(missing)'}`);\n            const routeChunk=nodeChunks[52];\n            if(routeChunk){\n              const routeJs=execLocalFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','15','--http1.1','--compressed','https://app.trakt.tv/_app/immutable/nodes/'+routeChunk],{encoding:'utf8',maxBuffer:20*1024*1024});\n              const needles=['api.trakt.tv','apiz','/users/','/lists/','items','trakt-api-key','client-id','client_id','fetch(','load','public'];\n              const hits=[];for(const needle of needles){let at=routeJs.toLowerCase().indexOf(needle.toLowerCase());if(at>=0)hits.push(needle+': '+routeJs.slice(Math.max(0,at-500),Math.min(routeJs.length,at+1800)).replace(/\\s+/g,' '));}\n              console.log(`app.trakt.tv node52 signals ${mediaType}: size=${routeJs.length} ${JSON.stringify(hits).slice(0,32000)}`);\n              const imports=[...new Set([...routeJs.matchAll(/\\.\\.\\/chunks\\/([^\\\"'`)]+\\.js)/g)].map(m=>m[1]))].slice(0,40);\n              console.log(`app.trakt.tv node52 imports ${mediaType}: ${JSON.stringify(imports)}`);\n            }\n          }\n        }catch(err){console.warn(`app.trakt.tv node52 diagnostic ${mediaType} failed: ${String(err?.message||err)}`)}\n";
if(!s.includes(anchor))throw new Error('JS signal anchor not found');
s=s.replace(anchor,replacement);
fs.writeFileSync(path,s);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Inspect Trakt public list route chunk [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Trakt public-list route chunk diagnostics promoted.');
