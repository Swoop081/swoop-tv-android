import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const path='tests/tv-ui-runtime-smoke.mjs';
let s=fs.readFileSync(path,'utf8');
const old=`if(!activitySource.includes('SwoopTV/0.8.53 AndroidTV')||!activitySource.includes('out.put(\"versionCode\", 852)'))throw new Error('Native Android v0.8.53 markers are not aligned');`;
const next=`if(!activitySource.includes('SwoopTV/0.8.53 AndroidTV')||!activitySource.includes('out.put(\"versionCode\", 853)'))throw new Error('Native Android v0.8.53 markers are not aligned');`;
if(!s.includes(old)&&!s.includes(next))throw new Error('Expected v0.8.53 native version smoke guard not found');
if(s.includes(old))s=s.replace(old,next);
fs.writeFileSync(path,s);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','Swoop TV Build']);
execFileSync('git',['config','user.email','actions@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Fix v0.8.53 native version smoke guard [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.53 native version smoke guard corrected.');
