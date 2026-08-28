import fs from 'node:fs';
import {execSync} from 'node:child_process';

const appPath='app/src/main/assets/app.js';
const cssPath='app/src/main/assets/styles.css';
const testPath='tests/tv-ui-runtime-smoke.mjs';
const gradlePath='app/build.gradle';
let app=fs.readFileSync(appPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');
let test=fs.readFileSync(testPath,'utf8');
let gradle=fs.readFileSync(gradlePath,'utf8');

function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`Missing anchor: ${label}`);
  return source.replace(from,to);
}

app=replaceOnce(app,"const ANDROID_CURRENT_VERSION='0.8.48';","const ANDROID_CURRENT_VERSION='0.8.49';",'app version');
app=replaceOnce(app,"const ANDROID_CURRENT_CHANGELOG=[\n",`const ANDROID_CURRENT_CHANGELOG=[\n  'Makes every first-run provider step a true TV-scale screen using about 80% of the available viewport instead of a small modal.',\n  'Scales headings, instructions, provider choices, text fields and Back/Next/Connect controls responsively across different TV resolutions and aspect ratios.',\n  'Keeps the same large centered geometry on every Xtream and M3U onboarding step while leaving the normal Provider Manager compact in Settings.',\n`,'changelog');

gradle=replaceOnce(gradle,'versionCode 848','versionCode 849','gradle version code');
gradle=replaceOnce(gradle,"versionName '0.8.48'","versionName '0.8.49'",'gradle version name');

const cssMarker='/* v0.8.49 — 80% TV-first onboarding wizard */';
if(css.includes(cssMarker))throw new Error('v0.8.49 onboarding CSS already present');
css+=`\n\n${cssMarker}\n/* First-run only: every provider setup step uses the same large responsive TV canvas. */\nhtml.android-tv .modal-backdrop:has(.first-run-provider-wizard){\n  padding:0!important;\n  display:flex!important;\n  align-items:center!important;\n  justify-content:center!important;\n  overflow:hidden!important;\n}\nhtml.android-tv .first-run-provider-wizard{\n  width:80vw!important;\n  height:80vh!important;\n  max-width:none!important;\n  max-height:none!important;\n  min-width:0!important;\n  min-height:0!important;\n  display:flex!important;\n  flex-direction:column!important;\n  overflow:hidden!important;\n  border-radius:clamp(16px,1.5vw,28px)!important;\n}\nhtml.android-tv .first-run-provider-wizard .provider-modal-body{\n  flex:1 1 auto!important;\n  width:100%!important;\n  min-height:0!important;\n  padding:clamp(28px,5vh,72px) clamp(36px,5.5vw,108px)!important;\n  display:flex!important;\n  align-items:center!important;\n  justify-content:center!important;\n  overflow:auto!important;\n}\nhtml.android-tv .first-run-provider-wizard .provider-add-section{\n  width:100%!important;\n  max-width:1180px!important;\n  margin:auto!important;\n  padding:0!important;\n}\nhtml.android-tv .first-run-provider-wizard .provider-add-heading{margin:0 0 clamp(24px,4vh,48px)!important}\nhtml.android-tv .first-run-provider-wizard .provider-add-heading .eyebrow{font-size:clamp(12px,1.05vw,19px)!important;letter-spacing:.18em!important}\nhtml.android-tv .first-run-provider-wizard .provider-add-heading h2{\n  margin:clamp(6px,1vh,12px) 0 clamp(10px,1.5vh,18px)!important;\n  font-size:clamp(38px,4.2vw,76px)!important;\n  line-height:1!important;\n  letter-spacing:-.045em!important;\n}\nhtml.android-tv .first-run-provider-wizard .provider-add-heading p{\n  max-width:48ch!important;\n  margin:0!important;\n  font-size:clamp(17px,1.45vw,27px)!important;\n  line-height:1.45!important;\n  color:#b9bdc7!important;\n}\nhtml.android-tv .first-run-provider-wizard .provider-methods{\n  grid-template-columns:repeat(2,minmax(0,1fr))!important;\n  gap:clamp(16px,2vw,34px)!important;\n  margin:0!important;\n}\nhtml.android-tv .first-run-provider-wizard .provider-method{\n  min-height:clamp(118px,18vh,196px)!important;\n  padding:clamp(20px,2.2vw,38px)!important;\n  gap:clamp(16px,1.8vw,30px)!important;\n  border-radius:clamp(13px,1.2vw,22px)!important;\n}\nhtml.android-tv .first-run-provider-wizard .provider-method-icon{\n  width:clamp(56px,5vw,88px)!important;\n  height:clamp(56px,5vw,88px)!important;\n  border-radius:clamp(10px,1vw,18px)!important;\n  font-size:clamp(15px,1.4vw,24px)!important;\n}\nhtml.android-tv .first-run-provider-wizard .provider-method strong{font-size:clamp(22px,2.1vw,36px)!important;line-height:1.08!important}\nhtml.android-tv .first-run-provider-wizard .provider-method small{font-size:clamp(15px,1.25vw,23px)!important;line-height:1.35!important;margin-top:6px!important}\nhtml.android-tv .first-run-provider-wizard .field{width:100%!important;max-width:920px!important;margin:0!important}\nhtml.android-tv .first-run-provider-wizard .field label{\n  display:block!important;\n  margin-bottom:clamp(8px,1.2vh,14px)!important;\n  font-size:clamp(15px,1.2vw,22px)!important;\n  font-weight:850!important;\n}\nhtml.android-tv .first-run-provider-wizard .field input,\nhtml.android-tv .first-run-provider-wizard .field select{\n  width:100%!important;\n  min-height:clamp(64px,8.5vh,94px)!important;\n  padding:clamp(15px,2vh,24px) clamp(18px,1.8vw,30px)!important;\n  border-radius:clamp(11px,1vw,17px)!important;\n  font-size:clamp(20px,2vw,34px)!important;\n  line-height:1.2!important;\n}\nhtml.android-tv .first-run-provider-wizard .cta-row{\n  width:100%!important;\n  max-width:920px!important;\n  margin-top:clamp(24px,4vh,48px)!important;\n  gap:clamp(14px,1.4vw,24px)!important;\n}\nhtml.android-tv .first-run-provider-wizard .cta-row .btn{\n  min-width:clamp(150px,14vw,250px)!important;\n  min-height:clamp(60px,8vh,88px)!important;\n  padding:clamp(14px,1.7vh,22px) clamp(24px,2.4vw,42px)!important;\n  border-radius:clamp(10px,.9vw,16px)!important;\n  font-size:clamp(18px,1.65vw,29px)!important;\n}\nhtml.android-tv .first-run-provider-wizard #providerStatus{font-size:clamp(15px,1.2vw,21px)!important;margin-top:18px!important}\nhtml.android-tv .first-run-provider-wizard :is(.provider-method,.btn,input):focus-visible{outline:4px solid #fff!important;outline-offset:5px!important}\n\n/* Keep the ~80% canvas on smaller/shorter TVs, but compress internal spacing so nothing clips. */\n@media (max-width:1400px), (max-height:800px){\n  html.android-tv .first-run-provider-wizard .provider-modal-body{padding:clamp(20px,3.5vh,40px) clamp(28px,4vw,60px)!important}\n  html.android-tv .first-run-provider-wizard .provider-add-heading{margin-bottom:clamp(18px,2.8vh,30px)!important}\n  html.android-tv .first-run-provider-wizard .provider-method{min-height:clamp(100px,17vh,150px)!important}\n  html.android-tv .first-run-provider-wizard .field input{min-height:clamp(58px,8vh,76px)!important}\n  html.android-tv .first-run-provider-wizard .cta-row{margin-top:clamp(18px,3vh,30px)!important}\n}\n@media (max-width:980px){\n  html.android-tv .first-run-provider-wizard{width:84vw!important;height:82vh!important}\n  html.android-tv .first-run-provider-wizard .provider-methods{grid-template-columns:1fr!important}\n  html.android-tv .first-run-provider-wizard .provider-method{min-height:clamp(86px,14vh,118px)!important}\n}\n`;

