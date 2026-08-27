import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const run=(c,a=[],o={})=>execFileSync(c,a,{stdio:'inherit',...o});
const out=(c,a=[])=>execFileSync(c,a,{encoding:'utf8'});
const chunks=[
  'scripts/.v0837-patch-00a0.b64',
  'scripts/.v0837-patch-00a1.b64',
  'scripts/.v0837-patch-00a2.b64',
  'scripts/.v0837-patch-00a3.b64',
  'scripts/.v0837-patch-00b.b64',
  'scripts/.v0837-patch-01.b64',
  'scripts/.v0837-patch-02.b64',
  'scripts/.v0837-patch-03.b64'
];
const packed=chunks.map(p=>readFileSync(p,'utf8').trim()).join('');
const raw=inflateSync(Buffer.from(packed,'base64'));
const digest=createHash('sha256').update(raw).digest('hex');
if(digest!=='4866f37be0ce718e6213b2d4d8f973f3fe1af70be6a1677bb96160b2ce60c29b')throw new Error(`v0.8.37 patch payload checksum mismatch: ${digest}`);
const payload=JSON.parse(raw.toString('utf8'));
if(payload.version!=='0.8.37'||!payload.patches||!payload.files)throw new Error('Invalid v0.8.37 patch payload');
for(const [path,sourcePatch] of Object.entries(payload.patches)){
  const lines=String(sourcePatch).split('\n');
  if(!lines[0]?.startsWith('--- ')||!lines[1]?.startsWith('+++ '))throw new Error(`Malformed patch for ${path}`);
  lines[0]=`--- ${path}`;lines[1]=`+++ ${path}`;
  const patchPath=`.v0837-${path.replace(/[^a-z0-9]+/gi,'_')}.patch`;
  writeFileSync(patchPath,lines.join('\n'));
  try{run('patch',['-p0','--batch','--forward','--fuzz=3','-i',patchPath])}finally{try{unlinkSync(patchPath)}catch{}}
}
for(const [path,content] of Object.entries(payload.files)){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,content)}
if(payload.releaseNotesSection){
  const notesPath='RELEASE_NOTES.md',current=readFileSync(notesPath,'utf8');
  if(!current.includes('## v0.8.37 — TV UX + STARmeter Memory/Crash Hotfix')){
    const header='# Swoop TV Release Notes\n\n';
    writeFileSync(notesPath,current.startsWith(header)?header+payload.releaseNotesSection+current.slice(header.length):header+payload.releaseNotesSection+current);
  }
}
for(const p of chunks)try{unlinkSync(p)}catch{}
for(const p of ['scripts/.v0837-patch-00.b64','scripts/.v0837-patch-00a.b64','scripts/.v0837-full-00.b64','scripts/.v0837-full-01.b64'])try{unlinkSync(p)}catch{}
console.log(`Applied ${Object.keys(payload.patches).length} live-source patches and installed ${Object.keys(payload.files).length} v0.8.37 files.`);
run(process.execPath,['scripts/refresh-seed-cache.mjs']);
run(process.execPath,['scripts/generate-build-metadata.mjs']);
for(const p of ['app/src/main/assets/app.js','app/src/main/assets/src/performancePack.js','app/src/main/assets/src/storage.js','app/src/main/assets/sw.js','scripts/refresh-seed-cache.mjs','tests/tv-ui-runtime-smoke.mjs'])run(process.execPath,['--check',p]);
run(process.execPath,['tests/card-runtime-smoke.mjs']);
run(process.execPath,['tests/tv-ui-runtime-smoke.mjs']);
run('python',['-m','json.tool','app/src/main/assets/seed-cache.json'],{stdio:'ignore'});
run('python',['-m','json.tool','swoop-tv-seed-cache.json'],{stdio:'ignore'});
const app=readFileSync('app/src/main/assets/app.js','utf8'),styles=readFileSync('app/src/main/assets/styles.css','utf8'),gradle=readFileSync('app/build.gradle','utf8'),java=readFileSync('app/src/main/java/tv/swoop/player/MainActivity.java','utf8');
if(!app.includes("const ANDROID_CURRENT_VERSION='0.8.37';")||!app.includes('ARTWORK_PREWARM_MEMORY_LIMIT=NATIVE_ANDROID?48:260')||!app.includes('scheduleMySwoopHeroRotation')||!app.includes('STARMETER_TITLE_RENDER_LIMIT=8'))throw new Error('v0.8.37 app contract missing after promotion');
if(!styles.includes('v0.8.37 — TV UX consolidation + STARmeter memory/crash hotfix')||!styles.includes('height:136px!important'))throw new Error('v0.8.37 TV layout contract missing after promotion');
if(!gradle.includes("versionName '0.8.37'")||!gradle.includes('versionCode 837'))throw new Error('v0.8.37 Gradle contract missing');
if(!java.includes('AspectRatioFrameLayout.RESIZE_MODE_ZOOM')||!java.includes('SwoopTV/0.8.37 AndroidTV'))throw new Error('v0.8.37 native preview/version contract missing');
run('git',['config','user.name','github-actions[bot]']);run('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
run('git',['add','-A']);const status=out('git',['status','--porcelain']).trim();if(!status)throw new Error('v0.8.37 promotion produced no source changes');
run('git',['commit','-m','Promote v0.8.37 TV UX and STARmeter memory crash hotfix']);
run('git',['push','origin','HEAD:main']);
console.log('v0.8.37 source promotion complete; continuing APK build and Downloader publication.');
