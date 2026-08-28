import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='tests/tv-ui-runtime-smoke.mjs';
let source=fs.readFileSync(path,'utf8');
const from=`if (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.49';")) throw new Error('v0.8.49 Android web runtime version marker missing');`;
const to=`if (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.50';")) throw new Error('v0.8.50 Android web runtime version marker missing');`;
if(!source.includes(from)) throw new Error('Expected stale v0.8.49 onboarding validator was not found');
source=source.replace(from,to);
fs.writeFileSync(path,source);

try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
try{fs.rmSync('.promotion/build-request-850.txt')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Fix final v0.8.50 onboarding validator [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Final v0.8.50 onboarding validator corrected.');
