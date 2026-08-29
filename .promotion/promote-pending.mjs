import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='tests/tv-ui-runtime-smoke.mjs';
let s=fs.readFileSync(path,'utf8');
const replacements=[
  ["if (!activitySource.includes('public String saveDiagnostics(String payloadJson)') || !activitySource.includes('Swoop-TV-v0.8.44-Diagnostics-')) throw new Error('Android diagnostic file export bridge missing');","if (!activitySource.includes('public String saveDiagnostics(String payloadJson)') || !activitySource.includes('Swoop-TV-v0.8.52-Diagnostics-')) throw new Error('Android diagnostic file export bridge missing');"],
  ["if (!activitySource.includes('SwoopTV/0.8.44 AndroidTV') || !activitySource.includes('public String version() { return \"0.8.44\"; }')) throw new Error('v0.8.44 native Android markers missing');","if (!activitySource.includes('SwoopTV/0.8.52 AndroidTV') || !activitySource.includes('public String version() { return \"0.8.52\"; }')) throw new Error('v0.8.52 native Android markers missing');"],
  ["if (!appSource.includes(\"const ANDROID_CURRENT_VERSION='0.8.51';\")) throw new Error('v0.8.51 Android web runtime version marker missing');","if (!appSource.includes(\"const ANDROID_CURRENT_VERSION='0.8.52';\")) throw new Error('v0.8.52 Android web runtime version marker missing');"]
];
for(const [oldText,newText] of replacements){
  if(!s.includes(oldText)&&!s.includes(newText))throw new Error('Expected stale version smoke guard not found');
  if(s.includes(oldText))s=s.replace(oldText,newText);
}
fs.writeFileSync(path,s);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','Swoop TV Build']);
execFileSync('git',['config','user.email','actions@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Align remaining v0.8.52 version smoke guards [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('All remaining v0.8.52 version-only smoke guards aligned.');
