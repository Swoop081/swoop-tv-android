import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const path='tests/tv-ui-runtime-smoke.mjs';
let s=fs.readFileSync(path,'utf8');
const old=`if (!appSource.includes('const ARTWORK_PREWARM_MEMORY_LIMIT=NATIVE_ANDROID?48:260') || !appSource.includes('function trimArtworkPrewarmPool()')) throw new Error('v0.8.37 Android decoded-artwork memory cap missing');`;
const next=`if (!appSource.includes('const ARTWORK_PREWARM_MEMORY_LIMIT=NATIVE_ANDROID?48:260') || !appSource.includes('function trimArtworkPrewarmPool(limit=ARTWORK_PREWARM_MEMORY_LIMIT)')) throw new Error('v0.8.53 Android decoded-artwork memory cap missing');`;
if(!s.includes(old)&&!s.includes(next))throw new Error('Expected artwork-memory smoke guard not found');
if(s.includes(old))s=s.replace(old,next);
fs.writeFileSync(path,s);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','Swoop TV Build']);
execFileSync('git',['config','user.email','actions@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Align v0.8.53 parameterized artwork memory guard [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.53 parameterized artwork memory smoke guard aligned.');
