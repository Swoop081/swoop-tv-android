const STATE_KEY='swoop-tv-state-v029';
const LEGACY_KEY='swoop-tv-v01';
const PROFILE_KEY='swoop-tv-provider-profile-v1';
const PROVIDERS_KEY='swoop-tv-provider-profiles-v2';
const DB_NAME='swoop-tv-storage';
const DB_VERSION=1;
const STORE='data';
const BULK_MANIFEST='bulk-manifest-v2';
const CATALOG_PREFIX='bulk-catalog-v2:';
const WEB_KEY='bulk-web-discovery-v2';
const META_KEY='bulk-metadata-v2';
const MDB_ROWS_KEY='bulk-mdblist-rows-v2';
const CATALOG_CHUNK_SIZE=2000;
const HOME_SNAPSHOT_KEY='swoop-tv-home-snapshot-v1';

function safeParse(value){
  try{return value?JSON.parse(value):null}catch{return null}
}

function openDb(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in globalThis)){reject(new Error('IndexedDB unavailable'));return}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Could not open Swoop TV storage'));
  });
}

async function idbPut(key,value){
  const db=await openDb();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Could not save Swoop TV library'));tx.onabort=()=>reject(tx.error||new Error('Swoop TV storage transaction aborted'))})}finally{db.close()}
}

async function idbGet(key){
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error||new Error('Could not restore Swoop TV library'))})}finally{db.close()}
}

async function idbDelete(key){
  try{const db=await openDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}finally{db.close()}}catch{}
}

async function idbKeys(){
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).getAllKeys();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error||new Error('Could not inspect Swoop TV storage'))})}finally{db.close()}
}

const yieldToUi=()=>new Promise(resolve=>setTimeout(resolve,0));

function compactRows(rows=[]){
  return Array.isArray(rows)?rows.map(r=>({...r,items:[]})):[];
}

function lightweightState(state){
  return {
    ...state,
    catalog:[],
    webDiscovery:{},
    metadataCache:{},
    mdblistRows:compactRows(state?.mdblistRows||[]),
    page:'home'
  };
}

function bulkParts(state){
  return {
    catalog:Array.isArray(state?.catalog)?state.catalog:[],
    webDiscovery:state?.webDiscovery&&typeof state.webDiscovery==='object'?state.webDiscovery:{},
    metadataCache:state?.metadataCache&&typeof state.metadataCache==='object'?state.metadataCache:{},
    mdblistRows:Array.isArray(state?.mdblistRows)?state.mdblistRows:[]
  };
}

async function cleanupOldCatalogChunks(keep=0){
  try{
    const keys=await idbKeys();
    const stale=keys.filter(k=>String(k).startsWith(CATALOG_PREFIX)&&Number(String(k).slice(CATALOG_PREFIX.length))>=keep);
    for(const key of stale)await idbDelete(key);
  }catch{}
}

async function loadChunkedBulk(manifest,onProgress){
  const count=Math.max(0,Number(manifest?.catalogChunks||0)),catalog=[];
  for(let i=0;i<count;i++){
    const chunk=await idbGet(`${CATALOG_PREFIX}${i}`);
    if(Array.isArray(chunk))catalog.push(...chunk);
    onProgress?.({phase:'catalog',loaded:i+1,total:count,items:catalog.length});
    await yieldToUi();
  }
  const [webDiscovery,metadataCache,mdblistRows]=await Promise.all([idbGet(WEB_KEY),idbGet(META_KEY),idbGet(MDB_ROWS_KEY)]);
  onProgress?.({phase:'finishing',loaded:count,total:count,items:catalog.length});
  return {catalog,webDiscovery:webDiscovery||{},metadataCache:metadataCache||{},mdblistRows:Array.isArray(mdblistRows)?mdblistRows:[],savedAt:Number(manifest?.savedAt||0),schema:2};
}

function loadLegacyViaWorker(onProgress){
  return new Promise((resolve,reject)=>{
    if(typeof Worker==='undefined'){reject(new Error('Background storage worker unavailable'));return}
    let worker;
    try{worker=new Worker(new URL('./storage-worker.js',import.meta.url),{type:'module'})}catch(err){reject(err);return}
    const catalog=[];
    const finish=(fn,value)=>{try{worker.terminate()}catch{}fn(value)};
    worker.onmessage=e=>{
      const msg=e.data||{};
      if(msg.type==='start')onProgress?.({phase:'legacy',loaded:0,total:Number(msg.totalChunks||0),items:0});
      else if(msg.type==='catalog'){
        if(Array.isArray(msg.items))catalog.push(...msg.items);
        onProgress?.({phase:'legacy',loaded:Number(msg.index||0)+1,total:Number(msg.totalChunks||0),items:catalog.length});
      }else if(msg.type==='done'){
        finish(resolve,{catalog,webDiscovery:msg.webDiscovery||{},metadataCache:{},mdblistRows:Array.isArray(msg.mdblistRows)?msg.mdblistRows:[],savedAt:Number(msg.savedAt||0),schema:1,legacy:true,droppedLegacyMetadata:true});
      }else if(msg.type==='empty')finish(resolve,null);
      else if(msg.type==='error')finish(reject,new Error(msg.message||'Could not restore legacy Swoop TV library'));
    };
    worker.onerror=e=>finish(reject,new Error(e?.message||'Could not start the Swoop TV storage worker'));
    worker.postMessage({type:'load-legacy',chunkSize:1000});
  });
}


export function loadHomeSnapshot(){
  try{return safeParse(localStorage.getItem(HOME_SNAPSHOT_KEY))||null}catch{return null}
}

export function saveHomeSnapshot(snapshot){
  try{
    if(!snapshot||!Array.isArray(snapshot.catalog)||!snapshot.catalog.length)return false;
    localStorage.setItem(HOME_SNAPSHOT_KEY,JSON.stringify(snapshot));
    return true;
  }catch{return false}
}

