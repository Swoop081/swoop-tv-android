import fs from 'node:fs';
import {execSync} from 'node:child_process';

const path='tests/tv-ui-runtime-smoke.mjs';
let source=fs.readFileSync(path,'utf8');
const from=`if (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.48';")) throw new Error('Current Android UI version marker missing');`;
const to=`if (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.49';")) throw new Error('Current Android UI version marker missing');`;
if(!source.includes(from))throw new Error('Expected v0.8.48 validator guard not found');
source=source.replace(from,to);
fs.writeFileSync(path,source);
fs.rmSync('.promotion/promote-pending.mjs');
execSync('git config user.name "Swoop081"');
execSync('git config user.email "justinbelot8@gmail.com"');
execSync('git add tests/tv-ui-runtime-smoke.mjs .promotion/promote-pending.mjs');
execSync('git commit -m "Fix v0.8.49 validator version guard [skip ci]"');
execSync('git push origin HEAD:main');
console.log('v0.8.49 validator version guard promoted.');
