import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const path='tests/tv-ui-runtime-smoke.mjs';
let s=fs.readFileSync(path,'utf8');
const old=`if (!appSource.includes('function tvPrefetchArtworkWindow(current,ahead=28,behind=3)')) throw new Error('Directional TV artwork prefetch window missing');`;
const next=`if (!appSource.includes('function tvPrefetchArtworkWindow(current,ahead=18,behind=4)')) throw new Error('Bounded directional TV artwork prefetch window missing');`;
if(!s.includes(old)&&!s.includes(next))throw new Error('Expected directional artwork prefetch smoke guard not found');
if(s.includes(old))s=s.replace(old,next);
fs.writeFileSync(path,s);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','Swoop TV Build']);
execFileSync('git',['config','user.email','actions@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Align v0.8.53 bounded artwork prefetch smoke guard [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.53 bounded artwork prefetch smoke guard aligned.');
