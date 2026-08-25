import {normalizeMediaTitle} from './mdblist.js';

function yearFrom(value='') {
  const m=String(value||'').match(/(?:19|20)\d{2}/);
  if(!m)return 0;
  const y=Number(m[0]),max=new Date().getFullYear()+3;
  return y>=1888&&y<=max?y:0;
}

export function releaseYear(item={}) {
  const explicit=yearFrom(item.year||item.releaseDate||'');
  if(explicit)return explicit;
  const tail=String(item.name||'').match(/[\[(]\s*((?:19|20)\d{2})\s*[\])]\s*$/);
  return tail?yearFrom(tail[1]):0;
}

function artworkFingerprint(value='') {
  const raw=String(value||'').trim();
  if(!raw)return'';
  try {
    const u=new URL(raw,'https://swoop.invalid');
    return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/+$/,'');
  } catch { return raw.toLowerCase().split('?')[0].replace(/\/+$/,''); }
}

const PREFIX_MAP=new Map([
  ['amz','AMZ'],['amazon','AMZ'],['prime','AMZ'],['prime video','AMZ'],
  ['nf','NF'],['netflix','NF'],['en','EN'],['eng','EN'],['english','EN'],
  ['atv','Apple TV'],['a+','Apple TV'],['apple tv','Apple TV'],['apple tv+','Apple TV'],['appletv+','Apple TV'],['apl','Apple TV'],
  ['dsnp','Disney+'],['d+','Disney+'],['dplus','Disney+'],['disney','Disney+'],['disney+','Disney+'],
  ['hmax','Max'],['max','Max'],['hbo max','Max'],['cr','Crunchyroll'],['crunchyroll','Crunchyroll'],['crunchy roll','Crunchyroll'],['pmtp','Paramount+'],['paramount','Paramount+']
]);

function stripLeadingProviderOrnaments(value='') {
  return String(value||'').trim().replace(/^\s*(?:[-–—|:•·]+\s*)+/, '').trim();
}

const LEADING_QUALITY_PREFIX=/^(?:4320p|2160p|1080p|1080i|720p|576p|576i|480p|480i|8k|4k|uhd|fhd|hd|sd)\s*(?:[-–—|:•·]+\s*)+/i;
const GENERIC_PREFIX=/^(?:top|new|movie|movies|film|films|vod|us|uk|au|ca)$/i;

function stripLeadingTitleDecorators(value='') {
  let raw=stripLeadingProviderOrnaments(value);
  for(let i=0;i<10;i++){
    const before=raw;
    raw=stripLeadingProviderOrnaments(raw);
    const qualityStripped=raw.replace(LEADING_QUALITY_PREFIX,'').trim();
    if(qualityStripped!==raw){raw=qualityStripped;continue}
    const m=raw.match(/^\s*([^|:\-]{1,24})\s*(?:\||:|\s*[-–—]\s*)\s*(.+)$/);
    if(m){
      const key=m[1].trim().toLowerCase();
      if(PREFIX_MAP.has(key)||GENERIC_PREFIX.test(m[1].trim())){raw=m[2].trim();continue}
    }
    if(raw===before)break;
  }
  return raw.trim();
}

export function sourceTag(item={}) {
  let raw=stripLeadingProviderOrnaments(item.name||'');
  for(let i=0;i<4;i++){
    const qualityStripped=raw.replace(LEADING_QUALITY_PREFIX,'').trim();
    if(qualityStripped!==raw){raw=qualityStripped;continue}
    const m=raw.match(/^\s*([^|:\-]{1,24})\s*(?:\||:|\s*[-–—]\s*)\s*(.+)$/);
    if(!m)break;
    const key=m[1].trim().toLowerCase();
    if(PREFIX_MAP.has(key))return PREFIX_MAP.get(key);
    if(GENERIC_PREFIX.test(m[1].trim())){raw=m[2].trim();continue}
    if(/^[A-Z0-9+]{2,8}$/i.test(m[1].trim()))return m[1].trim().toUpperCase();
    break;
  }
  return '';
}

export function qualityLabel(item={}) {
  const hay=`${item.name||''} ${item.group||''}`.toLowerCase();
  if(/\b(?:8k|4320p)\b/.test(hay))return'8K';
  if(/\b(?:4k|uhd|2160p)\b/.test(hay))return'4K';
  if(/\b(?:fhd|1080p|1080i)\b/.test(hay))return'1080p';
  if(/\b(?:hd|720p)\b/.test(hay))return'720p';
  if(/\b(?:sd|576p|576i|480p|480i)\b/.test(hay))return'SD';
  return'';
}

