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
      const text=String(bridge.fetchText(url.toString())||'');
      if(text.startsWith('__SWOOP_NATIVE_ERROR__'))throw new Error(text.slice('__SWOOP_NATIVE_ERROR__'.length)||'Could not load provider data.');
      if(expect==='text')return text;
      try{return JSON.parse(text)}catch{throw new Error('Xtream provider did not return valid JSON.')}
    }
    if(path==='/native/xtream-xmltv'){
      const p=payload||{},base=String(p.server||'').trim().replace(/\/+$/,'');
      const url=new URL(`${base}/xmltv.php`);
      url.searchParams.set('username',String(p.username||''));
      url.searchParams.set('password',String(p.password||''));
      const text=String(bridge.fetchText(url.toString())||'');
      if(text.startsWith('__SWOOP_NATIVE_ERROR__'))throw new Error(text.slice('__SWOOP_NATIVE_ERROR__'.length)||'Could not load programme guide.');
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
  const payload={url:item.streamUrl,title:item.name||'Swoop TV',kind:item.kind||'video',startSeconds:Number(startSeconds||0)};
  if(isNativeAndroid()){
    const result=parseAndroidResult(androidBridge().play(JSON.stringify(payload)),{ok:false});
    if(result?.ok===false)throw new Error(result.error||'Could not start playback.');
    return result;
  }
  return nativeRequest('/native/play', payload, {timeoutMs:15000});
}


export async function nativeStop() {
  if(isNativeAndroid())return parseAndroidResult(androidBridge().stop(),{ok:true});
  return nativeRequest('/native/stop', {}, {timeoutMs:10000});
}


export async function nativeDiagnostics() {
  if(isNativeAndroid())return parseAndroidResult(androidBridge().diagnostics(),{playing:false});
  return nativeRequest('/native/diagnostics', {}, {timeoutMs:10000});
}


export async function nativeControl(command, value=null) {
  if(isNativeAndroid())return parseAndroidResult(androidBridge().control(JSON.stringify({command,value})),{ok:false});
  return nativeRequest('/native/control', {command,value}, {timeoutMs:10000});
}


export async function nativeFetchText(url) {
  if(isNativeAndroid()){
    const text=String(androidBridge().fetchText(String(url||''))||'');
    if(text.startsWith('__SWOOP_NATIVE_ERROR__'))throw new Error(text.slice('__SWOOP_NATIVE_ERROR__'.length)||'Could not load provider data.');
    return text;
  }
  return nativeRequest('/native/fetch-text', {url}, {expect:'text', timeoutMs:60000});
}


export async function nativeStatus() {
  const info=nativeInfo();
  if(!info) return null;
  if(isNativeAndroid())return {ok:true,platform:'android',version:String(androidBridge().version?.()||'0.8.1')};
  const res=await fetch('/native/status',{cache:'no-store'});
  if(!res.ok)return null;
  return res.json();
}

export async function nativeSwitchLive(item) {
  return nativeControl('load-url', {url:item?.streamUrl||'', title:item?.name||'Swoop TV'});
}
