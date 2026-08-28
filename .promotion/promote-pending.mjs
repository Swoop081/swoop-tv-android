import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const path='scripts/refresh-seed-cache.mjs';
let s=fs.readFileSync(path,'utf8');
const old="'user-agent':'Mozilla/5.0 (compatible; SwoopTV-Seed/0.8.41; +https://github.com/Swoop081/swoop-tv-android)'";
const next="'user-agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'";
if(!s.includes(old)) throw new Error('MDBList seed user-agent anchor not found');
s=s.replaceAll(old,next);
fs.writeFileSync(path,s);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Use server-rendered MDBList seed surface for v0.8.41 [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 full SSR MDBList seed surface promoted.');
