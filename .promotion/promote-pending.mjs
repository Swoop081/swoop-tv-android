import fs from 'node:fs';
import {execSync} from 'node:child_process';

const path='RELEASE_NOTES.md';
let notes=fs.readFileSync(path,'utf8');
const heading='## v0.8.49 — Full-Size Responsive TV Onboarding';
if(!notes.includes(heading)){
  const block=`${heading}\n\n- Makes **every first-run provider setup screen** use approximately **80% of the available TV viewport** instead of inheriting the compact Provider Manager modal size.\n- Applies the same large TV-first canvas consistently to **sign-in method, server/playlist URL, playlist name, username, password and Connect** steps for both Xtream Codes and M3U onboarding.\n- Scales headings, explanatory text, provider-choice cards, icons, text fields and Back/Next/Connect controls responsively with CSS \\`clamp()\\` sizing so the experience remains readable across different television resolutions and screen sizes.\n- Keeps the setup surface centered both horizontally and vertically, with stronger remote-focus outlines and substantially larger interaction targets for couch-distance use.\n- Adds short-height and narrower-TV adaptations that compress internal spacing or stack provider choices while retaining the large overall onboarding footprint rather than reverting to the old small dialog.\n- Limits this treatment to **first-run onboarding**; the normal Provider Manager in Settings keeps its compact management layout.\n- Android versionName/versionCode: **0.8.49 / 849**.\n\n`;
  notes=block+notes;
  fs.writeFileSync(path,notes);
}
fs.rmSync('.promotion/promote-pending.mjs');
execSync('git config user.name "Swoop081"');
execSync('git config user.email "justinbelot8@gmail.com"');
execSync('git add RELEASE_NOTES.md .promotion/promote-pending.mjs');
execSync('git commit -m "Document v0.8.49 full-size TV onboarding [skip ci]"');
execSync('git push origin HEAD:main');
console.log('v0.8.49 release notes completed.');
