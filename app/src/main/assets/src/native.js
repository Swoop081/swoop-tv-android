export function nativeInfo() {
  if (typeof window === 'undefined') return null;
  if (window.SwoopAndroid && typeof window.SwoopAndroid.platform === 'function') return {platform:'android',token:'android'};
  const info = window.__SWOOP_NATIVE__;
  return info && info.token ? info : null;
}


export function isNativeWindows() {
  return nativeInfo()?.platform === 'windows';
}

export function isNativeAndroid() {
  return nativeInfo()?.platform === 'android';
}

function parseAndroidResult(raw, fallback={}) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(String(raw)); } catch { return fallback; }
}

function androidBridge() {
  if (!isNativeAndroid() || !window.SwoopAndroid) throw new Error('Swoop TV Android bridge is not available.');
  return window.SwoopAndroid;
}

let androidFetchSeq=0;
const androidFetchPending=new Map();
let androidFetchListenerBound=false;
function bindAndroidFetchListener(){
  if(androidFetchListenerBound||typeof window==='undefined')return;
  androidFetchListenerBound=true;
  window.addEventListener('swoop-native-fetch',event=>{
    const detail=event?.detail||{},id=String(detail.requestId||''),pending=androidFetchPending.get(id);
    if(!pending)return;
    androidFetchPending.delete(id);clearTimeout(pending.timer);
    if(detail.ok===false)pending.reject(new Error(detail.error||'Could not load provider data.'));
    else pending.resolve({length:Math.max(0,Number(detail.length||0))});
  });
}
function nextFrame(){return new Promise(resolve=>{if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>resolve());else setTimeout(resolve,0)})}
async function androidFetchTextAsync(url,timeoutMs=180000){
  const bridge=androidBridge();
  if(typeof bridge.fetchTextAsync!=='function'||typeof bridge.fetchTextChunk!=='function'){
    const text=String(bridge.fetchText(String(url||''))||'');
    if(text.startsWith('__SWOOP_NATIVE_ERROR__'))throw new Error(text.slice('__SWOOP_NATIVE_ERROR__'.length)||'Could not load provider data.');
    return text;
  }
  bindAndroidFetchListener();
  const requestId=`fetch-${Date.now()}-${++androidFetchSeq}`;
  const meta=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{androidFetchPending.delete(requestId);try{bridge.releaseFetchText?.(requestId)}catch{}reject(new Error('Provider request timed out.'))},timeoutMs);
    androidFetchPending.set(requestId,{resolve,reject,timer});
    try{bridge.fetchTextAsync(requestId,String(url||''))}catch(err){clearTimeout(timer);androidFetchPending.delete(requestId);reject(err)}
  });
  const length=Math.max(0,Number(meta?.length||0)),parts=[],chunkSize=256*1024;let offset=0;
  try{
    while(offset<length){
      const chunk=String(bridge.fetchTextChunk(requestId,offset,chunkSize)||'');
      if(chunk.startsWith('__SWOOP_NATIVE_ERROR__'))throw new Error(chunk.slice('__SWOOP_NATIVE_ERROR__'.length)||'Could not load provider data.');
      if(!chunk)throw new Error('Provider response ended unexpectedly.');
      parts.push(chunk);offset+=chunk.length;
      if(offset<length)await nextFrame();
    }
    return parts.join('');
  }finally{try{bridge.releaseFetchText?.(requestId)}catch{}}
}

export async function nativeRequest(path, payload = null, {expect='json', timeoutMs=45000} = {}) {
  const info = nativeInfo();
  if (!info) throw new Error('Swoop TV native bridge is not available.');
  if (isNativeAndroid()) {
    const bridge=androidBridge();
    if(path==='/native/xtream'){
      const p=payload||{},base=String(p.server||'').trim().replace(/\/+$/,'');
      const url=new URL(`${base}/player_api.php`);
      url.searchParams.set('username',String(p.username||''));
      url.searchParams.set('password',String(p.password||''));
      if(p.action)url.searchParams.set('action',String(p.action));
      for(const [key,value] of Object.entries(p.params||{}))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));
      const text=await androidFetchTextAsync(url.toString(),timeoutMs);
      if(expect==='text')return text;
      try{return JSON.parse(text)}catch{throw new Error('Xtream provider did not return valid JSON.')}
    }
    if(path==='/native/xtream-xmltv'){
      const p=payload||{},base=String(p.server||'').trim().replace(/\/+$/,'');
      const url=new URL(`${base}/xmltv.php`);
      url.searchParams.set('username',String(p.username||''));
      url.searchParams.set('password',String(p.password||''));
      const text=await androidFetchTextAsync(url.toString(),timeoutMs);
      return expect==='json'?JSON.parse(text):text;
    }
    throw new Error('This native request is not available on Android TV.');
  }
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: payload === null ? 'GET' : 'POST',
      headers: payload === null ? {'x-swoop-token': info.token} : {'content-type':'application/json','x-swoop-token':info.token},
      body: payload === null ? undefined : JSON.stringify(payload),
      cache:'no-store',
      signal:controller.signal
    });
    if (!res.ok) {
      let detail='';
      try { detail=(await res.json())?.error || ''; } catch {}
      throw new Error(`Windows bridge returned HTTP ${res.status}${detail?` — ${detail}`:''}`);
    }
    if (expect === 'text') return await res.text();
    return await res.json();
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Swoop TV Windows bridge timed out.');
    throw err;
  } finally { clearTimeout(timer); }
}

