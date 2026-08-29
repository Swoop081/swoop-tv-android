import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='RELEASE_NOTES.md';
let notes=fs.readFileSync(path,'utf8');
const section=`## v0.8.52 — High-Resolution Avatar Expansion\n\n- Restores the full **20-avatar** profile chooser on Android/Google TV while keeping every existing Swoop TV avatar available.\n- Replaces the ten low-resolution secondary avatar placeholders with crisp scalable TV artwork for **Cat, Dog, Kangaroo, Red Panda, Dinosaur, Panda, Capybara, Triceratops, Seal and Cheetah Cub**.\n- Keeps the existing large first-run profile/onboarding presentation and D-pad-friendly avatar selection flow introduced in the v0.8.49–v0.8.51 onboarding fixes.\n- Removes the temporary production-resolution filter that limited TV users to the original ten avatars once the secondary set is upgraded.\n- Aligns native Android diagnostics, WebView/provider user-agent markers and bridge version reporting with the actual v0.8.52 package version.\n- Bumps the packaged shell cache so upgraded avatar artwork and chooser logic cannot be shadowed by the previous v0.8.51 shell.\n- Android versionName/versionCode: **0.8.52 / 852**.\n\n`;
if(!notes.startsWith('## v0.8.52')) fs.writeFileSync(path,section+notes);
try{fs.rmSync('.promotion/build-v0.8.52.trigger')}catch{}
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','Swoop TV Build']);
execFileSync('git',['config','user.email','actions@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Add v0.8.52 release notes [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.52 canonical release notes promoted.');
