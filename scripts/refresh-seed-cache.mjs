import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
const run=(c,a=[],o={})=>execFileSync(c,a,{stdio:'inherit',...o});
const out=(c,a=[])=>execFileSync(c,a,{encoding:'utf8'});
const chunks=Array.from({length:6},(_,i)=>`scripts/.v0836-patch-${i}.b64`);
const packed=chunks.map(p=>readFileSync(p,'utf8').trim()).join('');
const fullPatch=inflateSync(Buffer.from(packed,'base64')).toString('utf8');
const allowed=new Set([
  'app/build.gradle','app/src/main/assets/app.js','app/src/main/assets/src/storage.js','app/src/main/assets/sw.js',
  'app/src/main/java/tv/swoop/player/MainActivity.java','scripts/refresh-seed-cache.mjs','app/src/main/assets/src/performancePack.js'
]);
const sections=fullPatch.split(/(?=^--- )/m).filter(Boolean);
const selected=[];
for(const section of sections){
  const m=section.match(/^--- (?:a\/([^\n]+)|\/dev\/null)\n\+\+\+ (?:b\/([^\n]+)|\/dev\/null)/);
  const path=m?.[2]||m?.[1]||'';
  if(allowed.has(path))selected.push(section);
}
if(selected.length!==allowed.size)throw new Error(`Expected ${allowed.size} runtime patch sections, found ${selected.length}`);
writeFileSync('/tmp/swoop-v0836-runtime.patch',selected.join(''));
// The current main staging commit temporarily replaced the real seed refresher with this runner.
// Restore the exact verified v0.8.35 refresher before applying its one-line v0.8.36 version change.
run('git',['fetch','--no-tags','--depth=1','origin','39afc7c34cc79a04cb4ba5baba9be857054364bc']);
writeFileSync('scripts/refresh-seed-cache.mjs',out('git',['show','39afc7c34cc79a04cb4ba5baba9be857054364bc:scripts/refresh-seed-cache.mjs']));
// Normalize the only known formatting-only drift between the verified local v0.8.35 source and current GitHub main.
let baseApp=readFileSync('app/src/main/assets/app.js','utf8');
baseApp=baseApp.replace("function scheduleStarmeterPatchFlush(delay=180){if(starmeterPatchTimer||state.page!=='starmeter')return;starmeterPatchTimer=setTimeout(flushStarmeterDeferredPatches,Math.max(80,Number(delay||180)))}","function scheduleStarmeterPatchFlush(delay=180){\n  if(starmeterPatchTimer||state.page!=='starmeter')return;starmeterPatchTimer=setTimeout(flushStarmeterDeferredPatches,Math.max(80,Number(delay||180)));\n}");
baseApp=baseApp.replace("if(performance.now()-starmeterLastFocusMoveAt<180){scheduleStarmeterPatchFlush(180);return}const activeRank=","if(performance.now()-starmeterLastFocusMoveAt<180){scheduleStarmeterPatchFlush(180);return}\n  const activeRank=");
writeFileSync('app/src/main/assets/app.js',baseApp);
console.log('Applying the v0.8.36 runtime patch with formatting-tolerant context matching…');
run('patch',['--dry-run','--batch','--forward','--fuzz=3','-p1','-i','/tmp/swoop-v0836-runtime.patch']);
run('patch',['--batch','--forward','--fuzz=3','-p1','-i','/tmp/swoop-v0836-runtime.patch']);
// Install the exact v0.8.36 regression suite, then make its CSS assertion formatting-insensitive
// because the live GitHub v0.8.35 stylesheet is minified differently from the local verified snapshot.
const testBlob='scripts/.v0836-test.b64';
writeFileSync('tests/tv-ui-runtime-smoke.mjs',inflateSync(Buffer.from(readFileSync(testBlob,'utf8').trim(),'base64')));
let testSource=readFileSync('tests/tv-ui-runtime-smoke.mjs','utf8');
testSource=testSource.replace("!cssSource.includes('.starmeter-person-card{\\n  transition:none!important')","!/\\.starmeter-person-card\\s*\\{\\s*transition\\s*:\\s*none!important/.test(cssSource)");
writeFileSync('tests/tv-ui-runtime-smoke.mjs',testSource);
// Keep the canonical changelog current even though old GitHub docs had harmless formatting drift.
let notes=readFileSync('RELEASE_NOTES.md','utf8');
if(!notes.includes('## v0.8.36 — Performance Pack + Incremental Library Cache')){
  const section=`## v0.8.36 — Performance Pack + Incremental Library Cache\n\n- Adds a persistent Performance Pack so installer seed data, provider fingerprints, metadata knowledge and artwork cache state survive normal launches and APK upgrades.\n- Provider refreshes calculate catalogue deltas and prioritise only added/changed titles instead of repeating expensive preparation for unchanged content.\n- STARmeter person/library matches persist for 90 days independently of rank, so rank movement does not trigger rematching; new/stale people are handled incrementally.\n- Freezes STARmeter asynchronous DOM hydration throughout a held/long-pressed D-pad direction and resumes only after key release plus scroll settle.\n\n`;
  notes=notes.startsWith('# Swoop TV Release Notes\n\n')?notes.replace('# Swoop TV Release Notes\n\n','# Swoop TV Release Notes\n\n'+section):section+notes;
  writeFileSync('RELEASE_NOTES.md',notes);
}
for(const p of [...chunks,'scripts/.v0836-test.b64'])try{unlinkSync(p)}catch{}
const app=readFileSync('app/src/main/assets/app.js','utf8'),gradle=readFileSync('app/build.gradle','utf8');
if(!gradle.includes("versionName '0.8.36'")||!gradle.includes('versionCode 836'))throw new Error('Gradle did not promote to v0.8.36/836');
if(!app.includes("const ANDROID_CURRENT_VERSION='0.8.36';")||!app.includes("from './src/performancePack.js'")||!app.includes('starmeterHeldDirectional'))throw new Error('v0.8.36 app promotion contract failed');
console.log('Runtime source promoted. Refreshing installer seed and running the full validation gate…');
run(process.execPath,['scripts/refresh-seed-cache.mjs']);
run(process.execPath,['scripts/generate-build-metadata.mjs']);
for(const p of ['app/src/main/assets/app.js','app/src/main/assets/src/performancePack.js','app/src/main/assets/src/storage.js','scripts/refresh-seed-cache.mjs'])run(process.execPath,['--check',p]);
run(process.execPath,['tests/card-runtime-smoke.mjs']);
run(process.execPath,['tests/tv-ui-runtime-smoke.mjs']);
run('python',['-m','json.tool','app/src/main/assets/seed-cache.json'],{stdio:'ignore'});
run('python',['-m','json.tool','swoop-tv-seed-cache.json'],{stdio:'ignore'});
run('git',['config','user.name','github-actions[bot]']);run('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
run('git',['add','-A']);
const status=out('git',['status','--porcelain']).trim();
if(status){run('git',['commit','-m','Promote v0.8.36 Performance Pack and incremental library cache']);run('git',['push','origin','HEAD:main']);}
console.log('v0.8.36 source promotion complete; continuing the current APK build and Downloader publication.');
