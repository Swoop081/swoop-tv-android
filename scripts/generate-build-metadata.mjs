import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const gradle=fs.readFileSync(path.join(root,'app/build.gradle'),'utf8');
const app=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8');
const notes=fs.readFileSync(path.join(root,'RELEASE_NOTES.md'),'utf8');
const version=gradle.match(/versionName\s+'([^']+)'/)?.[1];
const versionCode=Number(gradle.match(/versionCode\s+(\d+)/)?.[1]||0);
if(!version||!versionCode)throw new Error('Could not resolve Android versionName/versionCode');
if(!app.includes(`const ANDROID_CURRENT_VERSION='${version}';`))throw new Error(`app.js version does not match ${version}`);
const heading=`## v${version}`;
const start=notes.indexOf(heading);
if(start<0)throw new Error(`RELEASE_NOTES.md is missing ${heading}`);
const next=notes.indexOf('\n## ',start+heading.length);
const section=notes.slice(start,next<0?notes.length:next);
const changes=section.split('\n').filter(line=>/^\s*-\s+/.test(line)).map(line=>line.replace(/^\s*-\s+/,'').replace(/\*\*/g,'').replace(/`/g,'')).slice(0,8);
if(!changes.length)throw new Error(`No release-note bullets found for v${version}`);
const repo=process.env.GITHUB_REPOSITORY||'OWNER/REPOSITORY';
const stable='Swoop-TV-v0.8.1-Google-TV-Test.apk';
const versioned=`Swoop-TV-v${version}-Google-TV-Test.apk`;
const manifest={version,versionCode,updateUrl:`https://github.com/${repo}/releases/download/google-tv-test-v0.8.1/${stable}`,changes};
fs.writeFileSync(path.join(root,'swoop-tv-latest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'build-metadata.json'),JSON.stringify({version,versionCode,versionedApk:versioned,stableApk:stable,changes},null,2)+'\n');
fs.writeFileSync(path.join(root,'release-summary.md'),`Swoop TV Google TV hardware-test channel — current v${version}.\n\n${changes.map(x=>`- ${x}`).join('\n')}\n\nTest-only signing identity; not a production release.\n`);
if(process.env.GITHUB_OUTPUT){fs.appendFileSync(process.env.GITHUB_OUTPUT,`version=${version}\nversion_code=${versionCode}\nversioned_apk=${versioned}\nstable_apk=${stable}\n`)}
console.log(`Generated build metadata for v${version} (${versionCode})`);
