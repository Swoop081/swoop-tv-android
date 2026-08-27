import {buildMovieStackIndex} from './sourceStack.js';
import {matchMDBListToCatalog} from './mdblist.js';

let catalog=[];
let searchRows=[];
let stackedMovies=[];
let enabledProviderIds=new Set();
let availability=null;

function enabled(item){
  if(!enabledProviderIds.size)return true;
  return !item?.providerId||enabledProviderIds.has(String(item.providerId));
}
function activeCatalog(){return catalog.filter(enabled)}
function normTitle(value=''){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/\b(?:19|20)\d{2}\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function mediaYear(value){const m=String(value||'').match(/(?:19|20)\d{2}/);return m?m[0]:''}
function mediaKind(item){return item?.kind==='series'?'series':'movie'}
function addIndex(map,key,item){if(!key||map.has(key))return;map.set(key,item)}
function buildAvailabilityIndex(active=[]){
  const idx={tmdb:new Map(),imdb:new Map(),titleYear:new Map(),title:new Map()};
  for(const item of active){if(!item||!['movie','series'].includes(item.kind))continue;const kind=mediaKind(item),tmdb=String(item.tmdbId||'').trim(),imdb=String(item.imdbId||'').trim().toLowerCase(),title=normTitle(item.name),year=mediaYear(item.year||item.name||'');if(tmdb)addIndex(idx.tmdb,`${kind}:${tmdb}`,item);if(imdb)addIndex(idx.imdb,`${kind}:${imdb}`,item);if(title&&year)addIndex(idx.titleYear,`${kind}:${title}:${year}`,item);if(title)addIndex(idx.title,`${kind}:${title}`,item)}
  return idx;
}
function creditKind(raw={},fallback='movie'){const mt=String(raw.media_type||raw.mediaType||'').toLowerCase();if(mt==='tv'||mt==='series'||fallback==='series'||fallback==='show')return'series';return'movie'}
function matchCreditFast(raw={},fallback='movie'){
  if(!availability)return null;const kind=creditKind(raw,fallback),tmdb=String(raw.tmdbId??raw.tmdb_id??raw.tmdb??raw.id??'').trim(),imdb=String(raw.imdbId??raw.imdb_id??raw.imdb??'').trim().toLowerCase(),title=normTitle(raw.title||raw.name||raw.original_title||raw.original_name||''),year=mediaYear(raw.year||raw.release_date||raw.first_air_date||'');
  return (tmdb&&availability.tmdb.get(`${kind}:${tmdb}`))||(imdb&&availability.imdb.get(`${kind}:${imdb}`))||(title&&year&&availability.titleYear.get(`${kind}:${title}:${year}`))||(title&&availability.title.get(`${kind}:${title}`))||null;
}
function fastPersonMatch(payload={},fallback='movie'){
  const out=[],seen=new Set();for(const raw of Array.isArray(payload?.items)?payload.items:[]){const hit=matchCreditFast(raw,fallback);if(hit&&!seen.has(String(hit.id))){seen.add(String(hit.id));out.push(hit)}}return out;
}
function reply(type,requestId,payload={}){self.postMessage({type,requestId,...payload})}

self.onmessage=e=>{
  const msg=e.data||{};
  try{
    if(msg.type==='init-start'){catalog=[];searchRows=[];availability=null;enabledProviderIds=new Set((msg.enabledProviderIds||[]).map(String));self.__providerPriority=msg.providerPriority||{};return;}
    if(msg.type==='init-chunk'){if(Array.isArray(msg.catalog))catalog.push(...msg.catalog);return;}
    if(msg.type==='init-end'||msg.type==='init'||msg.type==='movie-stack'){
      if(Array.isArray(msg.catalog))catalog=msg.catalog;
      if(Array.isArray(msg.enabledProviderIds))enabledProviderIds=new Set(msg.enabledProviderIds.map(String));
      const active=activeCatalog();
      searchRows=active.map(item=>({item,text:`${item?.name||''} ${item?.group||''} ${item?.year||''}`.toLowerCase()}));
      availability=buildAvailabilityIndex(active);
      // Person/search availability is useful immediately. Advertise readiness before the
      // more expensive source-stack ranking so STARmeter never waits behind Home stacking.
      self.postMessage({type:'worker-ready',count:active.length,indexed:true});
      setTimeout(()=>{try{const index=buildMovieStackIndex(active,msg.providerPriority||self.__providerPriority||{});stackedMovies=index.stacked||[];let offset=0;const emit=()=>{const items=stackedMovies.slice(offset,offset+1000);if(items.length){self.postMessage({type:'movie-stack-chunk',items,offset,total:stackedMovies.length});offset+=items.length;setTimeout(emit,0)}else self.postMessage({type:'movie-stack-end',total:stackedMovies.length})};emit()}catch{}},180);
      return;
    }
    if(msg.type==='search'){
      const term=String(msg.term||'').trim().toLowerCase(),limit=Math.max(1,Math.min(120,Number(msg.limit||80))),kinds=new Set((msg.kinds||['movie','series','live']).map(String));
      const items=[];
      if(term){for(const row of searchRows){if(kinds.has(String(row.item?.kind||''))&&row.text.includes(term)){items.push(row.item);if(items.length>=limit)break}}}
      reply('search-result',msg.requestId,{items});return;
    }
    if(msg.type==='catalog-match'){
      const active=activeCatalog(),payload=msg.payload||{items:[]},mediaType=msg.mediaType==='show'?'show':'movie';
      const items=matchMDBListToCatalog(payload,active,{sourceLimit:Math.max(20,Math.min(1200,Number(msg.sourceLimit||800))),limit:Math.max(1,Math.min(200,Number(msg.limit||100))),mediaType});
      reply('catalog-match-result',msg.requestId,{items});return;
    }
    if(msg.type==='person-match'){
      const moviePayload=msg.moviePayload||{items:[]},showPayload=msg.showPayload||{items:[]};
      const movies=fastPersonMatch(moviePayload,'movie'),shows=fastPersonMatch(showPayload,'series');
      reply('person-match-result',msg.requestId,{movies,shows,indexed:true});return;
    }
  }catch(err){reply('worker-error',msg.requestId,{message:err?.message||String(err)})}
};
