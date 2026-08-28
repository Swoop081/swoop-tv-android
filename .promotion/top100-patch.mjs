import fs from 'node:fs';
import {execSync} from 'node:child_process';
const path='RELEASE_NOTES.md';
let notes=fs.readFileSync(path,'utf8');
if(!notes.startsWith('## v0.8.48')){
  notes=`## v0.8.48 — Guided Provider Setup Wizard\n\n- Replaces the first-run all-in-one provider form with a calm, deliberate **one-screen-at-a-time** TV setup wizard.\n- First decision is simply **Xtream Codes** or **M3U Playlist**. The unselected setup path and all unrelated fields stay hidden.\n- Xtream setup asks, in order: **Server URL → Playlist name → Username → Password → Connect**.\n- The playlist name is explicitly explained as a friendly label that can be anything the customer wants, such as Main TV, Family TV or Lounge.\n- M3U setup asks only for **Playlist URL → Playlist name → Connect** during first run.\n- Hides XMLTV/EPG, connection-helper, provider statistics, provider priority and management controls from first-run onboarding; those remain available later in the full Provider Manager.\n- Preserves provider-first loading: after the connection is accepted, the avatar chooser takes over while library import, metadata and performance preparation continue behind it.\n- Preserves private-by-default secondary account credentials and the existing automatic-update/install flow.\n- Android versionName/versionCode: **0.8.48 / 848**.\n\n`+notes;
  fs.writeFileSync(path,notes);
}
fs.rmSync('.promotion/top100-patch.mjs');
execSync('git config user.name "Swoop081"');
execSync('git config user.email "justinbelot8@gmail.com"');
execSync('git add RELEASE_NOTES.md .promotion/top100-patch.mjs');
execSync('git commit -m "Document v0.8.48 guided provider setup [skip ci]"');
execSync('git push origin HEAD:main');
console.log('v0.8.48 release notes added.');
