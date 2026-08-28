let seedPromise=null;
let cachedSeed=null;
let titleIndex=null;
let episodeIndex=null;
let peopleIndex=null;

function norm(value=''){
  return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function year(value=''){
  const m=String(value||'').match(/(?:19|20)\d{2}/);return m?m[0]:'';
}
function validSeed(seed){return Boolean(seed&&typeof seed==='object'&&Number(seed.schema||0)>=1)}

export async function loadInstallSeedCache(){
  if(cachedSeed)return cachedSeed;
  if(seedPromise)return seedPromise;
  seedPromise=fetch('./seed-cache.json',{cache:'force-cache'})
    .then(res=>{if(!res.ok)throw new Error(`Install seed HTTP ${res.status}`);return res.json()})
    .then(seed=>{if(!validSeed(seed))throw new Error('Invalid install seed cache');cachedSeed=seed;return seed})
    .catch(()=>null);
  return seedPromise;
}

export function installSeedAgeHours(seed=cachedSeed){
  const built=Date.parse(seed?.builtAt||'');if(!Number.isFinite(built))return Infinity;return Math.max(0,(Date.now()-built)/3600000);
}
export function installSeedFresh(seed=cachedSeed){
  if(!validSeed(seed))return false;const max=Math.max(1,Number(seed.maxAgeHours||168));return installSeedAgeHours(seed)<=max;
}
export function installSeedDiscovery(seed,mediaType='movie'){
  const key=mediaType==='show'||mediaType==='series'||mediaType==='tv'?'tv':'movie';const value=seed?.discovery?.[key];return value&&typeof value==='object'?value:null;
}
export function installSeedCuratedList(seed,listKey=''){
  const value=seed?.curated?.[String(listKey||'')];return value&&typeof value==='object'?value:null;
}

function buildPeopleIndex(seed){
  if(peopleIndex)return peopleIndex;peopleIndex=new Map();
  for(const entry of Array.isArray(seed?.starmeter?.people)?seed.starmeter.people:[]){
    const person=entry?.person&&typeof entry.person==='object'?entry.person:entry;
    const names=[entry?.name,person?.name,...(Array.isArray(entry?.aliases)?entry.aliases:[]),...(Array.isArray(person?.aliases)?person.aliases:[])].filter(Boolean);
    const record={rank:Number(entry?.rank||0),name:String(entry?.name||person?.name||''),person:{id:String(person?.id||entry?.id||''),name:String(person?.name||entry?.name||''),profile:String(person?.profile||entry?.profile||''),knownForDepartment:String(person?.knownForDepartment||entry?.knownForDepartment||'Person'),aliases:[...new Set(names.map(String))]},credits:Array.isArray(entry?.credits)?entry.credits:[],aliases:[...new Set(names.map(String))]};
    for(const name of names){const key=norm(name);if(key)peopleIndex.set(`name:${key}`,record)}
    if(record.person.id)peopleIndex.set(`id:${record.person.id}`,record);
  }
  return peopleIndex;
}
export function installSeedPerson(seed,{id='',name=''}={}){
  const idx=buildPeopleIndex(seed);return (id&&idx.get(`id:${String(id)}`))||idx.get(`name:${norm(name)}`)||null;
}
export function searchInstallSeedPeople(seed,term='',limit=12){
  const q=norm(term);if(q.length<2)return[];const idx=buildPeopleIndex(seed),seen=new Set(),out=[];
  for(const record of idx.values()){
    const key=`${record.rank}|${record.person.id}|${norm(record.person.name)}`;if(seen.has(key))continue;seen.add(key);
    const hay=[record.person.name,...record.aliases].map(norm);if(!hay.some(x=>x.includes(q)))continue;
    out.push({...record.person,rank:record.rank,knownFor:[]});if(out.length>=Math.max(1,Number(limit||12)))break;
  }
  return out.sort((a,b)=>(Number(a.rank||999)-Number(b.rank||999))||String(a.name).localeCompare(String(b.name)));
}

function metadataRecord(raw={}){
  return {title:String(raw.title||raw.name||''),year:String(raw.year||year(raw.release_date||raw.first_air_date||'')),tmdbId:String(raw.tmdbId??raw.tmdb_id??raw.tmdb??''),imdbId:String(raw.imdbId??raw.imdb_id??raw.imdb??''),poster:String(raw.poster||raw.poster_path||''),backdrop:String(raw.backdrop||raw.backdrop_path||''),titleLogo:String(raw.titleLogo||raw.logo||''),plot:String(raw.plot||raw.overview||''),rating:raw.rating??raw.vote_average??'',imdbRating:raw.imdbRating??'',runtime:raw.runtime??'',genre:raw.genre??'',genres:Array.isArray(raw.genres)?raw.genres:[],castList:Array.isArray(raw.castList)?raw.castList:[],director:String(raw.director||''),certification:String(raw.certification||''),recommendations:Array.isArray(raw.recommendations)?raw.recommendations:[],youtube:String(raw.youtube||''),trailerName:String(raw.trailerName||'')};
}
function buildTitleIndex(seed){
  if(titleIndex)return titleIndex;titleIndex=new Map();
  const rows=Array.isArray(seed?.titleMetadata)?seed.titleMetadata:[];
  for(const raw of rows){const media=String(raw.mediaType||raw.media_type||raw.kind||'').toLowerCase(),kind=(media==='tv'||media==='show'||media==='series')?'series':'movie',meta=metadataRecord(raw),title=norm(meta.title),y=year(meta.year);
    if(meta.tmdbId)titleIndex.set(`tmdb:${kind}:${meta.tmdbId}`,meta);
    if(meta.imdbId)titleIndex.set(`imdb:${kind}:${meta.imdbId.toLowerCase()}`,meta);
    if(title)titleIndex.set(`title:${kind}:${title}:${y}`,meta);
    if(title&&!y)titleIndex.set(`title:${kind}:${title}:`,meta);
  }return titleIndex;
}
export function installSeedTitleMetadata(seed,item={}){
  const idx=buildTitleIndex(seed),kind=item.kind==='series'?'series':'movie',tmdb=String(item.tmdbId||''),imdb=String(item.imdbId||'').toLowerCase(),title=norm(item.name||''),y=year(item.year||item.name||'');
  return (tmdb&&idx.get(`tmdb:${kind}:${tmdb}`))||(imdb&&idx.get(`imdb:${kind}:${imdb}`))||(title&&idx.get(`title:${kind}:${title}:${y}`))||(title&&idx.get(`title:${kind}:${title}:`))||null;
}

function buildEpisodeIndex(seed){
  if(episodeIndex)return episodeIndex;episodeIndex=new Map();for(const raw of Array.isArray(seed?.episodeMetadata)?seed.episodeMetadata:[]){const tmdb=String(raw.tmdbId||raw.tmdb_id||''),imdb=String(raw.imdbId||raw.imdb_id||'').toLowerCase(),title=norm(raw.title||''),season=Number(raw.season||0),episode=Number(raw.episode||0);if(!season||!episode)continue;const value={plot:String(raw.plot||raw.overview||''),runtime:raw.runtime||raw.duration||'',airDate:String(raw.airDate||raw.air_date||raw.releaseDate||'')};if(tmdb)episodeIndex.set(`tmdb:${tmdb}:${season}:${episode}`,value);if(imdb)episodeIndex.set(`imdb:${imdb}:${season}:${episode}`,value);if(title)episodeIndex.set(`title:${title}:${season}:${episode}`,value)}return episodeIndex;
}
export function installSeedEpisodeMetadata(seed,item={},season='',episode=''){
  const idx=buildEpisodeIndex(seed),s=Number(season||0),e=Number(episode||0);if(!s||!e)return null;const tmdb=String(item.tmdbId||''),imdb=String(item.imdbId||'').toLowerCase(),title=norm(item.name||'');return (tmdb&&idx.get(`tmdb:${tmdb}:${s}:${e}`))||(imdb&&idx.get(`imdb:${imdb}:${s}:${e}`))||(title&&idx.get(`title:${title}:${s}:${e}`))||null;
}
