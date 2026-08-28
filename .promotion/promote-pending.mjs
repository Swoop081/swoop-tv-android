import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,v)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,v)};
function replaceOnce(text,from,to,label){
  if(!text.includes(from))throw new Error(`${label} anchor missing`);
  return text.replace(from,to);
}
function replaceRegex(text,re,to,label){
  if(!re.test(text))throw new Error(`${label} anchor missing`);
  return text.replace(re,to);
}

const VERSION='0.8.44';
const VERSION_CODE=844;
const REPO=process.env.GITHUB_REPOSITORY||'Swoop081/swoop-tv-android';
const RELEASE_TAG='google-tv-test-v0.8.1';
const STABLE_APK='Swoop-TV-v0.8.1-Google-TV-Test.apk';

// ---- Profile/account model -------------------------------------------------
let profiles=read('app/src/main/assets/src/profiles.js');
profiles=replaceOnce(
  profiles,
  "export function makeProfile({id='',name='Profile',avatar='lion',kids=false,pinHash='',pinSalt='',myList=[],continueWatching=[],watchHistory=[],recentLive=[],liveFavourites=[],profileSettings={}}={}){",
  "export function makeProfile({id='',name='Profile',avatar='lion',kids=false,pinHash='',pinSalt='',myList=[],continueWatching=[],watchHistory=[],recentLive=[],liveFavourites=[],providerMode='shared',privateProviders=[],profileSettings={}}={}){",
  'profile provider fields'
);
profiles=replaceOnce(
  profiles,
  "    liveFavourites:Array.isArray(liveFavourites)?liveFavourites:[],\n    profileSettings:profileSettings&&typeof profileSettings==='object'?{...profileSettings}:{},",
  "    liveFavourites:Array.isArray(liveFavourites)?liveFavourites:[],\n    providerMode:providerMode==='private'?'private':'shared',\n    privateProviders:Array.isArray(privateProviders)?privateProviders.map(p=>({...p,counts:p?.counts?{...p.counts}:p?.counts})):[],\n    profileSettings:profileSettings&&typeof profileSettings==='object'?{...profileSettings}:{},",
  'profile provider persistence'
);
write('app/src/main/assets/src/profiles.js',profiles);

// ---- Web runtime / TV UI ---------------------------------------------------
let app=read('app/src/main/assets/app.js');
app=app.replaceAll("0.8.43","0.8.44");
app=replaceOnce(
  app,
  "const DEFAULT_STATE={page:'home',catalog:[],provider:null,providers:[],myList:[]",
  "const DEFAULT_STATE={page:'home',catalog:[],provider:null,providers:[],sharedProviders:[],myList:[]",
  'default shared provider state'
);
app=replaceOnce(
  app,
  "const state=Object.assign({},DEFAULT_STATE,loaded,{settings:{...DEFAULT_STATE.settings,...(loaded.settings||{})},webDiscovery:{...(loaded.webDiscovery||{})},metadataCache:{...(loaded.metadataCache||{})}});\n",
  "const state=Object.assign({},DEFAULT_STATE,loaded,{settings:{...DEFAULT_STATE.settings,...(loaded.settings||{})},webDiscovery:{...(loaded.webDiscovery||{})},metadataCache:{...(loaded.metadataCache||{})}});\nconst PROVIDER_ACCOUNT_SCHEMA=1;\nif(Number(state.settings.providerAccountSchemaVersion||0)<PROVIDER_ACCOUNT_SCHEMA){\n  state.sharedProviders=(Array.isArray(state.providers)?state.providers:[]).map(p=>({...p,counts:p?.counts?{...p.counts}:p?.counts}));\n  state.settings.providerAccountSchemaVersion=PROVIDER_ACCOUNT_SCHEMA;\n}\nif(!Array.isArray(state.sharedProviders))state.sharedProviders=[];\n",
  'provider account migration'
);

