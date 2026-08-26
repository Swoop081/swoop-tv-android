import {nativeInfo, nativeRequest} from './native.js';
function cleanServer(server='') {
  let value = String(server || '').trim().replace(/\/+$/, '');
  value = value.replace(/\/(?:player_api\.php|get\.php)$/i, '');
  if (!/^https?:\/\//i.test(value)) throw new Error('Xtream server URL must start with http:// or https://.');
  return value;
}

function normalizeAssetUrl(asset='', server='') {
  const value = String(asset || '').trim();
  if (!value) return '';
  try { return new URL(value, `${cleanServer(server)}/`).href; }
  catch { return value; }
}

export function buildXtreamApiUrl(server, username, password, action='', params={}) {
  const s = cleanServer(server);
  const qs = new URLSearchParams({username, password});
  if (action) qs.set('action', action);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  }
  return `${s}/player_api.php?${qs.toString()}`;
}

async function parseJsonResponse(res, source='Xtream API') {
  const text = await res.text();
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.parse(text)?.error || ''; } catch {}
    throw new Error(`${source} returned HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
  }
  try { return JSON.parse(text); }
  catch { throw new Error(`${source} did not return valid JSON.`); }
}

async function directJson(config, action='', params={}, timeoutMs=20000) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try {
    const url = buildXtreamApiUrl(config.server, config.username, config.password, action, params);
    const res = await fetch(url, {signal: controller.signal, cache:'no-store'});
    return await parseJsonResponse(res);
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Xtream provider timed out.');
    if (err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(String(err?.message || err))) {
      throw new Error('Browser could not reach the Xtream API. This is usually CORS, mixed-content, or provider network blocking. Configure the Swoop TV Connection Helper for this provider.');
    }
    throw err;
  } finally { clearTimeout(timer); }
}

async function relayJson(config, action='', params={}, timeoutMs=30000) {
  const relayUrl = String(config.relayUrl || '').trim();
  if (!relayUrl) throw new Error('Connection Helper URL is missing.');
  if (!/^https:\/\//i.test(relayUrl) && !/^http:\/\/localhost(?::\d+)?(?:\/|$)/i.test(relayUrl)) {
    throw new Error('Connection Helper URL must use HTTPS.');
  }
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  const headers = {'content-type':'application/json'};
  if (config.relayToken) headers.authorization = `Bearer ${String(config.relayToken)}`;
  try {
    const res = await fetch(relayUrl, {
      method:'POST',
      headers,
      signal:controller.signal,
      cache:'no-store',
      body:JSON.stringify({
        server:cleanServer(config.server),
        username:String(config.username || ''),
        password:String(config.password || ''),
        action:String(action || ''),
        params:params || {}
      })
    });
    return await parseJsonResponse(res, 'Swoop TV Connection Helper');
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Swoop TV Connection Helper timed out.');
    if (err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(String(err?.message || err))) {
      throw new Error('Could not reach the Swoop TV Connection Helper. Check the Worker URL and deployment.');
    }
    throw err;
  } finally { clearTimeout(timer); }
}

export async function fetchXtreamAssetBlob(config, assetUrl, timeoutMs=20000) {
  const relayUrl = String(config?.relayUrl || '').trim();
  const relayToken = String(config?.relayToken || '');
  const url = String(assetUrl || '').trim();
  if (!relayUrl || !relayToken || !url) throw new Error('Connection Helper artwork relay is not configured.');
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try {
    const res = await fetch(relayUrl, {
      method:'POST',
      headers:{'content-type':'application/json','authorization':`Bearer ${relayToken}`},
      signal:controller.signal,
      cache:'force-cache',
      body:JSON.stringify({mode:'asset', url})
    });
    if (!res.ok) {
      let detail='';
      try { detail=(await res.json())?.error || ''; } catch {}
      throw new Error(`Artwork helper returned HTTP ${res.status}${detail?` — ${detail}`:''}`);
    }
    const type=String(res.headers.get('content-type') || '');
    if (!/^image\//i.test(type) && !/application\/octet-stream/i.test(type)) throw new Error('Artwork helper did not return an image.');
    return await res.blob();
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Artwork helper timed out.');
    throw err;
  } finally { clearTimeout(timer); }
}

async function nativeJson(config, action='', params={}) {
  return nativeRequest('/native/xtream', {
    server:cleanServer(config.server),
    username:String(config.username || ''),
    password:String(config.password || ''),
    action:String(action || ''),
    params:params || {}
  }, {timeoutMs:180000});
}

async function getJson(config, action='', params={}) {
  if (nativeInfo()) return nativeJson(config, action, params);
  if (String(config.relayUrl || '').trim()) return relayJson(config, action, params);
  return directJson(config, action, params);
}


function providerTimestamp(value='') {
  const raw=String(value ?? '').trim();
  if(!raw)return 0;
  const numeric=Number(raw);
  if(Number.isFinite(numeric)&&numeric>0){
    const ms=numeric>1e12?numeric:numeric*1000;
    return Number.isFinite(ms)&&ms>0?Math.trunc(ms):0;
  }
  const parsed=Date.parse(raw);
  return Number.isFinite(parsed)&&parsed>0?parsed:0;
}

export async function testXtream(config) {
  const data = await getJson(config);
  if (!data?.user_info) throw new Error('This server did not return an Xtream user profile.');
  return data;
}

export async function importXtream(config, providerId='xtream', onProgress=()=>{}) {
  const server = cleanServer(config.server);
  const {username, password} = config;
  const loadSection = async (section, categoryAction, itemAction) => {
    const [categories, items] = await Promise.all([
      getJson(config, categoryAction).catch(()=>[]),
      getJson(config, itemAction).catch(()=>[])
    ]);
    try { onProgress({section, count:Array.isArray(items)?items.length:0}); } catch {}
    return {categories:Array.isArray(categories)?categories:[], items:Array.isArray(items)?items:[]};
  };
  const [liveData, vodData, seriesData] = await Promise.all([
    loadSection('live','get_live_categories','get_live_streams'),
    loadSection('movie','get_vod_categories','get_vod_streams'),
    loadSection('series','get_series_categories','get_series')
  ]);
  const liveCats=liveData.categories, liveStreams=liveData.items;
  const vodCats=vodData.categories, vodStreams=vodData.items;
  const seriesCats=seriesData.categories, series=seriesData.items;
  const liveCategoryOrder=new Map((liveCats||[]).map((c,i)=>[String(c.category_id),i]));
  const vodCategoryOrder=new Map((vodCats||[]).map((c,i)=>[String(c.category_id),i]));
  const seriesCategoryOrder=new Map((seriesCats||[]).map((c,i)=>[String(c.category_id),i]));
  const liveCategoryName=new Map((liveCats||[]).map(c=>[String(c.category_id),c.category_name||'Uncategorised']));
  const vodCategoryName=new Map((vodCats||[]).map(c=>[String(c.category_id),c.category_name||'Uncategorised']));
  const seriesCategoryName=new Map((seriesCats||[]).map(c=>[String(c.category_id),c.category_name||'Uncategorised']));
  const total=(liveStreams?.length||0)+(vodStreams?.length||0)+(series?.length||0),items=[];
  let prepared=0;
  const reportPrepared=async force=>{
    if(force||prepared%2000===0){try{onProgress({phase:'prepare',loaded:prepared,total});}catch{}await new Promise(r=>setTimeout(r,0));}
  };
  for (const s of liveStreams || []) {
    const categoryId=String(s.category_id??'');
    items.push({
      id:`${providerId}:live:${s.stream_id}`, providerId, source:'xtream', kind:'live', name:s.name || 'Untitled channel',
      group:liveCategoryName.get(categoryId)||'Uncategorised', logo:normalizeAssetUrl(s.stream_icon, server), tvgId:s.epg_channel_id || '',
      streamUrl:`${server}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${s.stream_id}.${s.container_extension || 'ts'}`,
      streamId:s.stream_id, epgChannelId:s.epg_channel_id || '', providerCategoryId:categoryId, providerCategoryOrder:Number(liveCategoryOrder.get(categoryId)??999999)
    });
    prepared++;await reportPrepared(false);
  }
  for (const s of vodStreams || []) {
    const categoryId=String(s.category_id??'');
    items.push({
      id:`${providerId}:movie:${s.stream_id}`, providerId, source:'xtream', kind:'movie', name:s.name || 'Untitled movie',
      group:vodCategoryName.get(categoryId)||'Uncategorised', logo:normalizeAssetUrl(s.stream_icon, server), backdrop:normalizeAssetUrl(Array.isArray(s.backdrop_path)?s.backdrop_path[0]:s.backdrop_path, server), year:s.year || '', rating:s.rating || '', providerAddedAt:providerTimestamp(s.added || s.last_modified || s.created_at || s.timestamp),
      plot:s.plot || s.description || '', genre:s.genre || '', duration:s.duration || '',
      tmdbId:s.tmdb || s.tmdb_id || '', imdbId:s.imdb_id || '',
      streamUrl:`${server}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${s.stream_id}.${s.container_extension || 'mp4'}`,
      streamId:s.stream_id, providerCategoryId:categoryId, providerCategoryOrder:Number(vodCategoryOrder.get(categoryId)??999999)
    });
    prepared++;await reportPrepared(false);
  }
  for (const s of series || []) {
    const categoryId=String(s.category_id??'');
    items.push({
      id:`${providerId}:series:${s.series_id}`, providerId, source:'xtream', kind:'series', name:s.name || 'Untitled series',
      group:seriesCategoryName.get(categoryId)||'Uncategorised', logo:normalizeAssetUrl(s.cover, server), backdrop:normalizeAssetUrl(Array.isArray(s.backdrop_path)?s.backdrop_path[0]:s.backdrop_path, server), year:s.releaseDate || s.year || '', rating:s.rating || '', providerAddedAt:providerTimestamp(s.added || s.last_modified || s.created_at || s.timestamp),
      plot:s.plot || s.description || '', genre:s.genre || '', duration:s.episode_run_time || '',
      tmdbId:s.tmdb || s.tmdb_id || '', imdbId:s.imdb_id || '', streamUrl:'', seriesId:s.series_id,
      providerCategoryId:categoryId, providerCategoryOrder:Number(seriesCategoryOrder.get(categoryId)??999999)
    });
    prepared++;await reportPrepared(false);
  }
  await reportPrepared(true);
  return {items, categories:{live:liveCats, movie:vodCats, series:seriesCats}, counts:{live:liveStreams.length,movie:vodStreams.length,series:series.length}};
}

export async function fetchXtreamSeriesInfo(config, seriesId) {
  return getJson(config, 'get_series_info', {series_id:seriesId});
}


export async function fetchXtreamVodInfo(config, vodId) {
  return getJson(config, 'get_vod_info', {vod_id:vodId});
}

export async function fetchXtreamShortEpg(config, streamId, limit=12) {
  // Xtream-compatible panels conventionally expect `limit` for get_short_epg.
  // Older Swoop TV builds sent `epg_limit`, which some panels silently ignored.
  return getJson(config, 'get_short_epg', {stream_id:streamId, limit});
}

export async function fetchXtreamSimpleEpg(config, streamId) {
  return getJson(config, 'get_simple_data_table', {stream_id:streamId});
}

export async function fetchXtreamLiveCategories(config) {
  const data=await getJson(config,'get_live_categories');
  return Array.isArray(data)?data:[];
}

export async function fetchXtreamVodCategories(config) {
  const data=await getJson(config,'get_vod_categories');
  return Array.isArray(data)?data:[];
}

export async function fetchXtreamSeriesCategories(config) {
  const data=await getJson(config,'get_series_categories');
  return Array.isArray(data)?data:[];
}

export function buildXtreamXmltvUrl(server, username, password) {
  const s=cleanServer(server);
  const qs=new URLSearchParams({username:String(username||''),password:String(password||'')});
  return `${s}/xmltv.php?${qs.toString()}`;
}

async function directTextUrl(url, timeoutMs=90000) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(url,{signal:controller.signal,cache:'no-store'});
    const text=await res.text();
    if(!res.ok)throw new Error(`Xtream XMLTV returned HTTP ${res.status}`);
    return text;
  }catch(err){
    if(err?.name==='AbortError')throw new Error('Xtream XMLTV guide timed out.');
    throw err;
  }finally{clearTimeout(timer)}
}

async function relayXmltv(config, timeoutMs=120000) {
  const relayUrl=String(config.relayUrl||'').trim();
  if(!relayUrl)throw new Error('Connection Helper URL is missing.');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const headers={'content-type':'application/json'};
  if(config.relayToken)headers.authorization=`Bearer ${String(config.relayToken)}`;
  try{
    const res=await fetch(relayUrl,{method:'POST',headers,signal:controller.signal,cache:'no-store',body:JSON.stringify({mode:'xmltv',server:cleanServer(config.server),username:String(config.username||''),password:String(config.password||'')})});
    const text=await res.text();
    if(!res.ok)throw new Error(`Swoop TV Connection Helper XMLTV returned HTTP ${res.status}`);
    return text;
  }catch(err){
    if(err?.name==='AbortError')throw new Error('Swoop TV Connection Helper XMLTV timed out.');
    throw err;
  }finally{clearTimeout(timer)}
}

export async function fetchXtreamXmltvText(config) {
  if(nativeInfo())return nativeRequest('/native/xtream-xmltv',{server:cleanServer(config.server),username:String(config.username||''),password:String(config.password||'')},{expect:'text',timeoutMs:180000});
  if(String(config.relayUrl||'').trim())return relayXmltv(config);
  return directTextUrl(buildXtreamXmltvUrl(config.server,config.username,config.password));
}

export function buildXtreamSeriesStreamUrl(config, episode) {
  const server=cleanServer(config.server);
  const id=episode?.id ?? episode?.stream_id ?? episode?.episode_id;
  if (id === undefined || id === null || id === '') throw new Error('Episode does not contain a stream ID.');
  const ext=String(episode?.container_extension || episode?.info?.container_extension || 'mp4').replace(/^\./,'');
  return `${server}/series/${encodeURIComponent(config.username)}/${encodeURIComponent(config.password)}/${id}.${ext}`;
}
