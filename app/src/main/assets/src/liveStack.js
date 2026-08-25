function qualityScore(item={}){const h=`${item.name||''} ${item.group||''}`.toLowerCase();if(/\b(?:4k|uhd|2160p)\b/.test(h))return 40;if(/\b(?:fhd|1080p|1080i)\b/.test(h))return 30;if(/\b(?:hd|720p)\b/.test(h))return 20;if(/\bsd\b/.test(h))return 5;return 12}

// v0.7.29: Live TV streams are intentionally NOT deduplicated/stacked.
// Every provider stream remains its own browse/search/guide/playback item even when
// channel names, groups or EPG IDs are identical. Movie source stacking is separate.
export function buildLiveStackIndex(catalog=[],providerPriority={}){
  const live=catalog.filter(x=>x?.kind==='live'),bySourceId=new Map(),byStackId=new Map();
  for(const item of live)if(item?.id)bySourceId.set(item.id,item);
  return {stacked:live,bySourceId,byStackId};
}

// Kept for backwards compatibility with an old in-memory stacked item. New v0.7.29
// catalogue/query paths never create these stacks.
export function selectLiveSource(item={},providerPriority={}){
  if(!Array.isArray(item.sources)||!item.sources.length)return item;
  const sources=[...item.sources].sort((a,b)=>{
    const pa=Number(providerPriority[a.providerId]??999),pb=Number(providerPriority[b.providerId]??999);
    const qa=qualityScore(a),qb=qualityScore(b);if(qb!==qa)return qb-qa;return pa-pb;
  });
  const source=sources[0];return {...item,...source,id:source.id||item.id,name:source.name||item.name,sources:undefined,sourceCount:1,_selectedLiveSourceId:source.id,_selectedLiveProviderId:source.providerId};
}