app=replaceOnce(
  app,
  "function currentProfileSnapshot(base={}){return normalizeProfile({...base,id:base.id||state.activeProfileId,name:base.name||'Swoop TV',avatar:base.avatar||'lion',kids:Boolean(base.kids),pinHash:base.pinHash||'',pinSalt:base.pinSalt||'',myList:[...(state.myList||[])],continueWatching:[...(state.continueWatching||[])],watchHistory:[...(state.watchHistory||[])],recentLive:[...(state.recentLive||[])],liveFavourites:[...(state.liveFavourites||[])],profileSettings:profileSettingsSnapshot()})}",
  "function cloneProviderRecords(list=[]){return Array.isArray(list)?list.map(p=>({...p,counts:p?.counts?{...p.counts}:p?.counts})):[]}\nfunction profileProviderMode(profile=activeProfile()){const firstId=state.profiles?.[0]?.id||'';if(!profile||profile.id===firstId)return 'shared';return profile.providerMode==='private'?'private':'shared'}\nfunction syncProviderScopeFromState(profile=activeProfile()){if(!profile)return;const mode=profileProviderMode(profile);if(mode==='private')profile.privateProviders=cloneProviderRecords(state.providers);else state.sharedProviders=cloneProviderRecords(state.providers)}\nfunction currentProfileSnapshot(base={}){const mode=profileProviderMode(base),privateProviders=mode==='private'?cloneProviderRecords(state.providers):cloneProviderRecords(base.privateProviders||[]);return normalizeProfile({...base,id:base.id||state.activeProfileId,name:base.name||'Swoop TV',avatar:base.avatar||'lion',kids:Boolean(base.kids),pinHash:base.pinHash||'',pinSalt:base.pinSalt||'',myList:[...(state.myList||[])],continueWatching:[...(state.continueWatching||[])],watchHistory:[...(state.watchHistory||[])],recentLive:[...(state.recentLive||[])],liveFavourites:[...(state.liveFavourites||[])],providerMode:mode,privateProviders,profileSettings:profileSettingsSnapshot()})}",
  'profile provider-scope helpers'
);
app=replaceOnce(
  app,
  "const first=makeProfile({id:'profile-main',name:'Swoop TV',avatar:'lion',myList:[...(state.myList||[])],continueWatching:[...(state.continueWatching||[])],watchHistory:[...(state.watchHistory||[])],recentLive:[...(state.recentLive||[])],liveFavourites:[...(state.liveFavourites||[])],profileSettings:profileSettingsSnapshot()});",
  "const first=makeProfile({id:'profile-main',name:'Swoop TV',avatar:'lion',myList:[...(state.myList||[])],continueWatching:[...(state.continueWatching||[])],watchHistory:[...(state.watchHistory||[])],recentLive:[...(state.recentLive||[])],liveFavourites:[...(state.liveFavourites||[])],providerMode:'shared',privateProviders:[],profileSettings:profileSettingsSnapshot()});",
  'first profile household provider owner'
);
app=replaceOnce(
  app,
  "    if(!state.profiles.some(p=>p.id===state.activeProfileId))state.activeProfileId=state.profiles[0].id;\n  }\n}",
  "    if(!state.profiles.some(p=>p.id===state.activeProfileId))state.activeProfileId=state.profiles[0].id;\n  }\n  if(state.profiles[0])state.profiles[0].providerMode='shared';\n}",
  'first profile always shared'
);
app=replaceOnce(
  app,
  "function syncActiveProfileFromState(){const i=state.profiles.findIndex(p=>p.id===state.activeProfileId);if(i<0)return;state.profiles[i]=currentProfileSnapshot(state.profiles[i])}",
  "function syncActiveProfileFromState(){const i=state.profiles.findIndex(p=>p.id===state.activeProfileId);if(i<0)return;syncProviderScopeFromState(state.profiles[i]);state.profiles[i]=currentProfileSnapshot(state.profiles[i])}",
  'sync active provider scope'
);
app=replaceOnce(
  app,
  "function applyProfileToState(profile){if(!profile)return;profile=sanitizeLegacyDemoRefs(profile);state.myList=",
  "function applyProfileToState(profile){if(!profile)return;profile=sanitizeLegacyDemoRefs(profile);const providerMode=profileProviderMode(profile);state.providers=cloneProviderRecords(providerMode==='private'?profile.privateProviders:state.sharedProviders);state.provider=state.providers.find(p=>p.enabled!==false)||state.providers[0]||null;state.myList=",
  'apply profile provider scope'
);

// Credentials must resolve only inside the active account scope.
app=replaceOnce(
  app,
  "function providerConfigById(id=''){const session=sessionProviderConfigs.get(id);if(session)return session;const saved=savedProviderProfiles.find(p=>providerProfileId(p)===id);if(saved)return saved;const p=providerById(id);return p?{...p}:null}\nfunction providerConfigFor(itemOrId){const id=typeof itemOrId==='string'?itemOrId:itemOrId?.providerId;return providerConfigById(id)||providerConfigById(state.provider?.id)||{};}",
  "function providerVisibleInActiveScope(id=''){return !id||state.providers.some(p=>String(p.id)===String(id))}\nfunction providerConfigById(id=''){if(id&&!providerVisibleInActiveScope(id))return null;const session=sessionProviderConfigs.get(id);if(session)return session;const saved=savedProviderProfiles.find(p=>providerProfileId(p)===id);if(saved)return saved;const p=providerById(id);return p?{...p}:null}\nfunction providerConfigFor(itemOrId){const id=typeof itemOrId==='string'?itemOrId:itemOrId?.providerId;if(id)return providerConfigById(id)||{};return providerConfigById(state.provider?.id)||{};}\nfunction scopedProviderId(type,seed){const profile=activeProfile(),scope=profileProviderMode(profile)==='private'?`${profile?.id||'private'}|`:'';return `${type}-${Math.abs(hash(`${scope}${seed}`))}`;}",
  'provider credential scope guard'
);

// A private account with no providers must see no provider catalogue.
app=replaceOnce(
  app,
  "  if(state.catalog.length&&state.providers.length){const enabled=new Set(enabledProviders().map(p=>p.id));base=base.filter(item=>!item.providerId||enabled.has(item.providerId));}",
  "  if(state.catalog.length){const enabled=new Set(enabledProviders().map(p=>p.id));base=base.filter(item=>!item.providerId||enabled.has(item.providerId));}",
  'empty private account catalogue isolation'
);

