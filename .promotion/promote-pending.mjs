import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const test='tests/tv-ui-runtime-smoke.mjs';
let s=fs.readFileSync(test,'utf8');
const old="if (!appSource.includes('void prepareStarmeterBeforeLogin().catch(()=>false)')) throw new Error('Profile selection still blocks on STARmeter preparation');";
const next="if (!appSource.includes('setTimeout(()=>prepareStarmeterBeforeLogin().catch(()=>false),5000)')) throw new Error('STARmeter optimisation is not deferred until after profile entry');";
if(!s.includes(old))throw new Error('Obsolete pre-login STARmeter validator not found');
if(s.indexOf(old)!==s.lastIndexOf(old))throw new Error('Obsolete pre-login STARmeter validator is ambiguous');
s=s.replace(old,next);
fs.writeFileSync(test,s,'utf8');

for(const p of ['.promotion/promote-pending.mjs','.promotion/build-request.txt']){try{fs.rmSync(p)}catch{}}
execFileSync('git',['config','user.name','Swoop TV Build'],{stdio:'inherit'});
execFileSync('git',['config','user.email','actions@users.noreply.github.com'],{stdio:'inherit'});
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Fix v0.8.51 STARmeter validator [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.51 validator corrected.');
