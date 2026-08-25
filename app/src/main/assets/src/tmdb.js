const DEFAULT_METADATA_SERVICE = 'https://swoop-tv-connection.justinbelot8.workers.dev';


function cleanMetadataTitle(value='') {
  const prefixes=new Set(['amz','amazon','prime','prime video','nf','netflix','en','eng','english','atv','a+','apple tv','apple tv+','appletv+','apl','dsnp','d+','dplus','disney','disney+','hmax','max','hbo max','cr','crunchyroll','crunchy roll','pmtp','paramount','paramount+','top','new','movie','movies','film','films','vod','us','uk','au','ca']);
  const qualityPrefix=/^(?:4320p|2160p|1080p|1080i|720p|576p|576i|480p|480i|8k|4k|uhd|fhd|hd|sd)\s*(?:[-–—|:•·]+\s*)+/i;
  let s=String(value||'').trim();
  for(let i=0;i<10;i++){
    const before=s;
    s=s.replace(/^\s*(?:[-–—|:•·]+\s*)+/, '').trim();
    const qualityStripped=s.replace(qualityPrefix,'').trim();
    if(qualityStripped!==s){s=qualityStripped;continue}
    const m=s.match(/^\s*([^|:\-]{1,24})\s*(?:\||:|\s*[-–—]\s*)\s*(.+)$/);
    if(m&&prefixes.has(m[1].trim().toLowerCase())){s=m[2].trim();continue}
    if(s===before)break;
  }
  s=s.replace(/\b(?:4320p|2160p|1080p|1080i|720p|576p|576i|480p|480i|8k|4k|uhd|fhd|hdr10\+?|hdr|hlg|dolby\s*vision|dovi|dv|web[- .]?dl|webrip|bluray|brrip|x26[45]|h26[45]|hevc|av1)\b/gi,' ').replace(/\s+/g,' ').trim();
  // A global quality cleanup can expose another provider token, so run the
  // same conservative prefix parser again before strict identity matching.
  for(let i=0;i<6;i++){
    const before=s;
    s=s.replace(/^\s*(?:[-–—|:•·]+\s*)+/, '').trim();
    const m=s.match(/^\s*([^|:\-]{1,24})\s*(?:\||:|\s*[-–—]\s*)\s*(.+)$/);
    if(m&&prefixes.has(m[1].trim().toLowerCase())){s=m[2].trim();continue}
    if(s===before)break;
  }
  for(let i=0;i<6;i++){
    const next=s.replace(/\s*[\[(]\s*(?:(?:19|20)\d{2}|US|USA|UK|GB|AU|AUS|CA|CAN|NZ|FR|FRA|EN|ENG|ENGLISH)\s*[\])]\s*$/i,'').trim();
    if(next===s.trim())break;
    s=next;
  }
  return s.replace(/\s+/g,' ').trim() || String(value||'').trim();
}


function identityYear(value='') {
  const m=String(value||'').match(/(?:19|20)\d{2}/);
  return m?m[0]:'';
}

