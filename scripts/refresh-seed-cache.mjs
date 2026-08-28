import fs from 'node:fs';
import path from 'node:path';
import {execFileSync as execLocalFileSync} from 'node:child_process';

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

function decodeHtmlText(value=''){
  return String(value).replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
function parsePublicMdbList(html,mediaType='movie'){
  const source=String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' '),out=[],seen=new Set();
  const titlePattern=/>\s*([^<>\r\n]{1,180}?)\s*\(((?:19|20)\d{2})\)\s*</g;let match;
  while((match=titlePattern.exec(source))){
    const title=decodeHtmlText(match[1]).replace(/\s+/g,' ').trim(),year=String(match[2]||'');
    if(!title||title.length>130||title.split(/\s+/).length>20||/[.!?]\s/.test(title))continue;
    const key=`${normalize(title)}|${year}`;if(!normalize(title)||seen.has(key))continue;
    const prefix=source.slice(Math.max(0,match.index-7000),match.index);
    const imdbMatches=[...prefix.matchAll(/href=["'][^"']*imdb\.com\/title\/(tt\d+)/gi)],tmdbMatches=[...prefix.matchAll(/href=["'][^"']*themoviedb\.org\/(?:movie|tv)\/(\d+)/gi)];
    const imdb=imdbMatches.length?imdbMatches[imdbMatches.length-1][1]:'',tmdb=tmdbMatches.length?tmdbMatches[tmdbMatches.length-1][1]:'';
    seen.add(key);out.push({title,year,media_type:mediaType,ids:{...(tmdb?{tmdb}:{}),...(imdb?{imdb}: {})}});if(out.length>=300)break;
  }
  return out;
}
async function fetchPublicMdbList(url,mediaType){
  const items=[],seen=new Set(),pages=[null,1,2,3,4,5,6];
  for(const page of pages){
    if(items.length>=120)break;
    const pageUrl=new URL(url);if(page!==null)pageUrl.searchParams.set('page',String(page));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const res=await fetch(pageUrl,{headers:{'user-agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});
      if(!res.ok)throw new Error(`MDBList page ${page??'base'} HTTP ${res.status}`);
      const html=await res.text(),pageItems=parsePublicMdbList(html,mediaType);let added=0;
      for(const item of pageItems){const key=`${normalize(item.title)}|${item.year}`;if(!normalize(item.title)||seen.has(key))continue;seen.add(key);items.push(item);added++;}
      console.log(`MDBList ${mediaType} page ${page??'base'}: ${pageItems.length} parsed, ${added} new, ${items.length} total.`);
      if(!pageItems.length)break;
    }finally{clearTimeout(timer)}
  }
  if(items.length<100)throw new Error(`MDBList paged parser found only ${items.length} ${mediaType} entries`);
  return {items:items.slice(0,100),source:'Snoak · Trakt Trending via MDBList',sourceUrl:url,sourceUpdatedAt:Date.now()};
}
function parseTraktTrendingSurface(html,mediaType='movie'){
  const out=[],seen=new Set(),kind=mediaType==='tv'?'shows':'movies';
  const source=String(html||'');
  const anchorPattern=new RegExp("<a\\b[^>]*href=[\"'](?:https?:\\/\\/(?:www\\.)?trakt\\.tv)?\\/"+kind+"\\/[^\"']+[\"'][^>]*>([\\s\\S]*?)<\\/a>",'gi');
  let match;
  while((match=anchorPattern.exec(source))){
    const text=decodeHtmlText(String(match[1]||'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
    const m=text.match(/^(.{1,180}?)\s+((?:19|20)\d{2})$/);
    if(!m)continue;
    const title=m[1].trim(),year=m[2],key=`${normalize(title)}|${year}`;
    if(!normalize(title)||seen.has(key))continue;
    seen.add(key);out.push({title,year,media_type:mediaType,ids:{}});
  }
  return out;
}
async function fetchTraktMediaSurface(mediaType){
  const items=[],seen=new Set(),kind=mediaType==='tv'?'shows':'movies';
  for(let page=1;page<=5&&items.length<120;page++){
    const url=`https://media-og.trakt.tv/${kind}/trending${page>1?'?page='+page:''}`;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
    try{
      const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142 Safari/537.36','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});
      if(!res.ok)throw new Error(`Trakt media surface page ${page} HTTP ${res.status}`);
      const rows=parseTraktTrendingSurface(await res.text(),mediaType);
      let added=0;
      for(const row of rows){const key=`${normalize(row.title)}|${row.year}`;if(seen.has(key))continue;seen.add(key);items.push(row);added++;}
      console.log(`Trakt media surface ${kind} page ${page}: ${rows.length} parsed, ${added} new, ${items.length} total.`);
      if(!rows.length||!added)break;
    }finally{clearTimeout(timer)}
  }
  if(items.length<100)throw new Error(`Trakt media surface found only ${items.length} ${mediaType} entries`);
  return {items:items.slice(0,100),source:'Trakt Trending · current public media surface',sourceUrl:`https://media-og.trakt.tv/${kind}/trending`,sourceUpdatedAt:Date.now()};
}
async function fetchTraktWebApiList(mediaType){
  const slug=mediaType==='movie'?'trakt-s-trending-movies':'trakt-s-trending-shows';
  const url=`https://apiz.trakt.tv/users/snoak/lists/${slug}/items?extended=full%2Cimages%2Ccolors&page=1&limit=100`;
  let raw='';
  try{
    raw=execLocalFileSync('curl',['--silent','--show-error','--location','--max-time','25','--connect-timeout','10','--http1.1','--compressed','--user-agent','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142 Safari/537.36','--header','Accept: application/json','--header','Origin: https://app.trakt.tv','--header','Referer: https://app.trakt.tv/', '--write-out','\n__SWOOP_HTTP__:%{http_code}',url],{encoding:'utf8',maxBuffer:30*1024*1024});
  }catch(err){throw new Error(`apiz curl failed: ${String(err?.stderr||err?.message||err).trim()}`)}
  const match=raw.match(/\n__SWOOP_HTTP__:(\d{3})\s*$/),status=match?Number(match[1]):0,body=match?raw.slice(0,match.index):raw;
  console.log(`Trakt apiz anonymous ${mediaType}: HTTP ${status}, ${body.length} bytes.`);
  if(status!==200)throw new Error(`Trakt apiz anonymous HTTP ${status}: ${body.slice(0,240).replace(/\s+/g,' ')}`);
  let rows;try{rows=JSON.parse(body)}catch{throw new Error('Trakt apiz returned non-JSON body')}
  if(!Array.isArray(rows))throw new Error('Trakt apiz response is not an item array');
  const items=[];
  for(const row of rows){const media=row?.movie||row?.show||row?.episode||null,title=String(media?.title||'').trim(),year=compactYear(media?.year),ids=media?.ids||{};if(!title||!year)continue;items.push({title,year,media_type:mediaType,ids:{...(ids.tmdb?{tmdb:String(ids.tmdb)}:{}),...(ids.imdb?{imdb:String(ids.imdb)}:{}),...(ids.trakt?{trakt:String(ids.trakt)}:{})}});if(items.length>=100)break;}
  console.log(`Trakt apiz anonymous parsed ${mediaType}: ${items.length} items.`);
  if(items.length<100)throw new Error(`Trakt apiz returned only ${items.length} usable ${mediaType} items`);
  return {items,source:'Snoak · Trakt Trending',sourceUrl:`https://app.trakt.tv/users/snoak/lists/${slug}`,sourceUpdatedAt:Date.now()};
}
async function fetchPublicTraktTrending(url,mediaType){
  let html='',fetchError='';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
    try{
      const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142 Safari/537.36','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      html=await res.text();
      console.log(`app.trakt.tv Node fetch ${mediaType}: ${html.length} bytes.`);
    }catch(err){
      fetchError=String(err?.cause?.message||err?.message||err);
      console.warn(`app.trakt.tv Node fetch ${mediaType} failed: ${fetchError}; trying curl.`);
      try{
        html=execLocalFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','25','--connect-timeout','10','--http1.1','--compressed','--user-agent','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142 Safari/537.36','--header','Accept: text/html,application/xhtml+xml',url],{encoding:'utf8',maxBuffer:20*1024*1024});
        console.log(`app.trakt.tv curl ${mediaType}: ${html.length} bytes.`);
        const titleMatch=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        console.log(`app.trakt.tv shell title ${mediaType}: ${titleMatch?decodeHtmlText(titleMatch[1]).replace(/\s+/g,' ').trim():'(none)'}`);
        const markerNames=['__NEXT_DATA__','__remixContext','__sveltekit','data-router','api.trakt','graphql','snoak','trakt-s-trending','application/ld+json','vite','webpack'];
        console.log(`app.trakt.tv shell markers ${mediaType}: ${markerNames.filter(x=>html.toLowerCase().includes(x.toLowerCase())).join(',')||'(none)'}`);
        const scripts=[...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]).slice(0,30);
        console.log(`app.trakt.tv script src ${mediaType}: ${JSON.stringify(scripts)}`);
        const jsPaths=[...new Set([...html.matchAll(/\/_app\/immutable\/[^\"'<>\s]+?\.js/g)].map(m=>m[0]))].slice(0,40);
        console.log(`app.trakt.tv immutable js ${mediaType}: ${JSON.stringify(jsPaths)}`);
        const jsSignals=[];
        for(const jsPath of jsPaths.slice(0,20)){
          try{
            const js=execLocalFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','15','--connect-timeout','8','--http1.1','--compressed','https://app.trakt.tv'+jsPath],{encoding:'utf8',maxBuffer:20*1024*1024});
            const lower=js.toLowerCase();
            const needles=['api.trakt.tv','trakt-api-key','client-id','client_id','/users/','/lists/','list_items','list-items','lists/items','trakt-api-version'];
            const hits=[];
            for(const needle of needles){let at=lower.indexOf(needle.toLowerCase());if(at>=0)hits.push(needle+': '+js.slice(Math.max(0,at-350),Math.min(js.length,at+1100)).replace(/\s+/g,' '));}
            if(hits.length)jsSignals.push({path:jsPath,size:js.length,hits});
          }catch{}
        }
        console.log(`app.trakt.tv JS API signals ${mediaType}: ${JSON.stringify(jsSignals).slice(0,24000)}`);
        const hrefs=[...html.matchAll(/(?:href|content)=["'](https?:\/\/[^"']+|\/[^"']+)["']/gi)].map(m=>m[1]).filter((v,i,a)=>a.indexOf(v)===i).slice(0,50);
        console.log(`app.trakt.tv href/content ${mediaType}: ${JSON.stringify(hrefs)}`);
        const snippets=[];
        for(const needle of ['snoak','trakt-s-trending','api.trakt','graphql','__NEXT_DATA__','__remixContext']){const i=html.toLowerCase().indexOf(needle.toLowerCase());if(i>=0)snippets.push(needle+': '+html.slice(Math.max(0,i-350),Math.min(html.length,i+900)).replace(/\s+/g,' '));}
        console.log(`app.trakt.tv structural snippets ${mediaType}: ${JSON.stringify(snippets).slice(0,8000)}`);
      }catch(curlErr){throw new Error(`Node fetch: ${fetchError}; curl: ${String(curlErr?.stderr||curlErr?.message||curlErr).trim()}`)}
    }
    const out=[],seen=new Set();
    const add=(title,year)=>{title=decodeHtmlText(String(title||'')).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();year=compactYear(year);const norm=normalize(title);if(!norm||!year||title.length>160||seen.has(`${norm}|${year}`))return;if(/^(movies?|shows?|trakt|image|available to watch on)$/i.test(title)||/watchers?|plays?|comments?|followers?/i.test(title))return;seen.add(`${norm}|${year}`);out.push({title,year,media_type:mediaType,ids:{}})};
    const text=decodeHtmlText(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,'\n'));
    for(const rawLine of text.split(/\r?\n/)){const line=rawLine.replace(/\s+/g,' ').trim(),m=line.match(/^(.{1,140}?)\s+((?:19|20)\d{2})$/);if(m)add(m[1],m[2]);if(out.length>=100)break;}
    if(out.length<100){
      for(const m of html.matchAll(/"title"\s*:\s*"((?:\\.|[^"\\]){1,200})"[\s\S]{0,900}?"year"\s*:\s*(?:"?((?:19|20)\d{2})"?)/g)){try{add(JSON.parse('"'+m[1]+'"'),m[2])}catch{add(m[1],m[2])}if(out.length>=100)break;}
    }
    console.log(`app.trakt.tv parsed ${mediaType}: ${out.length} unique title/year entries.`);
    if(out.length<100)throw new Error(`Trakt trending parser found only ${out.length} ${mediaType} entries from ${html.length} bytes`);
    return {items:out.slice(0,100),source:'Snoak · Trakt Trending direct fallback',sourceUrl:url,sourceUpdatedAt:Date.now()};
  }finally{clearTimeout(timer)}
}

let curated={};
if(!OFFLINE){
  const jobs=[
    ['trending-movies','movies-trakt','https://mdblist.com/lists/snoak/trending-movies','movie'],
    ['trending-shows','shows-trakt','https://mdblist.com/lists/snoak/trakt-s-trending-shows','tv']
  ];
  for(const [key,workerKey,url,type] of jobs){
    try{
      const payload=await post({mode:'snoak-list',listKey:workerKey},20000),items=Array.isArray(payload?.items)?payload.items:[];
      if(items.length<100)throw new Error(`Worker returned only ${items.length} entries for ${workerKey}`);
      curated[key]={...payload,listKey:key,items:items.slice(0,100)};
      console.log(`Seed Snoak ${key}: ${curated[key].items.length} authenticated source entries.`);
    }catch(workerErr){
      try{
        curated[key]=await fetchTraktWebApiList(type);
        console.log(`Seed Snoak ${key}: ${curated[key].items.length} Trakt web API entries.`);
      }catch(apiErr){
        try{
          const traktUrl=type==='movie'?'https://app.trakt.tv/users/snoak/lists/trakt-s-trending-movies':'https://app.trakt.tv/users/snoak/lists/trakt-s-trending-shows';
          curated[key]=await fetchPublicTraktTrending(traktUrl,type);
          console.log(`Seed Snoak ${key}: ${curated[key].items.length} canonical app.trakt.tv entries.`);
        }catch(traktErr){
          try{curated[key]=await fetchPublicMdbList(url,type);console.log(`Seed Snoak ${key}: ${curated[key].items.length} MDBList mirror entries.`)}
          catch(publicErr){console.warn(`Snoak ${key} seed refresh unavailable: ${workerErr.message}; apiz: ${apiErr.message}; app.trakt.tv: ${traktErr.message}; MDBList: ${publicErr.message}`);if(previous?.curated?.[key]?.items?.length>=100)curated[key]=previous.curated[key]}
        }
      }
    }
  }
}
if(!Object.keys(curated).length&&previous?.curated&&typeof previous.curated==='object')curated=previous.curated;

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
const seed={schema:2,sourceVersion:'0.8.41',builtAt:new Date().toISOString(),maxAgeHours:168,discovery,curated,starmeter:{source:source.source||'IMDb STARmeter / Trending People',sourceUrl:source.sourceUrl||'https://www.imdb.com/chart/starmeter/',capturedAt:source.capturedAt||'',people:enriched},titleMetadata,episodeMetadata,search,static:{titleLookupSchema:4,discoveryMatchSchema:6,top100RankingSchema:5,note:'Provider-neutral warm-start data only. No IPTV credentials, provider catalogue, watch history or live EPG are bundled.'}};
fs.writeFileSync(assetPath,JSON.stringify(seed,null,2)+'\n');fs.writeFileSync(rootPath,JSON.stringify(seed,null,2)+'\n');
console.log(`Wrote install seed cache: ${enriched.length} people, ${enriched.filter(x=>x.person?.id||x.person?.profile).length} identities, ${enriched.filter(x=>x.credits?.length).length} filmographies, ${titleMetadata.length} title metadata records, discovery ${Object.keys(discovery).join(',')||'not available in this environment'}.`);