export function hdrLabel(item={}) {
  const hay=`${item.name||''} ${item.group||''}`.toLowerCase();
  if(/\b(?:dolby[ ._-]?vision|dovi|dv)\b/.test(hay))return'Dolby Vision';
  if(/\bhdr10\+\b/.test(hay))return'HDR10+';
  if(/\bhdr10\b/.test(hay))return'HDR10';
  if(/\bhlg\b/.test(hay))return'HLG';
  if(/\bhdr\b/.test(hay))return'HDR';
  return'';
}

export function codecLabel(item={}) {
  const hay=`${item.name||''} ${item.group||''}`.toLowerCase();
  if(/\b(?:av1)\b/.test(hay))return'AV1';
  if(/\b(?:x265|h[ ._-]?265|hevc)\b/.test(hay))return'HEVC';
  if(/\b(?:x264|h[ ._-]?264|avc)\b/.test(hay))return'H.264';
  return'';
}

export function audioLabel(item={}) {
  const hay=`${item.name||''} ${item.group||''}`.toLowerCase();
  if(/\b(?:atmos|truehd[ ._-]?atmos)\b/.test(hay))return'Atmos';
  if(/\b(?:eac3|e-ac-3|dd\+)\b/.test(hay))return'DD+';
  if(/\b(?:ac3|ac-3|dolby digital)\b/.test(hay))return'DD';
  if(/\b(?:dts[- .]?hd|dts hd)\b/.test(hay))return'DTS-HD';
  if(/\bdts\b/.test(hay))return'DTS';
  if(/\baac\b/.test(hay))return'AAC';
  return'';
}

function qualityScore(item={}) {
  const q=qualityLabel(item);
  return q==='8K'?90:q==='4K'?70:q==='1080p'?55:q==='720p'?35:q==='SD'?8:25;
}

function hdrScore(item={}) {
  const h=hdrLabel(item);
  return h==='Dolby Vision'?12:h==='HDR10+'?10:h?7:0;
}

function codecScore(item={}) {
  const c=codecLabel(item);
  // mpv can handle all three well; HEVC gets a tiny efficiency bonus without
  // overpowering resolution/source evidence.
  return c==='HEVC'?4:c==='AV1'?3:c==='H.264'?2:0;
}

function stripProviderTailTags(value='') {
  let raw=String(value||'').trim();
  // IPTV series names commonly arrive as `Title (2023) (US)`. Strip only
  // clearly decorative trailing tags, one at a time, so the real title remains intact.
  for(let i=0;i<6;i++){
    const next=raw.replace(/\s*[\[(]\s*(?:(?:19|20)\d{2}|US|USA|UK|GB|AU|AUS|CA|CAN|NZ|FR|FRA|EN|ENG|ENGLISH)\s*[\])]\s*$/i,'').trim();
    if(next===raw)break;
    raw=next;
  }
  return raw;
}

export function cleanDisplayTitle(item={}) {
  let raw=stripLeadingTitleDecorators(item.name||'');
  raw=raw.replace(/\b(?:4320p|2160p|1080p|1080i|720p|576p|576i|480p|480i|8k|4k|uhd|fhd|hdr10\+?|hdr|hlg|dolby\s*vision|dovi|dv|web[- .]?dl|webrip|bluray|brrip|x26[45]|h26[45]|hevc|av1)\b/gi,' ').replace(/\s+/g,' ').trim();
  // Removing a quality marker can expose a second provider token in unusually
  // decorated series names (for example `4K-MAX - Lanterns`). Run the
  // prefix parser once more before removing year/market suffixes.
  raw=stripLeadingTitleDecorators(raw);
  raw=stripProviderTailTags(raw).replace(/\s+/g,' ').trim();
  return raw||String(item.name||'Untitled');
}

export function sourceScore(item={}) {
  return qualityScore(item)+hdrScore(item)+codecScore(item)+(item.tmdbId?8:0)+(item.imdbId?8:0)+(item.backdrop?5:0)+(item.logo?3:0)+(item.rating?1:0);
}

export function sourceTraits(item={}) {
  return {
    tag:sourceTag(item),
    quality:qualityLabel(item),
    hdr:hdrLabel(item),
    codec:codecLabel(item),
    audio:audioLabel(item),
    score:sourceScore(item)
  };
}

