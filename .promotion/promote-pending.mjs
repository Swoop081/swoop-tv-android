import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='tests/tv-ui-runtime-smoke.mjs';
const line="const installSeed = JSON.parse(fs.readFileSync(new URL('../app/src/main/assets/seed-cache.json', import.meta.url), 'utf8'));\n";
let source=fs.readFileSync(path,'utf8');
const first=source.indexOf(line);
const second=first<0?-1:source.indexOf(line,first+line.length);
if(first<0||second<0)throw new Error('Expected duplicate installSeed declarations were not found');
source=source.slice(0,second)+source.slice(second+line.length);
fs.writeFileSync(path,source);

try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Fix v0.8.41 duplicate seed smoke fixture [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 duplicate seed smoke fixture removed.');