// Keep provider-form prefills inside the active account scope.
app=replaceOnce(
  app,
  "  const xtreamSaved=savedProviderProfiles.find(p=>p.type==='xtream')||{};\n  const m3uSaved=savedProviderProfiles.find(p=>p.type==='m3u')||{};",
  "  const visibleProviderIds=new Set(state.providers.map(p=>String(p.id)));\n  const xtreamSaved=savedProviderProfiles.find(p=>p.type==='xtream'&&visibleProviderIds.has(providerProfileId(p)))||{};\n  const m3uSaved=savedProviderProfiles.find(p=>p.type==='m3u'&&visibleProviderIds.has(providerProfileId(p)))||{};",
  'provider modal privacy prefills'
);

// Scope new provider IDs to private accounts while preserving legacy IDs for the household pool.
app=replaceOnce(
  app,
  "const providerId=`m3u-${Math.abs(hash(`${url||name}`))}`",
  "const providerId=scopedProviderId('m3u',`${url||name}`)",
  'private M3U provider id'
);
app=replaceOnce(
  app,
  "const providerId=`xtream-${Math.abs(hash(`${cfg.server}|${cfg.username}`))}`",
  "const providerId=scopedProviderId('xtream',`${cfg.server}|${cfg.username}`)",
  'private Xtream provider id'
);
app=replaceOnce(
  app,
  "state.settings.xtreamRelayUrl=relayUrl||state.settings.xtreamRelayUrl;state.settings.xtreamRelayToken=remember&&relayToken?relayToken:state.settings.xtreamRelayToken;",
  "if(profileProviderMode()==='shared'){state.settings.xtreamRelayUrl=relayUrl||state.settings.xtreamRelayUrl;state.settings.xtreamRelayToken=remember&&relayToken?relayToken:state.settings.xtreamRelayToken;}",
  'private relay credentials stay private'
);

// Profile picker/manager communicates provider access.
app=replaceOnce(
  app,
  "<span>${p.kids?'Kids profile':'Personal profile'}${p.pinHash?' · PIN':''}</span>",
  "<span>${p.kids?'Kids profile':'Personal profile'}${p.pinHash?' · PIN':''}${profileProviderMode(p)==='private'?' · Private providers':' · Shared providers'}</span>",
  'profile picker provider mode'
);
app=replaceOnce(
  app,
  "<p>Each person can have a completely different Swoop TV presentation without changing your shared TV providers.</p>",
  "<p>Each account can use the household providers from the first account, or keep completely separate private Xtream/M3U provider logins.</p>",
  'profile manager provider copy'
);
app=replaceOnce(
  app,
  "${p.kids?'Kids restrictions on':'Standard profile'}${p.pinHash?' · PIN protected':''} · ${esc(t.name)} theme",
  "${p.kids?'Kids restrictions on':'Standard profile'}${p.pinHash?' · PIN protected':''} · ${profileProviderMode(p)==='private'?'Private providers':'Shared providers'} · ${esc(t.name)} theme",
  'profile manager provider label'
);