function sourceDescription(item={},index=0) {
  const traits=sourceTraits(item),parts=[];
  if(traits.tag)parts.push(traits.tag);
  if(traits.quality)parts.push(traits.quality);
  if(traits.hdr)parts.push(traits.hdr);
  if(item.group&&!parts.includes(item.group))parts.push(item.group);
  return parts.filter(Boolean).slice(0,3).join(' · ')||`Source ${index+1}`;
}

function stackIdFromKey(key='') { return `stack:movie:${encodeURIComponent(key)}`; }

export function rankSources(sources=[], preferredId='', providerPriority={}) {
  return [...sources].sort((a,b)=>{
    if(preferredId&&a.id===preferredId&&b.id!==preferredId)return-1;
    if(preferredId&&b.id===preferredId&&a.id!==preferredId)return 1;
    const delta=sourceScore(b)-sourceScore(a);
    if(delta)return delta;
    const pa=Number(providerPriority?.[a.providerId]??999),pb=Number(providerPriority?.[b.providerId]??999);
    if(pa!==pb)return pa-pb;
    return String(a.name||'').localeCompare(String(b.name||''));
  });
}

export function buildMovieStackIndex(catalog=[], providerPriority={}) {
  const movies=catalog.filter(x=>x?.kind==='movie');
  const groups=[];
  const keyMaps={imdb:new Map(),tmdb:new Map(),titleYear:new Map(),titleArtwork:new Map()};

  for(const item of movies){
    const title=normalizeMediaTitle(item.name),year=releaseYear(item),imdb=String(item.imdbId||'').trim().toLowerCase(),tmdb=String(item.tmdbId||'').trim();
    const art=artworkFingerprint(item.logo||item.backdrop||'');
    const keys=[];
    if(imdb)keys.push(['imdb',imdb]);
    if(tmdb)keys.push(['tmdb',tmdb]);
    if(title&&year)keys.push(['titleYear',`${title}|${year}`]);
    if(title&&art)keys.push(['titleArtwork',`${title}|${art}`]);
    let group=null;
    for(const [kind,key] of keys){const hit=keyMaps[kind].get(key);if(hit){group=hit;break}}
    if(!group){group={items:[],confidence:'',key:''};groups.push(group)}
    group.items.push(item);
    if(!group.key){
      if(imdb){group.key=`imdb:${imdb}`;group.confidence='IMDb ID'}
      else if(tmdb){group.key=`tmdb:${tmdb}`;group.confidence='TMDb ID'}
      else if(title&&year){group.key=`title-year:${title}|${year}`;group.confidence='title + release year'}
      else if(title&&art){group.key=`title-art:${title}|${art}`;group.confidence='title + identical artwork'}
      else group.key=`single:${item.id}`;
    }
    for(const [kind,key] of keys)if(!keyMaps[kind].has(key))keyMaps[kind].set(key,group);
  }

  const bySourceId=new Map(),byStackId=new Map(),stacked=[];
  for(const group of groups){
    if(group.items.length<2){const item=group.items[0];stacked.push(item);bySourceId.set(item.id,item);continue}
    const ordered=rankSources(group.items,'',providerPriority);
    const sources=ordered.map((x,i)=>{
      const traits=sourceTraits(x);
      return {...x,_sourceLabel:sourceDescription(x,i),_sourceTag:traits.tag,_qualityLabel:traits.quality,_hdrLabel:traits.hdr,_codecLabel:traits.codec,_audioLabel:traits.audio,_sourceScore:traits.score};
    });
    const primary=sources[0],clean=cleanDisplayTitle(primary),year=releaseYear(primary),providerAddedAt=Math.max(0,...sources.map(x=>Number(x.providerAddedAt||0)).filter(Number.isFinite));
    const stack={...primary,id:stackIdFromKey(group.key),name:clean,year:primary.year||String(year||''),providerAddedAt:providerAddedAt||Number(primary.providerAddedAt||0),sources,sourceCount:sources.length,_stacked:true,_stackConfidence:group.confidence,_primarySourceId:primary.id,_recommendedSourceId:primary.id};
    stacked.push(stack);byStackId.set(stack.id,stack);for(const source of sources)bySourceId.set(source.id,stack);
  }
  return {stacked,bySourceId,byStackId};
}

export function collapseMovieSources(list=[],catalog=[]) {
  const index=buildMovieStackIndex(catalog),out=[],seen=new Set();
  for(const item of list){
    const display=item?.kind==='movie'?(index.bySourceId.get(item.id)||item):item;
    const id=display?.id;if(!id||seen.has(id))continue;seen.add(id);out.push(display);
  }
  return out;
}
