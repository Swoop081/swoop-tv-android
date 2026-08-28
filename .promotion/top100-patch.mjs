import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const testPath='tests/tv-ui-runtime-smoke.mjs';
let tests=fs.readFileSync(testPath,'utf8');
const old=`if (!appSource.includes("if(NATIVE_ANDROID){render();setTimeout(()=>{refreshPerformancePackInfo().catch(()=>null);prepareStarmeterBeforeLogin().catch(()=>false)}")) throw new Error('STARmeter preparation does not start on the profile picker');`;
const next=`if (!appSource.includes('async function bootstrapAndroidPreLogin()') || !appSource.includes('prepareStarmeterBeforeLogin().catch(()=>false)')) throw new Error('STARmeter preparation does not start during the Android pre-login boot pipeline');`;
if(!tests.includes(old))throw new Error('Legacy STARmeter pre-login regression assertion not found');
tests=tests.replace(old,next);
fs.writeFileSync(testPath,tests);
fs.rmSync('.promotion/top100-patch.mjs',{force:true});
try{fs.rmdirSync('.promotion')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]'],{stdio:'inherit'});
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],{stdio:'inherit'});
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Align v0.8.44 pre-login regression with boot pipeline [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Updated v0.8.44 pre-login STARmeter regression for the new boot pipeline.');
