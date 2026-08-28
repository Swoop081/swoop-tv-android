import {metadataServiceUrl} from './tmdb.js';

async function postDiscovery(settings,body){
  const service=metadataServiceUrl(settings);
  if(!service)throw new Error('Swoop TV discovery service is not configured.');
  const res=await fetch(service,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  if(!res.ok){let detail='';try{detail=(await res.json())?.error||''}catch{}throw new Error(detail||`Swoop TV discovery service returned HTTP ${res.status}.`)}
  return res.json();
}

export async function fetchSwoopDiscovery({settings={},mediaType='movie'}={}){
  return postDiscovery(settings,{mode:'discovery',mediaType:mediaType==='series'||mediaType==='show'||mediaType==='tv'?'tv':'movie'});
}

export async function fetchSwoopCuratedList({settings={},listKey='' }={}){
  if(!listKey)throw new Error('Swoop TV curated-list key is missing.');
  const aliases={'trending-movies':'movies-trakt','trending-shows':'shows-trakt'};
  const workerKey=aliases[String(listKey)]||String(listKey);
  return postDiscovery(settings,{mode:'snoak-list',listKey:workerKey});
}
