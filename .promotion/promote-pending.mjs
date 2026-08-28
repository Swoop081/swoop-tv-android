import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const file=path.join(root,'tests/tv-ui-runtime-smoke.mjs');
let tests=fs.readFileSync(file,'utf8');
const oldLine=`if (!appSource.includes('state.sharedProviders=') || !appSource.includes("profile.providerMode==='private'")) throw new Error('Household/private provider scope migration missing');`;
const newLine=`if (!appSource.includes('state.sharedProviders=') || !appSource.includes("const PROVIDER_ACCOUNT_SCHEMA=2") || !appSource.includes("return profile.providerMode==='shared'?'shared':'private'")) throw new Error('Privacy-first household/private provider scope migration missing');`;
if(!tests.includes(oldLine))throw new Error('Stale provider-scope regression anchor missing');
tests=tests.replace(oldLine,newLine);
fs.writeFileSync(file,tests);
try{fs.unlinkSync(path.join(root,'.promotion/promote-pending.mjs'))}catch{}
execFileSync('git',['config','user.name','github-actions[bot]'],{stdio:'inherit'});
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],{stdio:'inherit'});
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Finalize v0.8.46 privacy regression contract [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Final v0.8.46 privacy regression contract corrected.');
