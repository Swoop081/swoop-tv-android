import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const file=path.join(root,'tests/tv-ui-runtime-smoke.mjs');
let tests=fs.readFileSync(file,'utf8');
const oldLine=`if (!profilesSource.includes("providerMode='shared'") || !profilesSource.includes('privateProviders=[]')) throw new Error('Profile provider ownership fields missing');`;
const newLine=`if (!profilesSource.includes("providerMode='private'") || !profilesSource.includes('privateProviders=[]')) throw new Error('Privacy-first profile provider ownership fields missing');`;
if(!tests.includes(oldLine))throw new Error('Obsolete shared-profile regression anchor missing');
tests=tests.replace(oldLine,newLine);
fs.writeFileSync(file,tests);
try{fs.unlinkSync(path.join(root,'.promotion/promote-pending.mjs'))}catch{}
execFileSync('git',['config','user.name','github-actions[bot]'],{stdio:'inherit'});
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],{stdio:'inherit'});
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Correct v0.8.46 privacy regression contract [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Corrected obsolete shared-provider regression; privacy-first v0.8.46 contract enforced.');