app=replaceOnce(
  app,
  "    selectedTheme=profileTheme(p),\n    pinLabel=p.pinHash?'Change profile PIN':'Profile PIN',",
  "    selectedTheme=profileTheme(p),\n    firstProfileId=state.profiles[0]?.id||'',\n    providerMode=profileProviderMode(p),\n    householdOwner=Boolean(existing&&existing.id===firstProfileId),\n    pinLabel=p.pinHash?'Change profile PIN':'Profile PIN',",
  'profile editor provider variables'
);
app=replaceOnce(
  app,
  "            <label class=\"remember-row profile-option-card\"><input type=\"checkbox\" name=\"smartHome\" ${p.profileSettings?.smartHomeOrder!==false?'checked':''}><span><strong>Smart Home</strong><small>Personalises optional Home rows from viewing history.</small></span></label>\n          </div>\n          <div class=\"field profile-pin-field\">",
  "            <label class=\"remember-row profile-option-card\"><input type=\"checkbox\" name=\"smartHome\" ${p.profileSettings?.smartHomeOrder!==false?'checked':''}><span><strong>Smart Home</strong><small>Personalises optional Home rows from viewing history.</small></span></label>\n          </div>\n          <div class=\"profile-provider-access\"><div class=\"profile-editor-section-title\"><span class=\"eyebrow\">TV PROVIDERS</span><strong>Provider access</strong></div>${householdOwner?`<input type=\"hidden\" name=\"providerMode\" value=\"shared\"><div class=\"profile-provider-owner\"><strong>Household provider owner</strong><small>Providers connected to the first account become the shared household provider set.</small></div>`:`<div class=\"profile-provider-options\"><label class=\"profile-provider-option ${providerMode==='shared'?'active':''}\"><input type=\"radio\" name=\"providerMode\" value=\"shared\" ${providerMode==='shared'?'checked':''}><span><strong>Shared household providers</strong><small>Use the first account’s saved Xtream/M3U providers and credentials.</small></span></label><label class=\"profile-provider-option ${providerMode==='private'?'active':''}\"><input type=\"radio\" name=\"providerMode\" value=\"private\" ${providerMode==='private'?'checked':''}><span><strong>Private providers</strong><small>Do not inherit household logins. Add separate Xtream/M3U providers visible only in this account.</small></span></label></div>`}</div>\n          <div class=\"field profile-pin-field\">",
  'profile editor provider access choice'
);
app=replaceOnce(
  app,
  "kids=Boolean(fd.get('kids')),smartHome=Boolean(fd.get('smartHome')),themeId=",
  "kids=Boolean(fd.get('kids')),providerMode=existing?.id===state.profiles[0]?.id?'shared':(String(fd.get('providerMode')||existing?.providerMode||'shared')==='private'?'private':'shared'),smartHome=Boolean(fd.get('smartHome')),themeId=",
  'profile provider mode form value'
);
app=replaceOnce(
  app,
  "next={...next,name:name.slice(0,24),avatar:avatarById(avatar).id,kids,profileSettings:{...(next.profileSettings||{}),smartHomeOrder:smartHome,themeId}};",
  "next={...next,name:name.slice(0,24),avatar:avatarById(avatar).id,kids,providerMode,privateProviders:cloneProviderRecords(existing?.privateProviders||next.privateProviders||[]),profileSettings:{...(next.profileSettings||{}),smartHomeOrder:smartHome,themeId}};",
  'save profile provider mode'
);
app=replaceOnce(
  app,
  "else{state.profiles.push(next);state.activeProfileId=next.id;applyProfileToState(next)}profileEditId='';",
  "else{state.profiles.push(next);state.activeProfileId=next.id;applyProfileToState(next)}providerFilter='all';activeCatalogSourceRef=null;activeCatalogContext='';activeCatalogCache=[];resetAndroidFastCatalog();profileEditId='';",
  'profile save provider cache reset'
);
app=replaceOnce(
  app,
  "state.activeProfileId=target.id;applyProfileToState(target);detailItem=null;sourceChoiceItem=null;heroRotationIndex=0;",
  "state.activeProfileId=target.id;applyProfileToState(target);providerFilter='all';activeCatalogSourceRef=null;activeCatalogContext='';activeCatalogCache=[];resetAndroidFastCatalog();detailItem=null;sourceChoiceItem=null;heroRotationIndex=0;",
  'profile switch provider cache reset'
);

