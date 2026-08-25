const DB_NAME='swoop-tv-storage';
const DB_VERSION=1;
const STORE='data';

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Could not open Swoop TV storage'));
  });
}
function getKey(db,key){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(req.error||new Error('Could not read Swoop TV storage'))})}
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));

self.onmessage=async e=>{
  if(e.data?.type!=='load-legacy')return;
  const chunkSize=Math.max(250,Math.min(2000,Number(e.data?.chunkSize||1000)));
  let db;
  try{
    db=await openDb();
    const bulk=await getKey(db,'bulk');
    if(!bulk){self.postMessage({type:'empty'});return}
    const catalog=Array.isArray(bulk.catalog)?bulk.catalog:[],totalChunks=Math.ceil(catalog.length/chunkSize);
    self.postMessage({type:'start',totalChunks,totalItems:catalog.length});
    for(let i=0;i<totalChunks;i++){
      self.postMessage({type:'catalog',index:i,totalChunks,items:catalog.slice(i*chunkSize,(i+1)*chunkSize)});
      await pause();
    }
    self.postMessage({type:'done',webDiscovery:bulk.webDiscovery||{},mdblistRows:Array.isArray(bulk.mdblistRows)?bulk.mdblistRows:[],savedAt:Number(bulk.savedAt||0)});
  }catch(err){self.postMessage({type:'error',message:err?.message||String(err)})}
  finally{try{db?.close()}catch{}}
};
