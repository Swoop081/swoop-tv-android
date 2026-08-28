import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v)};
function replaceOnce(text,from,to,label){if(!text.includes(from))throw new Error(`${label} anchor missing`);return text.replace(from,to)}

const VERSION='0.8.46';
const VERSION_CODE=846;

// ---- Privacy-first profile/provider defaults -------------------------------
let profiles=read('app/src/main/assets/src/profiles.js');
profiles=replaceOnce(
  profiles,
  "export function makeProfile({id='',name='Profile',avatar='lion',kids=false,pinHash='',pinSalt='',myList=[],continueWatching=[],watchHistory=[],recentLive=[],liveFavourites=[],providerMode='shared',privateProviders=[],profileSettings={}}={}){",
  "export function makeProfile({id='',name='Profile',avatar='lion',kids=false,pinHash='',pinSalt='',myList=[],continueWatching=[],watchHistory=[],recentLive=[],liveFavourites=[],providerMode='private',privateProviders=[],profileSettings={}}={}){",
  'new profiles default private'
);
write('app/src/main/assets/src/profiles.js',profiles);

let app=read('app/src/main/assets/app.js');
app=app.replaceAll("0.8.45","0.8.46");
app=replaceOnce(
  app,
  "const PROVIDER_ACCOUNT_SCHEMA=1;\nif(Number(state.settings.providerAccountSchemaVersion||0)<PROVIDER_ACCOUNT_SCHEMA){\n  state.sharedProviders=(Array.isArray(state.providers)?state.providers:[]).map(p=>({...p,counts:p?.counts?{...p.counts}:p?.counts}));\n  state.settings.providerAccountSchemaVersion=PROVIDER_ACCOUNT_SCHEMA;\n}\nif(!Array.isArray(state.sharedProviders))state.sharedProviders=[];",
  "const PROVIDER_ACCOUNT_SCHEMA=2;\nif(Number(state.settings.providerAccountSchemaVersion||0)<1){\n  state.sharedProviders=(Array.isArray(state.providers)?state.providers:[]).map(p=>({...p,counts:p?.counts?{...p.counts}:p?.counts}));\n}\nif(Number(state.settings.providerAccountSchemaVersion||0)<2){\n  // Privacy migration: only the first account may inherit the household provider set by default.\n  // Every secondary account is moved to Private while retaining any private providers it already owns.\n  if(Array.isArray(state.profiles))state.profiles=state.profiles.map((p,i)=>i===0?{...p,providerMode:'shared'}:{...p,providerMode:'private',privateProviders:Array.isArray(p?.privateProviders)?p.privateProviders:[]});\n  state.settings.providerAccountSchemaVersion=2;\n}\nif(!Array.isArray(state.sharedProviders))state.sharedProviders=[];",
  'provider privacy schema migration'
);
app=replaceOnce(
  app,
  "function profileProviderMode(profile=activeProfile()){const firstId=state.profiles?.[0]?.id||'';if(!profile||profile.id===firstId)return 'shared';return profile.providerMode==='private'?'private':'shared'}",
  "function profileProviderMode(profile=activeProfile()){const firstId=state.profiles?.[0]?.id||'';if(!profile||profile.id===firstId)return 'shared';return profile.providerMode==='shared'?'shared':'private'}",
  'secondary profiles fail private'
);
app=replaceOnce(
  app,
  "<div class=\"profile-provider-options\"><label class=\"profile-provider-option ${providerMode==='shared'?'active':''}\"><input type=\"radio\" name=\"providerMode\" value=\"shared\" ${providerMode==='shared'?'checked':''}><span><strong>Shared household providers</strong><small>Use the first account’s saved Xtream/M3U providers and credentials.</small></span></label><label class=\"profile-provider-option ${providerMode==='private'?'active':''}\"><input type=\"radio\" name=\"providerMode\" value=\"private\" ${providerMode==='private'?'checked':''}><span><strong>Private providers</strong><small>Do not inherit household logins. Add separate Xtream/M3U providers visible only in this account.</small></span></label></div>",
  "<div class=\"profile-provider-options\"><label class=\"profile-provider-option ${providerMode==='private'?'active':''}\"><input type=\"radio\" name=\"providerMode\" value=\"private\" ${providerMode==='private'?'checked':''}><span><strong>Private providers · Recommended</strong><small>Starts with no household login. Add separate Xtream/M3U providers visible only in this account.</small></span></label><label class=\"profile-provider-option ${providerMode==='shared'?'active':''}\"><input type=\"radio\" name=\"providerMode\" value=\"shared\" ${providerMode==='shared'?'checked':''}><span><strong>Use shared household providers</strong><small>Explicitly use the first account’s saved Xtream/M3U providers and credentials.</small></span></label></div>",
  'privacy-first provider choice order'
);
app=replaceOnce(
  app,
  "const ANDROID_CURRENT_CHANGELOG=[\n  'Turns the Google TV startup screen into a cinema-style experience",
  "const ANDROID_CURRENT_CHANGELOG=[\n  'Privacy hotfix: every secondary account now defaults to Private providers and household Xtream/M3U credentials require explicit opt-in sharing.',\n  'Existing secondary accounts are migrated to Private once while retaining any private provider setup they already own.',\n  'Turns the Google TV startup screen into a cinema-style experience",
  'v0.8.46 changelog'
);
write('app/src/main/assets/app.js',app);