// ---- Launch experience ------------------------------------------------------
app=replaceOnce(
  app,
  "let startupRefreshActive=false;\nlet startupRefreshState={progress:2,title:'Updating your TV library…',detail:'Getting your TV library ready.',provider:'',summary:''};",
  "let startupRefreshActive=false;\nlet androidBootSequenceActive=false;\nlet startupRefreshState={progress:2,kicker:'SWOOP TV',title:'Starting Swoop TV…',detail:'Getting Swoop TV ready.',provider:'',summary:''};",
  'boot sequence state'
);
app=replaceRegex(
  app,
  /function startupRefreshPage\(\)\{[\s\S]*?\n\}\nfunction updateStartupRefreshProgress\(\{progress,title,detail,provider,summary\}=\{\}\)\{/,
  `function startupRefreshPage(){
  const pct=Math.max(0,Math.min(100,Number(startupRefreshState.progress||0)));
  return \`<main class="page restoring-page"><div class="restore-card startup-refresh-card startup-boot-card"><img class="startup-swoop-logo" src="./assets/swoop-tv-logo-transparent.png" alt="Swoop TV" /><div class="eyebrow" id="startupRefreshKicker">\${esc(startupRefreshState.kicker||'SWOOP TV')}</div><h1 id="startupRefreshTitle">\${esc(startupRefreshState.title||'Starting Swoop TV…')}</h1><p id="startupRefreshText">\${esc(startupRefreshState.detail||'Getting everything ready.')}</p><div class="restore-progress"><div><span id="startupRefreshCount">\${esc(startupRefreshState.provider||'Preparing…')}</span><strong id="startupRefreshPercent">\${Math.round(pct)}%</strong></div><i><b id="startupRefreshBar" style="width:\${pct}%"></b></i></div><small id="startupRefreshSummary">\${esc(startupRefreshState.summary||'Preparing your Swoop TV experience.')}</small></div></main>\`;
}
function updateStartupRefreshProgress({progress,kicker,title,detail,provider,summary}={}){`,
  'dynamic startup page'
);
app=replaceOnce(
  app,
  "  if(progress!==undefined&&Number.isFinite(Number(progress)))startupRefreshState.progress=Math.max(0,Math.min(100,Number(progress)));\n  if(title!==undefined)startupRefreshState.title=String(title||'');",
  "  if(progress!==undefined&&Number.isFinite(Number(progress))){const next=Math.max(0,Math.min(100,Number(progress)));startupRefreshState.progress=androidBootSequenceActive?Math.max(Number(startupRefreshState.progress||0),next):next;}\n  if(kicker!==undefined)startupRefreshState.kicker=String(kicker||'');\n  if(title!==undefined)startupRefreshState.title=String(title||'');",
  'monotonic boot progress'
);
app=replaceOnce(
  app,
  "  const bar=document.querySelector('#startupRefreshBar'),pct=document.querySelector('#startupRefreshPercent'),count=document.querySelector('#startupRefreshCount'),text=document.querySelector('#startupRefreshText'),small=document.querySelector('#startupRefreshSummary');",
  "  const bar=document.querySelector('#startupRefreshBar'),pct=document.querySelector('#startupRefreshPercent'),count=document.querySelector('#startupRefreshCount'),text=document.querySelector('#startupRefreshText'),small=document.querySelector('#startupRefreshSummary'),titleEl=document.querySelector('#startupRefreshTitle'),kickerEl=document.querySelector('#startupRefreshKicker');",
  'startup title DOM handles'
);
app=replaceOnce(
  app,
  "  if(bar)bar.style.width=`${startupRefreshState.progress}%`;\n  if(pct)pct.textContent=`${Math.round(startupRefreshState.progress)}%`;",
  "  if(bar)bar.style.width=`${startupRefreshState.progress}%`;\n  if(pct)pct.textContent=`${Math.round(startupRefreshState.progress)}%`;\n  if(titleEl)titleEl.textContent=startupRefreshState.title||'Starting Swoop TV…';\n  if(kickerEl)kickerEl.textContent=startupRefreshState.kicker||'SWOOP TV';",
  'startup title DOM updates'
);

// Re-use durable-library chunk progress in the boot screen.
app=replaceRegex(
  app,
  /function updateRestoreProgress\(info=\{\}\)\{[\s\S]*?\n\}/,
  `function updateRestoreProgress(info={}){
  const total=Math.max(1,Number(info.total||0)),loaded=Math.max(0,Number(info.loaded||0)),pct=info.phase==='finishing'?96:Math.min(92,8+(loaded/total)*82),shown=Math.round(pct);
  if(NATIVE_ANDROID&&startupRefreshActive){
    const mapped=36+(shown/100)*44;
    updateStartupRefreshProgress({progress:mapped,kicker:'LOADING LIBRARY',title:'Loading your library…',provider:info.items?\`\${Number(info.items).toLocaleString()} library items ready\`:'Reading saved library…',detail:info.phase==='finishing'?'Finishing your saved library…':'Loading channels, movies and TV shows…',summary:'Your accounts will appear when the launch library is ready.'});
    return;
  }
  const bar=document.querySelector('#restoreProgressBar'),count=document.querySelector('#restoreProgressCount'),text=document.querySelector('#restoreProgressText'),percent=document.querySelector('#restoreProgressPercent');
  if(bar)bar.style.width=\`\${pct}%\`;if(percent)percent.textContent=\`\${shown}%\`;
  if(count)count.textContent=info.items?\`\${Number(info.items).toLocaleString()} library items ready\`:'Preparing your library…';
  if(text)text.textContent=info.phase==='finishing'?'Finishing your library…':'Loading channels, movies and TV shows…';
}`,
  'boot durable library progress'
);

const bootHelpers = `
const androidBootWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function runAndroidBootUpdateCheck(){
  updateStartupRefreshProgress({progress:8,kicker:'AUTOMATIC UPDATES',title:'Checking for updates…',detail:'Checking the stable Swoop TV release on GitHub.',provider:'Connecting to update service…',summary:'Swoop TV verifies every update before Android installs it.'});
  let status=androidUpdateStatusSync(),auto=status.automaticUpdates!==false;
  androidUpdateBridgeCall('checkForUpdate',auto);
  const started=Date.now();let permissionSeenAt=0,installTriggered=false;
  while(Date.now()-started<30000){
    status=androidUpdateStatusSync();const phase=String(status.phase||'idle'),download=Math.max(0,Math.min(100,Number(status.progress||0)));
    if(phase==='checking'||phase==='idle'){
      const elapsed=Math.min(1,(Date.now()-started)/5000);
      updateStartupRefreshProgress({progress:8+elapsed*12,kicker:'AUTOMATIC UPDATES',title:'Checking for updates…',detail:'Comparing this TV with the latest stable Swoop TV build.',provider:'Checking GitHub…'});
    }else if(phase==='downloading'){
      updateStartupRefreshProgress({progress:12+(download/100)*18,kicker:'AUTOMATIC UPDATES',title:'Downloading update…',detail:'Downloading and verifying the new Swoop TV APK.',provider:\`\${Math.round(download)}% downloaded and verified\`,summary:'Your providers, profiles, Favorites and viewing history stay on this TV.'});
    }else if(phase==='installing'||phase==='approval_required'){
      updateStartupRefreshProgress({progress:31,kicker:'AUTOMATIC UPDATES',title:'Installing update…',detail:phase==='approval_required'?'Android needs one confirmation to finish the update.':'The update is verified and Android is installing it.',provider:'Finishing update…'});
    }else if(phase==='permission_required'){
      if(!permissionSeenAt)permissionSeenAt=Date.now();
      updateStartupRefreshProgress({progress:20,kicker:'ONE-TIME UPDATE SETUP',title:'Allow Swoop TV updates',detail:'Android is asking you to allow Swoop TV to install its own verified updates. Turn on “Allow from this source”, then return to Swoop TV.',provider:'Waiting for Android permission…',summary:'This permission is normally needed only once.'});
      if(status.canInstallPackages){permissionSeenAt=0;await androidBootWait(180);continue}
      if(Date.now()-permissionSeenAt>1800)break;
    }else if(phase==='available'){
      if(auto&&!installTriggered){installTriggered=true;androidUpdateBridgeCall('installAvailableUpdate');}
      else break;
    }else if(phase==='up_to_date'){
      updateStartupRefreshProgress({progress:32,kicker:'AUTOMATIC UPDATES',title:'Swoop TV is up to date',detail:'No newer stable build is waiting.',provider:\`Version \${status.currentVersion||ANDROID_CURRENT_VERSION} is current\`});
      break;
    }else if(phase==='error'){
      updateStartupRefreshProgress({progress:32,kicker:'AUTOMATIC UPDATES',title:'Update check finished',detail:String(status.error||'The update service could not be reached. Swoop TV will continue with the saved app and library.'),provider:'Continuing with installed version…'});
      break;
    }else break;
    await androidBootWait(180);
  }
  updateStartupRefreshProgress({progress:34,kicker:'YOUR LIBRARY',title:'Loading your library…',detail:'Loading saved channels, movies, TV shows and account provider scopes.',provider:'Opening local library…',summary:'Preparing everything before Who’s Watching appears.'});
}
async function bootstrapAndroidPreLogin(){
  androidBootSequenceActive=true;profilePickerOpen=true;startupRefreshActive=true;
  startupRefreshState={progress:3,kicker:'SWOOP TV',title:'Starting Swoop TV…',detail:'Preparing your TV experience.',provider:'Starting secure app services…',summary:'Updates and your library load before account selection.'};
  render();
  setTimeout(()=>{refreshPerformancePackInfo().catch(()=>null);prepareStarmeterBeforeLogin().catch(()=>false)},0);
  await androidBootWait(220);
  await runAndroidBootUpdateCheck().catch(()=>null);
  await ensureDurableLibraryRestored().catch(()=>false);
  if(state.catalog.length)updateStartupRefreshProgress({progress:82,kicker:'PREPARING HOME',title:'Preparing Swoop TV…',detail:'Preloading your Home screen and priority artwork.',provider:'Finishing launch preparation…',summary:'Who’s Watching is next.'});
  else updateStartupRefreshProgress({progress:40,kicker:'LOADING LIBRARY',title:'Loading your library…',detail:'No complete saved library was found. Checking your connected providers.',provider:'Preparing providers…'});
  await runAndroidStartupGate().catch(()=>false);
  androidBootSequenceActive=false;startupRefreshActive=false;profilePickerOpen=true;state.page='home';render();
}
`;
app=replaceOnce(app,"async function bootstrapApp(){",bootHelpers+"\nasync function bootstrapApp(){",'Android pre-login boot helpers');
app=replaceOnce(
  app,
  "  if(NATIVE_ANDROID){render();setTimeout(()=>{refreshPerformancePackInfo().catch(()=>null);prepareStarmeterBeforeLogin().catch(()=>false)},0);return}",
  "  if(NATIVE_ANDROID){await bootstrapAndroidPreLogin();return}",
  'Android boot pipeline entry'
);

// Fix stale What's New versionCode while touching the release marker.
app=app.replaceAll("versionCode:837","versionCode:844");

// Current changelog.
app=replaceOnce(
  app,
  "const ANDROID_CURRENT_CHANGELOG=[\n",
  "const ANDROID_CURRENT_CHANGELOG=[\n  'Adds a full launch sequence: large Swoop TV branding, automatic update check/permission handling, real library-load progress, then Who’s Watching only after launch preparation completes.',\n  'Adds account-level provider privacy: additional accounts can choose Shared household providers or Private providers with separate Xtream/M3U logins and isolated provider libraries.',\n  'Makes the first-created account the household provider owner while preserving existing provider logins as the shared provider set during migration.',\n",
  'v0.8.44 changelog'
);
write('app/src/main/assets/app.js',app);

// ---- Startup/account styling -----------------------------------------------
let css=read('app/src/main/assets/styles.css');
css=replaceOnce(
  css,
  "html.android-tv .startup-swoop-logo{width:230px;max-height:142px;margin-bottom:10px}",
  "html.android-tv .startup-swoop-logo{width:min(440px,54vw);max-height:250px;margin-bottom:20px}",
  'larger boot logo'
);
css += `

/* v0.8.44 — boot pipeline + account provider privacy. */
html.android-tv .startup-boot-card{min-width:min(760px,72vw);padding:40px 58px 44px}
html.android-tv .startup-boot-card h1{margin-top:10px}
.profile-provider-access{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1)}
.profile-provider-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}
.profile-provider-option,.profile-provider-owner{display:flex;align-items:flex-start;gap:12px;min-height:94px;padding:14px 16px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.035)}
.profile-provider-option{cursor:pointer}
.profile-provider-option input{margin-top:4px;accent-color:var(--accent)}
.profile-provider-option span,.profile-provider-owner{min-width:0}
.profile-provider-option strong,.profile-provider-owner strong{display:block;font-size:14px}
.profile-provider-option small,.profile-provider-owner small{display:block;margin-top:5px;color:var(--muted);line-height:1.35}
.profile-provider-option.active,.profile-provider-option:focus-within{border-color:color-mix(in srgb,var(--accent) 64%,white 10%);background:color-mix(in srgb,var(--accent) 10%,rgba(255,255,255,.035))}
html.android-tv .profile-provider-option:focus-within{outline:3px solid #fff;outline-offset:3px}
`;
write('app/src/main/assets/styles.css',css);

// ---- Native updater: proactive one-time permission setup --------------------
let updater=read('app/src/main/java/tv/swoop/player/SwoopUpdateManager.java');
updater=replaceOnce(updater,'private static final long LAUNCH_DELAY_MS = 3500L;','private static final long LAUNCH_DELAY_MS = 600L;','faster launch update check');
updater=replaceOnce(
  updater,
  `                if (versionCode <= BuildConfig.VERSION_CODE) {
                    setState("up_to_date", "", 100);
                    return;
                }

                setState("available", "", 0);
                boolean shouldInstall = installIfAvailable && (manual || automaticUpdates());
                if (!shouldInstall) return;
                if (!canRequestPackageInstalls()) {
                    setState("permission_required", "", 0);
                    return;
                }
                downloadAndInstall();`,
  `                if (versionCode <= BuildConfig.VERSION_CODE) {
                    if (automaticUpdates() && requestAutomaticInstallPermission(versionCode, false)) return;
                    setState("up_to_date", "", 100);
                    return;
                }

                setState("available", "", 0);
                boolean shouldInstall = installIfAvailable && (manual || automaticUpdates());
                if (!shouldInstall) return;
                if (!canRequestPackageInstalls()) {
                    if (automaticUpdates() && requestAutomaticInstallPermission(versionCode, true)) return;
                    setState("permission_required", "", 0);
                    return;
                }
                downloadAndInstall();`,
  'automatic permission request in update check'
);
updater=replaceOnce(
  updater,
  `    String openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return statusJson();`,
  `    private boolean requestAutomaticInstallPermission(int promptVersionCode, boolean installAfterPermission) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || canRequestPackageInstalls() || !automaticUpdates()) return false;
        int promptKey = promptVersionCode > 0 ? promptVersionCode : BuildConfig.VERSION_CODE;
        int lastPrompt = prefs.getInt("lastPermissionPromptVersionCode", 0);
        prefs.edit().putBoolean("installAfterPermission", installAfterPermission).apply();
        setState("permission_required", "", 0);
        if (lastPrompt != promptKey) {
            prefs.edit().putInt("lastPermissionPromptVersionCode", promptKey).apply();
            openInstallPermissionSettings();
        }
        return true;
    }

    String openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return statusJson();`,
  'automatic permission helper'
);
write('app/src/main/java/tv/swoop/player/SwoopUpdateManager.java',updater);

// Version markers in Android/native bridge.
let gradle=read('app/build.gradle');
gradle=replaceOnce(gradle,'versionCode 843','versionCode 844','Gradle versionCode');
gradle=replaceOnce(gradle,"versionName '0.8.43'","versionName '0.8.44'",'Gradle versionName');
write('app/build.gradle',gradle);

let activity=read('app/src/main/java/tv/swoop/player/MainActivity.java').replaceAll('0.8.43','0.8.44');
write('app/src/main/java/tv/swoop/player/MainActivity.java',activity);

let refresh=read('scripts/refresh-seed-cache.mjs').replaceAll('0.8.43','0.8.44');
write('scripts/refresh-seed-cache.mjs',refresh);

// Keep checked-in seed version markers aligned; the workflow refreshes full seed content afterward.
for(const seedPath of ['app/src/main/assets/seed-cache.json','swoop-tv-seed-cache.json']){
  const seed=JSON.parse(read(seedPath));seed.sourceVersion=VERSION;write(seedPath,JSON.stringify(seed,null,2)+'\n');
}

// ---- Regression contracts --------------------------------------------------
let tests=read('tests/tv-ui-runtime-smoke.mjs');
tests=replaceOnce(
  tests,
  "const storageSource = fs.readFileSync(new URL('../app/src/main/assets/src/storage.js', import.meta.url), 'utf8');",
  "const storageSource = fs.readFileSync(new URL('../app/src/main/assets/src/storage.js', import.meta.url), 'utf8');\nconst profilesSource = fs.readFileSync(new URL('../app/src/main/assets/src/profiles.js', import.meta.url), 'utf8');",
  'profile source regression input'
);
tests=tests.replaceAll('0.8.43','0.8.44');
tests=replaceOnce(
  tests,
  "if (!updaterSource.includes('installAfterPermission') || !updaterSource.includes('pendingManual || automaticUpdates()')) throw new Error('Updater permission-return continuation missing');",
  "if (!updaterSource.includes('installAfterPermission') || !updaterSource.includes('pendingManual || automaticUpdates()')) throw new Error('Updater permission-return continuation missing');\nif (!updaterSource.includes('requestAutomaticInstallPermission') || !updaterSource.includes('lastPermissionPromptVersionCode')) throw new Error('Launch-time automatic update permission prompt missing');\nif (!appSource.includes('async function bootstrapAndroidPreLogin()') || !appSource.includes(\"title:'Checking for updates…'\") || !appSource.includes(\"title:'Loading your library…'\")) throw new Error('Branded pre-login update/library boot pipeline missing');\nif (!cssSource.includes('width:min(440px,54vw)')) throw new Error('Large Swoop TV boot logo missing');\nif (!profilesSource.includes(\"providerMode='shared'\") || !profilesSource.includes('privateProviders=[]')) throw new Error('Profile provider ownership fields missing');\nif (!appSource.includes(\"Shared household providers\") || !appSource.includes(\"Private providers\") || !appSource.includes('function scopedProviderId(')) throw new Error('Shared/private account provider selection missing');\nif (!appSource.includes('state.sharedProviders=') || !appSource.includes(\"profile.providerMode==='private'\")) throw new Error('Household/private provider scope migration missing');\nif (!appSource.includes(\"if(state.catalog.length){const enabled=new Set(enabledProviders().map(p=>p.id));base=base.filter\")) throw new Error('Private account catalogue isolation guard missing');",
  'v0.8.44 regressions'
);
write('tests/tv-ui-runtime-smoke.mjs',tests);

// ---- Canonical release notes / checked-in manifest -------------------------
let notes=read('RELEASE_NOTES.md');
const releaseLines=[
  '## v0.8.44 — Branded Boot Pipeline + Account Provider Privacy',
  '',
  '- Replaces the immediate profile-picker launch with a branded Google TV boot sequence: a large Swoop TV logo, **Checking for updates**, real update/download status, **Loading your library**, and only then **Who’s Watching?**.',
  '- Automatic Updates now run as part of login startup. When update-install permission is missing, Swoop TV proactively opens Android’s one-time **Allow from this source** screen and resumes the pending update after returning.',
  '- Proactively requests the updater permission once per installed/target build when Automatic Updates is enabled, even when the current build is already up to date, so the next release can update with minimal friction.',
  '- Restores the complete durable library before the account chooser and preloads launch-critical Home artwork so selecting an account does not begin the heavy library load.',
  '- Makes the first-created account the **household provider owner**. Existing Xtream/M3U providers are migrated into that shared household provider set.',
  '- Additional accounts can choose **Shared household providers** to inherit the first account’s saved Xtream/M3U providers and credentials, or **Private providers** to use completely separate provider logins.',
  '- Private-account provider IDs, visible provider lists, credential prefills and catalogue filtering are isolated from other Swoop TV accounts. A private account with no providers opens with an empty provider library rather than leaking household content.',
  '- Shared/private provider mode is saved with each account and can be changed later; private provider records are retained if an account temporarily switches back to the household provider set.',
  '- Existing Favorites, Continue Watching, watch history, profile themes, providers and settings are preserved during the v0.8.44 in-place update.',
  '- Android versionName is **0.8.44** and versionCode is **844**.',
  '',
  ''
];
const releaseSection=releaseLines.join('\n');
if(!notes.startsWith('## v0.8.44'))notes=releaseSection+notes;
write('RELEASE_NOTES.md',notes);

const changes=releaseLines.filter(line=>line.startsWith('- ')).map(line=>line.slice(2).replace(/\*\*/g,'').replace(/`/g,'')).slice(0,8);
const updateUrl='https://github.com/'+REPO+'/releases/download/'+RELEASE_TAG+'/'+STABLE_APK;
write('swoop-tv-latest.json',JSON.stringify({version:VERSION,versionCode:VERSION_CODE,updateUrl,changes},null,2)+'\n');
write('build-metadata.json',JSON.stringify({version:VERSION,versionCode:VERSION_CODE,versionedApk:'Swoop-TV-v'+VERSION+'-Google-TV-Test.apk',stableApk:STABLE_APK,changes},null,2)+'\n');
write('release-summary.md','Swoop TV Google TV hardware-test channel — current v'+VERSION+'.\n\n'+changes.map(x=>'- '+x).join('\n')+'\n\nTest-only signing identity; not a production release.\n');

// Promotion should leave no staging trigger behind.
fs.rmSync(path.join(root,'.promotion/promote-pending.mjs'),{force:true});
try{fs.rmdirSync(path.join(root,'.promotion'))}catch{}

// Catch syntax failures before the regular CI gates.
execFileSync('node',['--check','app/src/main/assets/app.js'],{stdio:'inherit'});
execFileSync('node',['--check','app/src/main/assets/src/profiles.js'],{stdio:'inherit'});
execFileSync('node',['--check','scripts/refresh-seed-cache.mjs'],{stdio:'inherit'});

execFileSync('git',['config','user.name','github-actions[bot]'],{stdio:'inherit'});
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],{stdio:'inherit'});
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Promote v0.8.44 boot pipeline and account provider privacy [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Promoted v0.8.44 branded boot pipeline and account provider privacy.');
