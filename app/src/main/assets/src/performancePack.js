const DB_NAME='swoop-tv-performance-pack';
const DB_VERSION=1;
const STORE='data';
const MANIFEST_KEY='manifest-v1';
const PROVIDER_PREFIX='provider-v1:';
const STARMETER_KEY='starmeter-v1';
export const PERFORMANCE_ARTWORK_CACHE='swoop-tv-artwork-v1';
const PACK_SCHEMA=1;
const DEFAULT_INITIAL_ARTWORK_LIMIT=1800;
const DEFAULT_INCREMENTAL_ARTWORK_LIMIT=480;
const STARMETER_RETENTION_MS=90*24*60*60*1000;

function openDb(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in globalThis)){reject(new Error('IndexedDB unavailable'));return}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Could not open Swoop TV Performance Pack'));
  });
}
async function getKey(key){const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error)})}finally{db.close()}}
async function putKey(key,value){const db=await openDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}

function norm(v=''){return String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function simpleHash(value=''){let h=2166136261;const s=String(value||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function itemFingerprint(item={}){return simpleHash([item.id,item.kind,item.name,item.year,item.group,item.logo,item.backdrop,item.titleLogo,item.tmdbId,item.imdbId,item.providerAddedAt,item.streamId,item.seriesId].map(v=>String(v??'')).join('\u001f'))}
function providerFingerprint(rows=[]){let h=2166136261;const stable=(rows||[]).map(item=>`${String(item?.id||'')}|${itemFingerprint(item)}`).sort();for(const s of stable)for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return `${stable.length}-${(h>>>0).toString(36)}`}
export function performancePackProviderDelta(priorItems=[],items=[]){
  const oldMap=new Map((priorItems||[]).map(x=>[String(x?.id||''),String(x?.hash||'')])),nextRows=[],changedItems=[];let added=0,changed=0,unchanged=0;
  for(const item of items||[]){const key=String(item?.id||'');if(!key)continue;const fp=itemFingerprint(item),old=oldMap.get(key);if(old===undefined){added++;changedItems.push(item)}else if(old!==fp){changed++;changedItems.push(item)}else unchanged++;nextRows.push({id:key,hash:fp})}
  const nextIds=new Set(nextRows.map(x=>x.id)),removed=(priorItems||[]).filter(x=>!nextIds.has(String(x?.id||''))).length;
  return {added,changed,removed,unchanged,nextRows,changedItems,fingerprint:providerFingerprint(items||[])};
}
function profileUrl(value='',size='w185'){const raw=String(value||'').trim();if(!raw)return'';if(/^https?:\/\//i.test(raw))return /image\.tmdb\.org\/t\/p\//i.test(raw)?raw.replace(/\/t\/p\/(?:original|w\d+)\//i,`/t/p/${size}/`):raw;if(raw.startsWith('/'))return `https://image.tmdb.org/t/p/${size}${raw}`;return''}
function artUrl(value='',size='w342'){return profileUrl(value,size)}
function addUrl(out,seen,value,size){const url=artUrl(value,size);if(!url||seen.has(url))return;seen.add(url);out.push(url)}
function seedArtworkUrls(seed={},limit=600){const out=[],seen=new Set();for(const entry of seed?.starmeter?.people||[]){const person=entry?.person||entry;addUrl(out,seen,person?.profile||entry?.profile,'w185');if(out.length>=limit)return out}for(const meta of seed?.titleMetadata||[]){addUrl(out,seen,meta?.poster||meta?.poster_path,'w342');if(out.length>=limit)return out;addUrl(out,seen,meta?.backdrop||meta?.backdrop_path,'w780');if(out.length>=limit)return out;addUrl(out,seen,meta?.titleLogo||meta?.logo,'w500');if(out.length>=limit)return out}return out}
function catalogArtworkUrls(items=[],limit=DEFAULT_INITIAL_ARTWORK_LIMIT){const out=[],seen=new Set();const live=[],video=[];for(const item of items||[]){if(item?.kind==='live')live.push(item);else if(item?.kind==='movie'||item?.kind==='series')video.push(item)}const ordered=[...live.slice(0,350),...video];for(const item of ordered){addUrl(out,seen,item?.logo,'w342');if(out.length>=limit)break;if(item?.kind!=='live'&&out.length<360)addUrl(out,seen,item?.backdrop,'w780');if(out.length>=limit)break}return out.slice(0,limit)}
async function cacheArtworkUrls(urls=[],{onProgress,deadlineMs=180000,concurrency=6}={}){
  if(!('caches'in globalThis)||!urls.length)return {requested:0,cached:0,skipped:0,failed:0};
  const cache=await caches.open(PERFORMANCE_ARTWORK_CACHE),manifest=await loadPerformancePackManifest(),known=new Set(Array.isArray(manifest.warmedUrls)?manifest.warmedUrls:[]),todo=urls.filter(Boolean),started=Date.now();let cursor=0,cached=0,skipped=0,failed=0,processed=0;
  const report=()=>{try{onProgress?.({processed,total:todo.length,cached,skipped,failed,progress:todo.length?processed/todo.length:1})}catch{}};
  async function one(url){
    if(known.has(url)){skipped++;return}
    try{
      const hit=await cache.match(url,{ignoreVary:true});if(hit){known.add(url);skipped++;return}
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      try{const res=await fetch(url,{mode:'no-cors',cache:'force-cache',signal:controller.signal});if(res){await cache.put(url,res.clone());known.add(url);cached++;}else failed++}finally{clearTimeout(timer)}
    }catch{failed++}
  }
  async function worker(){while(cursor<todo.length&&Date.now()-started<deadlineMs){const i=cursor++,url=todo[i];await one(url);processed++;if(processed%20===0){report();await new Promise(r=>setTimeout(r,0))}}}
  await Promise.all(Array.from({length:Math.max(1,Math.min(8,Number(concurrency||6),todo.length||1))},worker));report();
  const allKnown=[...known],trimmed=allKnown.slice(-6000),expired=allKnown.slice(0,Math.max(0,allKnown.length-trimmed.length));for(let i=0;i<expired.length;i+=100){await Promise.allSettled(expired.slice(i,i+100).map(url=>cache.delete(url)));await new Promise(r=>setTimeout(r,0))}await savePerformancePackManifest({...manifest,warmedUrls:trimmed,lastArtworkWarmAt:Date.now(),artworkCacheName:PERFORMANCE_ARTWORK_CACHE});
  return {requested:todo.length,cached,skipped,failed,processed};
}

export async function loadPerformancePackManifest(){try{return (await getKey(MANIFEST_KEY))||{schema:PACK_SCHEMA,seedRevision:'',providers:{},warmedUrls:[],createdAt:Date.now()}}catch{return {schema:PACK_SCHEMA,seedRevision:'',providers:{},warmedUrls:[],createdAt:Date.now()}}}
export async function savePerformancePackManifest(value={}){const next={schema:PACK_SCHEMA,...value,updatedAt:Date.now()};try{await putKey(MANIFEST_KEY,next)}catch{}return next}

export async function bootstrapPerformancePack(seed={}, {onProgress}={}){
  const manifest=await loadPerformancePackManifest(),seedRevision=String(seed?.builtAt||seed?.sourceVersion||'');
  if(seedRevision&&manifest.seedRevision===seedRevision)return {...manifest,seedChanged:false};
  const urls=seedArtworkUrls(seed,650);if(urls.length)await cacheArtworkUrls(urls,{onProgress,deadlineMs:65000,concurrency:5});
  return savePerformancePackManifest({...manifest,seedRevision,seedSourceVersion:String(seed?.sourceVersion||''),seedChanged:true,seedPreparedAt:Date.now()});
}

export async function syncProviderPerformancePack(providerId,items=[],{onProgress,initial=false}={}){
  const id=String(providerId||'').trim();if(!id)return {added:0,changed:0,removed:0,unchanged:0,fingerprint:''};
  const prior=await getKey(`${PROVIDER_PREFIX}${id}`).catch(()=>null);for(let i=2500;i<items.length;i+=2500){try{onProgress?.({phase:'compare',processed:i,total:items.length,progress:i/Math.max(1,items.length)})}catch{}await new Promise(r=>setTimeout(r,0))}
  const delta=performancePackProviderDelta(prior?.items||[],items),{added,changed,removed,unchanged,nextRows,changedItems,fingerprint}=delta,record={schema:1,providerId:id,fingerprint,items:nextRows,count:nextRows.length,savedAt:Date.now()};await putKey(`${PROVIDER_PREFIX}${id}`,record).catch(()=>{});
  const manifest=await loadPerformancePackManifest(),providers={...(manifest.providers||{}),[id]:{fingerprint,count:nextRows.length,savedAt:record.savedAt}};await savePerformancePackManifest({...manifest,providers});
  const warmSource=initial||!prior?items:changedItems,limit=initial||!prior?DEFAULT_INITIAL_ARTWORK_LIMIT:DEFAULT_INCREMENTAL_ARTWORK_LIMIT,urls=catalogArtworkUrls(warmSource,limit),artwork=await cacheArtworkUrls(urls,{onProgress:info=>{try{onProgress?.({phase:'artwork',...info})}catch{}},deadlineMs:initial||!prior?180000:65000,concurrency:6});
  return {added,changed,removed,unchanged,fingerprint,changedItems,artwork,initial:!prior};
}

export async function removeProviderPerformancePack(providerId){
  const id=String(providerId||'').trim();if(!id)return false;try{const db=await openDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(`${PROVIDER_PREFIX}${id}`);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}catch{}
  const manifest=await loadPerformancePackManifest(),providers={...(manifest.providers||{})};delete providers[id];await savePerformancePackManifest({...manifest,providers});return true;
}

export async function performancePackProviderFingerprint(providerIds=[]){const manifest=await loadPerformancePackManifest(),ids=[...new Set((providerIds||[]).map(String).filter(Boolean))].sort();return ids.map(id=>`${id}:${manifest.providers?.[id]?.fingerprint||'unknown'}`).join('|')}

export async function loadPerformancePackStarmeter(names=[]){
  const payload=await getKey(STARMETER_KEY).catch(()=>null),rows=payload?.rows&&typeof payload.rows==='object'?payload.rows:{},wanted=new Set((names||[]).map(norm).filter(Boolean)),out=[];const now=Date.now();
  for(const [key,row] of Object.entries(rows)){if(wanted.size&&!wanted.has(key))continue;if(!row||now-Number(row.savedAt||0)>STARMETER_RETENTION_MS)continue;out.push({key,...row})}return out;
}
export async function savePerformancePackStarmeter(entries=[],providerFingerprintValue=''){
  if(!entries.length)return false;const payload=await getKey(STARMETER_KEY).catch(()=>null),rows=payload?.rows&&typeof payload.rows==='object'?payload.rows:{},now=Date.now();
  for(const entry of entries){const key=norm(entry?.key||entry?.person?.name||'');if(!key)continue;rows[key]={person:entry.person||{},movies:Array.isArray(entry.movies)?entry.movies:[],shows:Array.isArray(entry.shows)?entry.shows:[],providerFingerprint:String(providerFingerprintValue||entry.providerFingerprint||''),loadedAt:Number(entry.loadedAt||now),savedAt:now}}
  for(const [key,row] of Object.entries(rows))if(now-Number(row?.savedAt||0)>STARMETER_RETENTION_MS)delete rows[key];await putKey(STARMETER_KEY,{schema:1,rows,updatedAt:now}).catch(()=>{});return true;
}

export async function performancePackStatus(){
  const manifest=await loadPerformancePackManifest(),starmeter=await getKey(STARMETER_KEY).catch(()=>null),providerCount=Object.keys(manifest.providers||{}).length,starmeterRows=Object.keys(starmeter?.rows||{}).length;let storage=null;try{storage=await navigator.storage?.estimate?.()}catch{}
  return {schema:PACK_SCHEMA,seedRevision:manifest.seedRevision||'',providerCount,starmeterRows,warmedArtwork:Number((manifest.warmedUrls||[]).length),updatedAt:Number(manifest.updatedAt||0),usage:Number(storage?.usage||0),quota:Number(storage?.quota||0)};
}
