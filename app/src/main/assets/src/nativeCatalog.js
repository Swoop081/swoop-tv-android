import {nativeRequest,isNativeWindows} from './native.js';
import {cleanDisplayTitle,releaseYear,sourceScore} from './sourceStack.js';
import {normalizeMediaTitle} from './mdblist.js';

function cleanChannelName(value=''){
  return String(value||'').toLowerCase()
    .replace(/\b(?:uhd|fhd|hd|sd|4k|1080p|1080i|720p|576p|576i|50fps|60fps)\b/g,' ')
    .replace(/^[a-z]{2,5}\s*[-|:]\s*/,'')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function cleanGroup(value=''){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function artworkFingerprint(value=''){
  const raw=String(value||'').trim();if(!raw)return'';
  try{const u=new URL(raw,'https://swoop.invalid');return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/+$/,'')}catch{return raw.toLowerCase().split('?')[0].replace(/\/+$/,'')}
}
function logicalKey(item={}){
  const kind=String(item.kind||'');
  if(kind==='movie'){
    const imdb=String(item.imdbId||'').trim().toLowerCase(),tmdb=String(item.tmdbId||'').trim(),title=normalizeMediaTitle(item.name),year=releaseYear(item),art=artworkFingerprint(item.logo||item.backdrop||'');
    if(title&&year)return `title-year:${title}|${year}`;if(imdb)return `imdb:${imdb}`;if(tmdb)return `tmdb:${tmdb}`;if(title&&art)return `title-art:${title}|${art}`;return `single:${item.id}`;
  }
  if(kind==='live'){
    // Live TV is stream-first, not title/channel-stack-first. Two entries that share
    // a name or EPG id can be different endpoints/qualities and must stay separate.
    return `live:single:${item.id}`;
  }
  if(kind==='series'){
    const tmdb=String(item.tmdbId||'').trim(),imdb=String(item.imdbId||'').trim().toLowerCase(),title=normalizeMediaTitle(item.name),year=releaseYear(item);
    if(imdb)return `series:imdb:${imdb}`;if(tmdb)return `series:tmdb:${tmdb}`;if(title&&year)return `series:title-year:${title}|${year}`;if(title)return `series:title:${title}`;return `series:single:${item.id}`;
  }
  return `${kind||'item'}:single:${item.id}`;
}

export function prepareNativeCatalogItems(items=[]){
  return items.map(item=>({
    ...item,
    _dbLogicalKey:logicalKey(item),
    _dbCleanName:item.kind==='movie'?normalizeMediaTitle(cleanDisplayTitle(item)):item.kind==='live'?cleanChannelName(item.name):normalizeMediaTitle(item.name),
    _dbDisplayName:item.kind==='movie'?cleanDisplayTitle(item):String(item.name||''),
    _dbYear:Number(releaseYear(item)||0),
    _dbSourceScore:Number(sourceScore(item)||0)
  }));
}

export async function nativeCatalogStatus(){if(!isNativeWindows())return null;return nativeRequest('/native/catalog/status',null,{timeoutMs:15000})}
export async function nativeCatalogReplaceProvider(providerId,items=[],{onProgress}={}){
  if(!isNativeWindows())return null;
  const prepared=prepareNativeCatalogItems(items),chunkSize=2000;
  await nativeRequest('/native/catalog/begin',{providerId},{timeoutMs:30000});
  for(let i=0;i<prepared.length;i+=chunkSize){
    const chunk=prepared.slice(i,i+chunkSize);
    await nativeRequest('/native/catalog/append',{providerId,items:chunk},{timeoutMs:60000});
    onProgress?.({loaded:Math.min(prepared.length,i+chunk.length),total:prepared.length});
    await new Promise(r=>setTimeout(r,0));
  }
  return nativeRequest('/native/catalog/finish',{providerId},{timeoutMs:60000});
}
export async function nativeCatalogRemoveProvider(providerId){if(!isNativeWindows())return null;return nativeRequest('/native/catalog/remove-provider',{providerId},{timeoutMs:30000})}
export async function nativeCatalogQuery({kind='',providerId='all',providerIds=[],group='',offset=0,limit=120,sort='name',ids=[]}={}){if(!isNativeWindows())return null;return nativeRequest('/native/catalog/query',{kind,providerId,providerIds,group,offset,limit,sort,ids},{timeoutMs:30000})}
export async function nativeCatalogSearch(term,{providerId='all',providerIds=[],limit=80,kinds=['movie','series','live']}={}){if(!isNativeWindows())return null;return nativeRequest('/native/catalog/search',{term,providerId,providerIds,limit,kinds},{timeoutMs:30000})}
export async function nativeCatalogCategories(kind,{providerId='all',providerIds=[],limit=40}={}){if(!isNativeWindows())return null;return nativeRequest('/native/catalog/categories',{kind,providerId,providerIds,limit},{timeoutMs:30000})}
export async function nativeCatalogGet(ids=[]){if(!isNativeWindows())return null;return nativeRequest('/native/catalog/get',{ids},{timeoutMs:30000})}
export async function nativeCatalogSources(logicalKeyValue){if(!isNativeWindows())return null;return nativeRequest('/native/catalog/sources',{logicalKey:logicalKeyValue},{timeoutMs:30000})}
export async function nativeCatalogMatch(candidates=[],mediaType='movie',limit=30,providerIds=[]){if(!isNativeWindows())return null;return nativeRequest('/native/catalog/match',{candidates,mediaType,limit,providerIds},{timeoutMs:30000})}

function unwrapCandidate(entry){return entry?.movie||entry?.show||entry?.media||entry?.item||entry||{}}
function sourceEntries(payload){if(Array.isArray(payload))return payload;if(!payload||typeof payload!=='object')return[];for(const k of ['items','movies','shows','results','data','list','entries'])if(Array.isArray(payload[k]))return payload[k];if(payload.data&&typeof payload.data==='object')for(const k of ['items','movies','shows','results'])if(Array.isArray(payload.data[k]))return payload.data[k];return[]}
function candidateYear(title='',explicit=''){const e=String(explicit||'').match(/(?:19|20)\d{2}/);if(e)return Number(e[0]);const m=String(title||'').match(/(?:19|20)\d{2}/g);return m?.length?Number(m[m.length-1]):0}
export function prepareNativeMatchCandidates(payload,sourceLimit=100){return sourceEntries(payload).slice(0,sourceLimit).map((raw,rank)=>{const m=unwrapCandidate(raw),ids=m.ids||raw?.ids||{},title=m.title||m.name||raw?.title||raw?.name||'',tmdb=m.tmdb??m.tmdb_id??ids.tmdb??raw?.tmdb??raw?.tmdb_id??(typeof raw?.id==='number'?raw.id:''),imdb=m.imdb??m.imdb_id??ids.imdb??raw?.imdb??raw?.imdb_id??'';return {rank,title,cleanName:normalizeMediaTitle(title),year:candidateYear(title,m.year||m.release_year||raw?.year||raw?.release_year||''),tmdb:String(tmdb||''),imdb:String(imdb||'').toLowerCase()}}).filter(x=>x.cleanName||x.tmdb||x.imdb)}
export async function nativeCatalogMatchPayload(payload,mediaType='movie',{sourceLimit=100,limit=70,providerIds=[]}={}){return nativeCatalogMatch(prepareNativeMatchCandidates(payload,sourceLimit),mediaType,limit,providerIds)}
