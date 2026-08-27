import {buildMovieStackIndex} from './sourceStack.js';
import {matchMDBListToCatalog, normalizeMediaTitle} from './mdblist.js';

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
function normTitle(value=''){return normalizeMediaTitle(String(value||''))}
function mediaYear(value){const m=String(value||'').match(/(?:19|20)\d{2}/);return m?Number(m[0]):0}
function mediaKind(item){return item?.kind==='series'?'series':'movie'}
function addIndex(map,key,item){if(!key)return;const list=map.get(key)||[];if(!list.some(x=>String(x?.id||'')===String(item?.id||'')))list.push(item);map.set(key,list)}
function firstToken(title=''){return String(title||'').split(' ').filter(Boolean)[0]||''}
function tokenScore(a,b){const A=new Set(String(a||'').split(' ').filter(Boolean)),B=new Set(String(b||'').split(' ').filter(Boolean));if(!A.size||!B.size)return 0;let same=0;for(const t of A)if(B.has(t))same++;return same/Math.max(A.size,B.size)}
function bigrams(s){const x=` ${String(s||'')} `,out=[];for(let i=0;i<x.length-1;i++)out.push(x.slice(i,i+2));return out}
function diceScore(a,b){if(a===b)return 1;const A=bigrams(a),B=bigrams(b);if(!A.length||!B.length)return 0;const counts=new Map();A.forEach(x=>counts.set(x,(counts.get(x)||0)+1));let hit=0;for(const x of B){const n=counts.get(x)||0;if(n){hit++;counts.set(x,n-1)}}return 2*hit/(A.length+B.length)}
function fuzzyScore(a,b){if(!a||!b)return 0;if(a===b)return 1;if(Math.min(a.length,b.length)>=5&&(a.includes(b)||b.includes(a)))return .95;return Math.max(tokenScore(a,b),diceScore(a,b))}
function chooseClosest(list=[],year=0){if(!list.length)return null;if(!year)return list[0];let best=list[0],delta=999;for(const item of list){const y=mediaYear(item.year||item.name||'');const d=y?Math.abs(y-year):3;if(d<delta){delta=d;best=item}}return delta<=2||!mediaYear(best.year||best.name||'')?best:null}
function titleAliases(value=''){const n=normTitle(value);if(!n)return[];const noArticle=n.replace(/^(?:the|a|an)\s+/,'');return [...new Set([n,noArticle].filter(Boolean))]}
function itemTitleVariants(item={}){return [...new Set([item.name,item.title,item.originalTitle,item.original_title,item.displayName,item._dbDisplayName].flatMap(titleAliases).filter(Boolean))]}
function buildAvailabilityIndex(active=[]){
  const idx={tmdb:new Map(),imdb:new Map(),titleYear:new Map(),title:new Map(),bucket:new Map(),all:[]};
  for(const item of active){
    if(!item||!['movie','series'].includes(item.kind))continue;
    const kind=mediaKind(item),tmdb=String(item.tmdbId||'').trim(),imdb=String(item.imdbId||'').trim().toLowerCase(),year=mediaYear(item.year||item.name||'');
    if(tmdb)addIndex(idx.tmdb,`${kind}:${tmdb}`,item);if(imdb)addIndex(idx.imdb,`${kind}:${imdb}`,item);
    for(const title of itemTitleVariants(item)){
      if(year)addIndex(idx.titleYear,`${kind}:${title}:${year}`,item);
      addIndex(idx.title,`${kind}:${title}`,item);
      const bucket=firstToken(title);if(bucket)addIndex(idx.bucket,`${kind}:${bucket}`,item);
    }
    idx.all.push(item);
  }
  return idx;
}
function creditKind(raw={},fallback='movie'){const mt=String(raw.media_type||raw.mediaType||raw.kind||raw.type||'').toLowerCase();if(mt==='tv'||mt==='series'||mt==='show'||fallback==='series'||fallback==='show')return'series';return'movie'}
function creditTitleVariants(raw={}){return [...new Set([raw.title,raw.name,raw.original_title,raw.original_name,raw.originalTitle,raw.originalName].flatMap(titleAliases).filter(Boolean))]}
function matchCreditFast(raw={},fallback='movie'){
  if(!availability)return null;
  const kind=creditKind(raw,fallback),tmdb=String(raw.tmdbId??raw.tmdb_id??raw.tmdb??raw.id??'').trim(),imdb=String(raw.imdbId??raw.imdb_id??raw.imdb??'').trim().toLowerCase(),year=mediaYear(raw.year||raw.release_year||raw.release_date||raw.first_air_date||'');
  if(tmdb){const hit=chooseClosest(availability.tmdb.get(`${kind}:${tmdb}`)||[],year);if(hit)return hit}
  if(imdb){const hit=chooseClosest(availability.imdb.get(`${kind}:${imdb}`)||[],year);if(hit)return hit}
  const titles=creditTitleVariants(raw);
  for(const title of titles){if(year){for(const y of [year,year-1,year+1]){const hit=chooseClosest(availability.titleYear.get(`${kind}:${title}:${y}`)||[],year);if(hit)return hit}}}
  for(const title of titles){const hit=chooseClosest(availability.title.get(`${kind}:${title}`)||[],year);if(hit)return hit}
  // Controlled fuzzy fallback.  Search only the same-media bucket, never the whole
  // provider library, so STARmeter remains fast even with 30k+ titles.
  let best=null,bestScore=0;
  for(const title of titles){const bucket=firstToken(title),candidates=availability.bucket.get(`${kind}:${bucket}`)||[];for(const item of candidates){const itemYear=mediaYear(item.year||item.name||'');if(year&&itemYear&&Math.abs(itemYear-year)>1)continue;for(const candTitle of itemTitleVariants(item)){const score=fuzzyScore(title,candTitle);if(score>bestScore){bestScore=score;best=item}}}}
  return bestScore>=(year?.90:.94)?best:null;
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