export async function nativePlay(item, {startSeconds=0}={}) {
  const rawSubs=[...(Array.isArray(item?.subtitles)?item.subtitles:[]),...(item?.subtitleUrl||item?.subtitle_url?[{url:item.subtitleUrl||item.subtitle_url,label:'External subtitles'}]:[])];const subtitles=rawSubs.map(s=>typeof s==='string'?{url:s}:s).filter(s=>s&&String(s.url||s.uri||'').trim()).map(s=>({url:String(s.url||s.uri||'').trim(),label:String(s.label||s.name||''),language:String(s.language||s.lang||''),mimeType:String(s.mimeType||s.mime_type||'')}));const payload={url:item.streamUrl,title:item.name||'Swoop TV',kind:item.kind||'video',startSeconds:Number(startSeconds||0),subtitles};
  if(isNativeAndroid()){
    const result=parseAndroidResult(androidBridge().play(JSON.stringify(payload)),{ok:false});
    if(result?.ok===false)throw new Error(result.error||'Could not start playback.');
    return result;
  }
  return nativeRequest('/native/play', payload, {timeoutMs:15000});
}


export async function nativePreviewLive(item,{left=0,top=0,width=0,height=0}={}) {
  if(!isNativeAndroid())return {ok:false};
  const payload={url:item?.streamUrl||'',title:item?.name||'Swoop TV Live Preview',left:Number(left||0),top:Number(top||0),width:Number(width||0),height:Number(height||0)};
  return parseAndroidResult(androidBridge().previewLive(JSON.stringify(payload)),{ok:false});
}

export async function nativeStopPreview() {
  if(!isNativeAndroid())return {ok:true};
  return parseAndroidResult(androidBridge().stopPreview?.(),{ok:true});
}

export async function nativeStop() {
  if(isNativeAndroid())return parseAndroidResult(androidBridge().stop(),{ok:true});
  return nativeRequest('/native/stop', {}, {timeoutMs:10000});
}


export async function nativeDiagnostics() {
  if(isNativeAndroid())return parseAndroidResult(androidBridge().diagnostics(),{playing:false});
  return nativeRequest('/native/diagnostics', {}, {timeoutMs:10000});
}

export async function nativeSaveDiagnostics(payload={}) {
  if(!isNativeAndroid())return {ok:false,error:'Diagnostic export is only available on Android TV.'};
  const bridge=androidBridge();
  if(typeof bridge.saveDiagnostics!=='function')return {ok:false,error:'This build does not support diagnostic export.'};
  return parseAndroidResult(bridge.saveDiagnostics(JSON.stringify(payload||{})),{ok:false});
}

export async function nativeClearDiagnostics() {
  if(!isNativeAndroid())return {ok:false};
  const bridge=androidBridge();
  if(typeof bridge.clearDiagnostics!=='function')return {ok:false};
  return parseAndroidResult(bridge.clearDiagnostics(),{ok:false});
}


export async function nativeControl(command, value=null) {
  if(isNativeAndroid())return parseAndroidResult(androidBridge().control(JSON.stringify({command,value})),{ok:false});
  return nativeRequest('/native/control', {command,value}, {timeoutMs:10000});
}


export async function nativeFetchText(url) {
  if(isNativeAndroid())return androidFetchTextAsync(String(url||''),180000);
  return nativeRequest('/native/fetch-text', {url}, {expect:'text', timeoutMs:60000});
}

export async function nativeFetchXmltvIndex(url, wantedIds=[], {windowStartMs=Date.now()-2*3600000, windowEndMs=Date.now()+24*3600000, timeoutMs=240000}={}) {
  if(!isNativeAndroid())return null;
  const bridge=androidBridge();
  if(typeof bridge.fetchXmltvIndexAsync!=='function')return null;
  bindAndroidFetchListener();
  const requestId=`epg-${Date.now()}-${++androidFetchSeq}`;
  const meta=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{androidFetchPending.delete(requestId);try{bridge.releaseFetchText?.(requestId)}catch{}reject(new Error('Programme guide request timed out.'))},timeoutMs);
    androidFetchPending.set(requestId,{resolve,reject,timer});
    try{bridge.fetchXmltvIndexAsync(requestId,String(url||''),JSON.stringify(Array.from(new Set((wantedIds||[]).map(x=>String(x||'').trim()).filter(Boolean)))),Math.round(Number(windowStartMs||0)),Math.round(Number(windowEndMs||0)))}catch(err){clearTimeout(timer);androidFetchPending.delete(requestId);reject(err)}
  });
  const length=Math.max(0,Number(meta?.length||0)),parts=[],chunkSize=256*1024;let offset=0;
  try{
    while(offset<length){
      const chunk=String(bridge.fetchTextChunk(requestId,offset,chunkSize)||'');
      if(chunk.startsWith('__SWOOP_NATIVE_ERROR__'))throw new Error(chunk.slice('__SWOOP_NATIVE_ERROR__'.length)||'Could not load programme guide.');
      if(!chunk)throw new Error('Programme guide response ended unexpectedly.');
      parts.push(chunk);offset+=chunk.length;if(offset<length)await nextFrame();
    }
    const text=parts.join('');
    try{return JSON.parse(text||'{}')}catch{throw new Error('Programme guide returned invalid data.')}
  }finally{try{bridge.releaseFetchText?.(requestId)}catch{}}
}


export async function nativeStatus() {
  const info=nativeInfo();
  if(!info) return null;
  if(isNativeAndroid())return {ok:true,platform:'android',version:String(androidBridge().version?.()||'0.8.6')};
  const res=await fetch('/native/status',{cache:'no-store'});
  if(!res.ok)return null;
  return res.json();
}

export async function nativeSwitchLive(item) {
  return nativeControl('load-url', {url:item?.streamUrl||'', title:item?.name||'Swoop TV'});
}
