import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let s=fs.readFileSync(path,'utf8');
const anchor="        console.log(`app.trakt.tv curl ${mediaType}: ${html.length} bytes.`);\n";
if(!s.includes(anchor)) throw new Error('curl diagnostic anchor missing');
const insert=`        console.log(\`app.trakt.tv curl \${mediaType}: \${html.length} bytes.\`);\n        const titleMatch=html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i);\n        console.log(\`app.trakt.tv shell title \${mediaType}: \${titleMatch?decodeHtmlText(titleMatch[1]).replace(/\\s+/g,' ').trim():'(none)'}\`);\n        const markerNames=['__NEXT_DATA__','__remixContext','__sveltekit','data-router','api.trakt','graphql','snoak','trakt-s-trending','application/ld+json','vite','webpack'];\n        console.log(\`app.trakt.tv shell markers \${mediaType}: \${markerNames.filter(x=>html.toLowerCase().includes(x.toLowerCase())).join(',')||'(none)'}\`);\n        const scripts=[...html.matchAll(/<script\\b[^>]*src=[\"']([^\"']+)[\"'][^>]*>/gi)].map(m=>m[1]).slice(0,30);\n        console.log(\`app.trakt.tv script src \${mediaType}: \${JSON.stringify(scripts)}\`);\n        const hrefs=[...html.matchAll(/(?:href|content)=[\"'](https?:\\/\\/[^\"']+|\\/[^\"']+)[\"']/gi)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i).slice(0,50);\n        console.log(\`app.trakt.tv href/content \${mediaType}: \${JSON.stringify(hrefs)}\`);\n        const snippets=[];\n        for(const needle of ['snoak','trakt-s-trending','api.trakt','graphql','__NEXT_DATA__','__remixContext']){const i=html.toLowerCase().indexOf(needle.toLowerCase());if(i>=0)snippets.push(needle+': '+html.slice(Math.max(0,i-350),Math.min(html.length,i+900)).replace(/\\s+/g,' '));}\n        console.log(\`app.trakt.tv structural snippets \${mediaType}: \${JSON.stringify(snippets).slice(0,8000)}\`);\n`;
s=s.replace(anchor,insert);
fs.writeFileSync(path,s);
execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Inspect app.trakt.tv list shell structure [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('app.trakt.tv shell diagnostics promoted.');