// ---- Android version markers ------------------------------------------------
let gradle=read('app/build.gradle');
gradle=replaceOnce(gradle,"versionCode 845","versionCode 846",'versionCode');
gradle=replaceOnce(gradle,"versionName '0.8.45'","versionName '0.8.46'",'versionName');
write('app/build.gradle',gradle);

let activity=read('app/src/main/java/tv/swoop/player/MainActivity.java');
activity=activity.replaceAll('SwoopTV/0.8.45 AndroidTV','SwoopTV/0.8.46 AndroidTV');
write('app/src/main/java/tv/swoop/player/MainActivity.java',activity);

// ---- Regression gates -------------------------------------------------------
let tests=read('tests/tv-ui-runtime-smoke.mjs');
tests=tests.replaceAll("const ANDROID_CURRENT_VERSION='0.8.45';","const ANDROID_CURRENT_VERSION='0.8.46';");
tests=replaceOnce(
  tests,
  "if (!appSource.includes('state.sharedProviders=') || !appSource.includes(\"profile.providerMode==='private'\")) throw new Error('Household/private provider scope migration missing');",
  "if (!appSource.includes('state.sharedProviders=') || !appSource.includes(\"profile.providerMode==='private'\")) throw new Error('Household/private provider scope migration missing');\nif (!profilesSource.includes(\"providerMode='private'\")) throw new Error('Secondary account profile constructor is not privacy-first');\nif (!appSource.includes(\"const PROVIDER_ACCOUNT_SCHEMA=2\") || !appSource.includes(\"i===0?{...p,providerMode:'shared'}:{...p,providerMode:'private'\")) throw new Error('Secondary-account privacy migration missing');\nif (!appSource.includes(\"return profile.providerMode==='shared'?'shared':'private'\")) throw new Error('Secondary account provider mode does not fail closed to private');\nif (!appSource.includes('Private providers · Recommended') || !appSource.includes('Use shared household providers')) throw new Error('Privacy-first provider choice UI missing');",
  'privacy regression guards'
);
write('tests/tv-ui-runtime-smoke.mjs',tests);

// ---- Canonical release notes ------------------------------------------------
let notes=read('RELEASE_NOTES.md');
const section=`## v${VERSION} — Account Credential Privacy Hotfix\n\n- Changes every newly created secondary account to **Private providers by default**. A second account no longer inherits the first account’s Xtream/M3U credentials automatically.\n- Sharing household providers is now an **explicit opt-in** choice: **Use shared household providers**.\n- Adds a one-time privacy migration that moves all existing secondary accounts to Private while retaining any private-provider configuration they already own. Users who genuinely want sharing can opt back in deliberately.\n- Makes provider-mode resolution fail closed: any missing/unknown secondary-account mode resolves to Private, never Shared.\n- Keeps the first-created account as the household provider owner and preserves its existing provider credentials.\n- Retains all v0.8.45 cinematic startup and account-provider infrastructure.\n- Android versionName/versionCode: **0.8.46 / 846**.\n\n`;
if(!notes.startsWith(`## v${VERSION}`))notes=section+notes;
write('RELEASE_NOTES.md',notes);

// Self-delete promotion helper before canonical commit.
try{fs.unlinkSync(path.join(root,'.promotion/promote-pending.mjs'))}catch{}
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m',`Promote v${VERSION} account credential privacy hotfix [skip ci]`],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log(`Promoted v${VERSION} account credential privacy hotfix.`);
