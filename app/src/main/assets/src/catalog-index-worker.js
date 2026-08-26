import {buildMovieStackIndex} from './sourceStack.js';
import {matchMDBListToCatalog} from './mdblist.js';

let catalog=[];
let searchRows=[];
let stackedMovies=[];
let enabledProviderIds=new Set();

function enabled(item){
  if(!enabledProviderIds.size)return true;
  return !item?.providerId||enabledProviderIds.has(String(item.providerId));
}
function activeCatalog(){return catalog.filter(enabled)}
function reply(type,requestId,payload={}){self.postMessage({type,requestId,...payload})}

self.onmessage=e=>{
  const msg=e.data||{};
  try{
    if(msg.type==='init-start'){catalog=[];searchRows=[];enabledProviderIds=new Set((msg.enabledProviderIds||[]).map(String));self.__providerPriority=msg.providerPriority||{};return;}
    if(msg.type==='init-chunk'){if(Array.isArray(msg.catalog))catalog.push(...msg.catalog);return;}
    if(msg.type==='init-end'||msg.type==='init'||msg.type==='movie-stack'){
      if(Array.isArray(msg.catalog))catalog=msg.catalog;
      if(Array.isArray(msg.enabledProviderIds))enabledProviderIds=new Set(msg.enabledProviderIds.map(String));
      const active=activeCatalog();
      searchRows=active.map(item=>({item,text:`${item?.name||''} ${item?.group||''} ${item?.year||''}`.toLowerCase()}));
      const index=buildMovieStackIndex(active,msg.providerPriority||self.__providerPriority||{});stackedMovies=index.stacked||[];
      let offset=0;const emit=()=>{const items=stackedMovies.slice(offset,offset+1000);if(items.length){self.postMessage({type:'movie-stack-chunk',items,offset,total:stackedMovies.length});offset+=items.length;setTimeout(emit,0)}else{self.postMessage({type:'movie-stack-end',total:stackedMovies.length});self.postMessage({type:'worker-ready',count:active.length})}};emit();
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
      const active=activeCatalog(),moviePayload=msg.moviePayload||{items:[]},showPayload=msg.showPayload||{items:[]};
      const movies=matchMDBListToCatalog(moviePayload,active,{sourceLimit:800,mediaType:'movie'});
      const shows=matchMDBListToCatalog(showPayload,active,{sourceLimit:800,mediaType:'show'});
      reply('person-match-result',msg.requestId,{movies,shows});return;
    }
  }catch(err){reply('worker-error',msg.requestId,{message:err?.message||String(err)})}
};
