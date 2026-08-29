import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const path='tests/tv-ui-runtime-smoke.mjs';
let s=fs.readFileSync(path,'utf8');
const old="if (!swSource.includes('swoop-tv-v0851-shell')) throw new Error('v0.8.51 service-worker cache marker missing');";
const next="if (!swSource.includes('swoop-tv-v0852-shell')) throw new Error('v0.8.52 service-worker cache marker missing');";
if(!s.includes(old)&&!s.includes(next))throw new Error('Expected service-worker cache smoke assertion not found');
if(s.includes(old))s=s.replace(old,next);
fs.writeFileSync(path,s);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','Swoop TV Build']);
execFileSync('git',['config','user.email','actions@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Align v0.8.52 service-worker smoke assertion [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.52 service-worker smoke assertion aligned.');