export async function loadBulkPreview(){
  try{
    const manifest=await idbGet(BULK_MANIFEST),count=Math.max(0,Number(manifest?.catalogChunks||0));
    if(!count)return null;
    const wanted=[0,Math.floor((count-1)/2),count-1].filter((v,i,a)=>v>=0&&v<count&&a.indexOf(v)===i),catalog=[];
    for(const index of wanted){const chunk=await idbGet(`${CATALOG_PREFIX}${index}`);if(Array.isArray(chunk))catalog.push(...chunk);await yieldToUi()}
    const webDiscovery=await idbGet(WEB_KEY).catch(()=>null);
    return {catalog,webDiscovery:webDiscovery||{},savedAt:Number(manifest?.savedAt||0),preview:true};
  }catch{return null}
}

export function loadState(){
  try{
    const current=safeParse(localStorage.getItem(STATE_KEY));
    if(current)return current;
    return safeParse(localStorage.getItem(LEGACY_KEY));
  }catch{return null}
}

export async function loadBulkState({onProgress}={}){
  try{
    const manifest=await idbGet(BULK_MANIFEST);
    if(manifest?.schema===2)return await loadChunkedBulk(manifest,onProgress);
    try{return await loadLegacyViaWorker(onProgress)}catch{return await idbGet('bulk')}
  }catch{return null}
}

export function loadProviderProfiles(){
  try{
    const current=safeParse(localStorage.getItem(PROVIDERS_KEY));
    if(Array.isArray(current))return current;
    const legacy=safeParse(localStorage.getItem(PROFILE_KEY));
    return legacy?[legacy]:[];
  }catch{return []}
}

export function saveProviderProfiles(profiles=[]){
  try{
    const clean=Array.isArray(profiles)?profiles.map(p=>({...p,savedAt:p?.savedAt||Date.now()})):[];
    localStorage.setItem(PROVIDERS_KEY,JSON.stringify(clean));
    if(clean.length===1)localStorage.setItem(PROFILE_KEY,JSON.stringify(clean[0]));
    else localStorage.removeItem(PROFILE_KEY);
    return true;
  }catch{return false}
}

export function clearProviderProfiles(){
  try{localStorage.removeItem(PROVIDERS_KEY);localStorage.removeItem(PROFILE_KEY)}catch{}
}

export function loadProviderProfile(){
  try{return safeParse(localStorage.getItem(PROFILE_KEY))||null}catch{return null}
}

export function saveProviderProfile(profile){
  try{localStorage.setItem(PROFILE_KEY,JSON.stringify({...profile,savedAt:Date.now()}));return true}catch{return false}
}

export function clearProviderProfile(){
  try{localStorage.removeItem(PROFILE_KEY)}catch{}
}

export function saveState(state){
  try{localStorage.setItem(STATE_KEY,JSON.stringify(lightweightState(state)));return true}catch{return false}
}

export async function saveBulkState(state,{catalog=true}={}){
  try{
    const parts=bulkParts(state);
    let manifest=await idbGet(BULK_MANIFEST);
    if(catalog||!manifest?.schema){
      const chunks=[];
      for(let i=0;i<parts.catalog.length;i+=CATALOG_CHUNK_SIZE)chunks.push(parts.catalog.slice(i,i+CATALOG_CHUNK_SIZE));
      for(let i=0;i<chunks.length;i++){
        await idbPut(`${CATALOG_PREFIX}${i}`,chunks[i]);
        if(i%2===1)await yieldToUi();
      }
      manifest={schema:2,catalogChunks:chunks.length,catalogItems:parts.catalog.length,savedAt:Date.now()};
      await idbPut(BULK_MANIFEST,manifest);
      await cleanupOldCatalogChunks(chunks.length);
      await idbDelete('bulk');
    }else{
      manifest={...manifest,savedAt:Date.now()};
      await idbPut(BULK_MANIFEST,manifest);
    }
    await Promise.all([
      idbPut(WEB_KEY,parts.webDiscovery),
      idbPut(META_KEY,parts.metadataCache),
      idbPut(MDB_ROWS_KEY,parts.mdblistRows)
    ]);
    try{localStorage.removeItem(LEGACY_KEY)}catch{}
    return true;
  }catch{return false}
}

export function clearState(){
  try{localStorage.removeItem(STATE_KEY);localStorage.removeItem(LEGACY_KEY);localStorage.removeItem(HOME_SNAPSHOT_KEY)}catch{}
  clearProviderProfiles();
  (async()=>{
    try{
      const keys=await idbKeys();
      for(const key of keys)if(String(key)==='bulk'||String(key)===BULK_MANIFEST||String(key).startsWith(CATALOG_PREFIX)||[WEB_KEY,META_KEY,MDB_ROWS_KEY].includes(String(key)))await idbDelete(key);
    }catch{}
  })();
}

export async function loadAuxState(){
  try{
    const [webDiscovery,metadataCache,mdblistRows]=await Promise.all([idbGet(WEB_KEY),idbGet(META_KEY),idbGet(MDB_ROWS_KEY)]);
    return {webDiscovery:webDiscovery||{},metadataCache:metadataCache||{},mdblistRows:Array.isArray(mdblistRows)?mdblistRows:[]};
  }catch{return {webDiscovery:{},metadataCache:{},mdblistRows:[]}}
}

export async function retireBrowserCatalog(){
  try{
    await idbPut(BULK_MANIFEST,{schema:2,catalogChunks:0,catalogItems:0,nativeCatalog:true,savedAt:Date.now()});
    await cleanupOldCatalogChunks(0);
    await idbDelete('bulk');
    return true;
  }catch{return false}
}