function normalizedIdentityTitle(value='') {
  return cleanMetadataTitle(value).normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

export function metadataIdentityMatches(item={}, resolved={}) {
  if(!resolved||typeof resolved!=='object')return false;
  const requestedYear=identityYear(item.year||item.name||''),resolvedYear=identityYear(resolved.year||'');
  if(requestedYear&&(!resolvedYear||requestedYear!==resolvedYear))return false;
  const requestedTitle=normalizedIdentityTitle(item.name||''),resolvedTitle=normalizedIdentityTitle(resolved.title||'');
  const hasTrustedId=Boolean(item.tmdbId||item.imdbId);
  if(!hasTrustedId&&requestedTitle&&resolvedTitle&&requestedTitle!==resolvedTitle)return false;
  return true;
}

export function metadataServiceUrl(settings={}) {
  return String(settings?.metadataServiceUrl || DEFAULT_METADATA_SERVICE).trim().replace(/\/+$/, '');
}

export async function fetchTitleMetadata({settings={}, item}) {
  if (!item || !['movie','series'].includes(item.kind)) return null;
  const service = metadataServiceUrl(settings);
  if (!service) return null;
  const body = {
    mode:'metadata',
    mediaType:item.kind === 'series' ? 'tv' : 'movie',
    tmdbId:item.tmdbId || '',
    imdbId:item.imdbId || '',
    title:cleanMetadataTitle(item.name || ''),
    year:item.year || identityYear(item.name || '')
  };
  const res = await fetch(service, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store'
  });
  if (!res.ok) {
    let detail='';
    try { detail=(await res.json())?.error || ''; } catch {}
    throw new Error(detail || `Swoop TV artwork service returned HTTP ${res.status}.`);
  }
  const data = await res.json();
  const metadata=data?.metadata || null;
  return metadata&&metadataIdentityMatches(item,metadata)?metadata:null;
}

export async function fetchTitleImdbRating({settings={}, item}) {
  if (!item || !['movie','series'].includes(item.kind)) return null;
  const service = metadataServiceUrl(settings);
  if (!service) return null;
  const body = {
    mode:'imdb-rating',
    mediaType:item.kind === 'series' ? 'tv' : 'movie',
    tmdbId:item.tmdbId || '',
    imdbId:item.imdbId || '',
    title:cleanMetadataTitle(item.name || ''),
    year:item.year || identityYear(item.name || '')
  };
  const res = await fetch(service, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store'
  });
  if (!res.ok) {
    let detail='';
    try { detail=(await res.json())?.error || ''; } catch {}
    throw new Error(detail || `Swoop TV IMDb rating service returned HTTP ${res.status}.`);
  }
  const data=await res.json();
  const rating=data?.rating || null;
  if(rating&&metadataIdentityMatches(item,rating))return rating;
  // Older workers did not return resolved title/year on the lightweight route.
  // Fall back to the full metadata path, which can be identity-checked client-side,
  // rather than ever displaying a rating from an ambiguous title match.
  const metadata=await fetchTitleMetadata({settings,item}).catch(()=>null);
  return metadata?{tmdbId:metadata.tmdbId||'',imdbId:metadata.imdbId||'',imdbRating:metadata.imdbRating||'',title:metadata.title||'',year:metadata.year||''}:null;
}

export async function fetchPersonCredits({settings={}, personId='', name=''}) {
  const service = metadataServiceUrl(settings);
  if (!service) return null;
  const body = {
    mode:'person-credits',
    personId:String(personId||''),
    name:String(name||'').trim()
  };
  const res = await fetch(service, {
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store'
  });
  if (!res.ok) {
    let detail='';
    try { detail=(await res.json())?.error || ''; } catch {}
    if(res.status===401||/connection helper token/i.test(detail))throw new Error('People browsing needs the bundled Swoop TV Worker v0.1.17 to be deployed.');
    throw new Error(detail || `Swoop TV people service returned HTTP ${res.status}.`);
  }
  const data=await res.json();
  return data?.person || null;
}

export async function searchPeople({settings={}, query='', limit=12}) {
  const service=metadataServiceUrl(settings),term=String(query||'').trim();
  if(!service||term.length<2)return[];
  const res=await fetch(service,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({mode:'person-search',query:term,limit:Math.max(1,Math.min(20,Number(limit)||12))}),
    cache:'no-store'
  });
  if(!res.ok){
    let detail='';
    try{detail=(await res.json())?.error||''}catch{}
    if(res.status===401||res.status===400||/xtream username|invalid swoop tv connection helper token/i.test(detail))throw new Error('People search needs the bundled Swoop TV Worker v0.1.17 to be redeployed.');
    throw new Error(detail||`Swoop TV people search returned HTTP ${res.status}.`);
  }
  const data=await res.json();
  return Array.isArray(data?.people)?data.people:[];
}
