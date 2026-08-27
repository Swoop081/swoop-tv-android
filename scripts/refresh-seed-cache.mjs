import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const service=String(process.env.SWOOP_METADATA_SERVICE||'https://swoop-tv-connection.justinbelot8.workers.dev').replace(/\/+$/,'');
const sourcePath=path.join(root,'swoop-tv-starmeter.json');
const assetPath=path.join(root,'app/src/main/assets/seed-cache.json');
const rootPath=path.join(root,'swoop-tv-seed-cache.json');
const OFFLINE=String(process.env.SWOOP_SEED_OFFLINE||'').toLowerCase()==='1';
const CREDIT_PERSON_LIMIT=Math.max(0,Math.min(100,Number(process.env.SWOOP_SEED_CREDIT_PEOPLE||100)));
const IDENTITY_CONCURRENCY=Math.max(1,Math.min(10,Number(process.env.SWOOP_SEED_IDENTITY_CONCURRENCY||6)));
const CREDIT_CONCURRENCY=Math.max(1,Math.min(6,Number(process.env.SWOOP_SEED_CREDIT_CONCURRENCY||3)));
const TITLE_METADATA_PER_KIND=Math.max(0,Math.min(150,Number(process.env.SWOOP_SEED_TITLE_METADATA||60)));
const TITLE_METADATA_CONCURRENCY=Math.max(1,Math.min(8,Number(process.env.SWOOP_SEED_TITLE_CONCURRENCY||5)));
const MAX_CREDITS_PER_PERSON=Math.max(20,Math.min(300,Number(process.env.SWOOP_SEED_MAX_CREDITS||160)));

const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const people=(Array.isArray(source.people)?source.people:[]).slice(0,100).map((p,i)=>({rank:Number(p.rank||i+1),name:String(p.name||'').trim()})).filter(x=>x.name);
const normalize=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const compactYear=v=>{const m=String(v||'').match(/(?:19|20)\d{2}/);return m?m[0]:''};
let previous=null;try{previous=JSON.parse(fs.readFileSync(assetPath,'utf8'))}catch{}

async function post(body,timeoutMs=12000){
  if(OFFLINE)throw new Error('offline seed generation');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const res=await fetch(service,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});if(!res.ok)throw new Error(`HTTP ${res.status}`);return await res.json()}finally{clearTimeout(timer)}
}
async function mapLimit(list,limit,fn){let cursor=0;const out=new Array(list.length);async function worker(){while(true){const i=cursor++;if(i>=list.length)return;try{out[i]=await fn(list[i],i)}catch{out[i]=null}}}await Promise.all(Array.from({length:Math.min(limit,list.length||1)},worker));return out}
function compactPerson(raw={},fallback={}){return {id:String(raw.id||fallback.id||''),name:String(raw.name||fallback.name||''),profile:String(raw.profile||raw.profile_path||fallback.profile||''),knownForDepartment:String(raw.knownForDepartment||raw.known_for_department||fallback.knownForDepartment||'Person'),aliases:[...new Set([raw.name,fallback.name,...(Array.isArray(raw.also_known_as)?raw.also_known_as:[])].filter(Boolean).map(String))]}}
function compactCredit(raw={}){const ids=raw.ids&&typeof raw.ids==='object'?raw.ids:{};const media=String(raw.media_type||raw.mediaType||'');return {media_type:media,id:raw.id??'',title:String(raw.title||''),name:String(raw.name||''),original_title:String(raw.original_title||raw.originalTitle||''),original_name:String(raw.original_name||raw.originalName||''),year:String(raw.year||compactYear(raw.release_date||raw.first_air_date||'')),release_date:String(raw.release_date||''),first_air_date:String(raw.first_air_date||''),tmdb_id:raw.tmdb_id??raw.tmdb??ids.tmdb??'',imdb_id:String(raw.imdb_id??raw.imdb??ids.imdb??''),popularity:Number(raw.popularity||0)||0,vote_count:Number(raw.vote_count||0)||0}}
function compactMetadata(raw={},mediaType='movie'){return {mediaType:mediaType==='tv'?'tv':'movie',title:String(raw.title||raw.name||''),year:String(raw.year||compactYear(raw.release_date||raw.first_air_date||'')),tmdbId:String(raw.tmdbId??raw.tmdb_id??raw.tmdb??''),imdbId:String(raw.imdbId??raw.imdb_id??raw.imdb??''),poster:String(raw.poster||raw.poster_path||''),backdrop:String(raw.backdrop||raw.backdrop_path||''),titleLogo:String(raw.titleLogo||raw.logo||''),plot:String(raw.plot||raw.overview||''),rating:raw.rating??raw.vote_average??'',imdbRating:raw.imdbRating??'',runtime:raw.runtime??'',genre:raw.genre??'',genres:Array.isArray(raw.genres)?raw.genres:[],castList:Array.isArray(raw.castList)?raw.castList:[],director:String(raw.director||''),certification:String(raw.certification||''),youtube:String(raw.youtube||''),trailerName:String(raw.trailerName||'')}}

let discovery={};
if(!OFFLINE){try{const [movie,tv]=await Promise.all([post({mode:'discovery',mediaType:'movie'},18000),post({mode:'discovery',mediaType:'tv'},18000)]);if(movie&&typeof movie==='object')discovery.movie=movie;if(tv&&typeof tv==='object')discovery.tv=tv;console.log('Seed discovery bundle refreshed.')}catch(err){console.warn(`Discovery seed refresh unavailable: ${err.message}`)}}
if(!Object.keys(discovery).length&&previous?.discovery&&typeof previous.discovery==='object')discovery=previous.discovery;