const testMarker="// v0.8.49 full-size first-run TV onboarding.";
if(test.includes(testMarker))throw new Error('v0.8.49 test already present');
test+=`\n\n${testMarker}\nif (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.49';")) throw new Error('v0.8.49 Android web runtime version marker missing');\nif (!cssSource.includes('v0.8.49 — 80% TV-first onboarding wizard') || !cssSource.includes('width:80vw!important') || !cssSource.includes('height:80vh!important')) throw new Error('First-run provider wizard is not using the 80% TV viewport canvas');\nif (!cssSource.includes('.first-run-provider-wizard .provider-method strong{font-size:clamp') || !cssSource.includes('.first-run-provider-wizard .field input,') || !cssSource.includes('.first-run-provider-wizard .cta-row .btn{')) throw new Error('First-run wizard typography/inputs/actions are not responsively TV-scaled');\n`;

fs.writeFileSync(appPath,app);
fs.writeFileSync(cssPath,css);
fs.writeFileSync(testPath,test);
fs.writeFileSync(gradlePath,gradle);
fs.rmSync('.promotion/promote-pending.mjs');

execSync('git config user.name "Swoop081"');
execSync('git config user.email "justinbelot8@gmail.com"');
execSync(`git add ${appPath} ${cssPath} ${testPath} ${gradlePath} .promotion/promote-pending.mjs`);
execSync('git commit -m "Promote v0.8.49 full-size TV onboarding [skip ci]"');
execSync('git push origin HEAD:main');
console.log('Promoted v0.8.49 full-size TV onboarding.');
