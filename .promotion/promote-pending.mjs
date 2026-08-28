import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let s=fs.readFileSync(path,'utf8');
const anchor="        const scripts=[...html.matchAll(/<script\\b[^>]*src=[\"']([^\"']+)[\"'][^>]*>/gi)].map(m=>m[1]).slice(0,30);\n        console.log(`app.trakt.tv script src ${mediaType}: ${JSON.stringify(scripts)}`);\n";
const replacement="        const scripts=[...html.matchAll(/<script\\b[^>]*src=[\"']([^\"']+)[\"'][^>]*>/gi)].map(m=>m[1]).slice(0,30);\n        console.log(`app.trakt.tv script src ${mediaType}: ${JSON.stringify(scripts)}`);\n        const jsPaths=[...new Set([...html.matchAll(/\\/_app\\/immutable\\/[^\\\"'<>\\s]+?\\.js/g)].map(m=>m[0]))].slice(0,40);\n        console.log(`app.trakt.tv immutable js ${mediaType}: ${JSON.stringify(jsPaths)}`);\n        const jsSignals=[];\n        for(const jsPath of jsPaths.slice(0,20)){\n          try{\n            const js=execLocalFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','15','--connect-timeout','8','--http1.1','--compressed','https://app.trakt.tv'+jsPath],{encoding:'utf8',maxBuffer:20*1024*1024});\n            const lower=js.toLowerCase();\n            const needles=['api.trakt.tv','trakt-api-key','client-id','client_id','/users/','/lists/','list_items','list-items','lists/items','trakt-api-version'];\n            const hits=[];\n            for(const needle of needles){let at=lower.indexOf(needle.toLowerCase());if(at>=0)hits.push(needle+': '+js.slice(Math.max(0,at-350),Math.min(js.length,at+1100)).replace(/\\s+/g,' '));}\n            if(hits.length)jsSignals.push({path:jsPath,size:js.length,hits});\n          }catch{}\n        }\n        console.log(`app.trakt.tv JS API signals ${mediaType}: ${JSON.stringify(jsSignals).slice(0,24000)}`);\n";
if(!s.includes(anchor))throw new Error('Trakt shell diagnostic anchor not found');
s=s.replace(anchor,replacement);
fs.writeFileSync(path,s);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Inspect Trakt Svelte API bundles [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Trakt Svelte API bundle diagnostics promoted.');