const priorPeople=new Map((previous?.starmeter?.people||[]).map(p=>[normalize(p.name||p.person?.name),p]));
const enriched=await mapLimit(people,IDENTITY_CONCURRENCY,async entry=>{
  const prior=priorPeople.get(normalize(entry.name));let person=compactPerson(prior?.person||{}, {name:entry.name});
  if(!OFFLINE){try{const found=await post({mode:'person-search',query:entry.name,limit:3},9000),list=Array.isArray(found?.people)?found.people:[],exact=list.find(p=>normalize(p.name)===normalize(entry.name))||list[0];if(exact)person=compactPerson(exact,person)}catch{}}
  return {...entry,person,aliases:[...new Set([entry.name,...(person.aliases||[])])],...(Array.isArray(prior?.credits)&&prior.credits.length?{credits:prior.credits}: {})};
});

if(!OFFLINE&&CREDIT_PERSON_LIMIT){
  const targets=enriched.slice(0,CREDIT_PERSON_LIMIT);
  await mapLimit(targets,CREDIT_CONCURRENCY,async (entry,i)=>{try{const payload=await post({mode:'person-credits',personId:entry.person.id||'',name:entry.person.name},13000),remote=payload?.person;if(remote){entry.person=compactPerson(remote,entry.person);const credits=(Array.isArray(remote.credits)?remote.credits:[]).filter(x=>['movie','tv'].includes(String(x?.media_type||''))).slice(0,MAX_CREDITS_PER_PERSON).map(compactCredit);if(credits.length)entry.credits=credits}}catch{}if((i+1)%6===0)console.log(`Seeded filmography ${i+1}/${targets.length}`)});
}

function walkCandidates(value,mediaType,out,seen,depth=0){
  if(depth>5||value==null)return;if(Array.isArray(value)){for(const x of value)walkCandidates(x,mediaType,out,seen,depth+1);return}if(typeof value!=='object')return;
  const ids=value.ids&&typeof value.ids==='object'?value.ids:{},title=String(value.title||value.name||'').trim(),tmdb=String(value.tmdbId??value.tmdb_id??value.tmdb??ids.tmdb??''),imdb=String(value.imdbId??value.imdb_id??value.imdb??ids.imdb??''),y=String(value.year||compactYear(value.release_date||value.first_air_date||''));
  if(title&&(tmdb||imdb||y)){const key=`${mediaType}|${tmdb}|${imdb}|${normalize(title)}|${y}`;if(!seen.has(key)){seen.add(key);out.push({mediaType,title,year:y,tmdbId:tmdb,imdbId:imdb})}}
  for(const [k,v] of Object.entries(value)){if(['metadata','config','request'].includes(k))continue;walkCandidates(v,mediaType,out,seen,depth+1)}
}
function discoveryCandidates(){const out=[],seen=new Set();if(discovery.movie)walkCandidates(discovery.movie,'movie',out,seen);if(discovery.tv)walkCandidates(discovery.tv,'tv',out,seen);const movies=out.filter(x=>x.mediaType==='movie').slice(0,TITLE_METADATA_PER_KIND),tv=out.filter(x=>x.mediaType==='tv').slice(0,TITLE_METADATA_PER_KIND);return [...movies,...tv]}

let titleMetadata=Array.isArray(previous?.titleMetadata)?previous.titleMetadata:[];
const candidates=discoveryCandidates();
if(!OFFLINE&&candidates.length){
  const rows=await mapLimit(candidates,TITLE_METADATA_CONCURRENCY,async candidate=>{try{const payload=await post({mode:'metadata',mediaType:candidate.mediaType,tmdbId:candidate.tmdbId||'',imdbId:candidate.imdbId||'',title:candidate.title,year:candidate.year||''},11000),meta=payload?.metadata;if(meta)return compactMetadata(meta,candidate.mediaType)}catch{}return null});
  const fresh=rows.filter(Boolean),byKey=new Map();for(const row of [...fresh,...titleMetadata]){const key=`${row.mediaType}|${row.tmdbId||''}|${row.imdbId||''}|${normalize(row.title)}|${row.year||''}`;if(!byKey.has(key))byKey.set(key,row)}titleMetadata=[...byKey.values()].slice(0,TITLE_METADATA_PER_KIND*2);console.log(`Seeded ${fresh.length} popular title metadata records.`);
}

const episodeMetadata=Array.isArray(previous?.episodeMetadata)?previous.episodeMetadata:[];
const search={people:enriched.map(x=>({rank:x.rank,id:x.person.id,name:x.person.name,aliases:x.aliases||[],profile:x.person.profile})),titles:titleMetadata.map(x=>({mediaType:x.mediaType,title:x.title,year:x.year,tmdbId:x.tmdbId,imdbId:x.imdbId}))};
const seed={schema:2,sourceVersion:'0.8.36',builtAt:new Date().toISOString(),maxAgeHours:168,discovery,starmeter:{source:source.source||'IMDb STARmeter / Trending People',sourceUrl:source.sourceUrl||'https://www.imdb.com/chart/starmeter/',capturedAt:source.capturedAt||'',people:enriched},titleMetadata,episodeMetadata,search,static:{titleLookupSchema:4,discoveryMatchSchema:6,top100RankingSchema:3,note:'Provider-neutral warm-start data only. No IPTV credentials, provider catalogue, watch history or live EPG are bundled.'}};
fs.writeFileSync(assetPath,JSON.stringify(seed,null,2)+'\n');fs.writeFileSync(rootPath,JSON.stringify(seed,null,2)+'\n');
console.log(`Wrote install seed cache: ${enriched.length} people, ${enriched.filter(x=>x.person?.id||x.person?.profile).length} identities, ${enriched.filter(x=>x.credits?.length).length} filmographies, ${titleMetadata.length} title metadata records, discovery ${Object.keys(discovery).join(',')||'not available in this environment'}.`);
