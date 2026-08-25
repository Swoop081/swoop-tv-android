function parseXmltvDate(value=''){
  const raw=String(value||'').trim();
  const m=raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4}|Z)?/);
  if(!m)return NaN;
  const [,y,mo,d,h,mi,s='00',tz=''] = m;
  let iso=`${y}-${mo}-${d}T${h}:${mi}:${s}`;
  if(tz==='Z')iso+='Z';
  else if(tz)iso+=`${tz.slice(0,3)}:${tz.slice(3)}`;
  return Date.parse(iso);
}
function text(node,selector){return node.querySelector(selector)?.textContent?.trim()||''}
export function parseXMLTV(xmlText,wantedIds=null){
  if(typeof DOMParser==='undefined')throw new Error('XMLTV parsing requires a browser environment.');
  const doc=new DOMParser().parseFromString(String(xmlText||''),'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('The XMLTV guide could not be parsed.');
  const wanted=wantedIds instanceof Set?wantedIds:null;
  const result={};
  for(const node of doc.querySelectorAll('programme')){
    const channel=node.getAttribute('channel')||'';
    if(wanted&&channel&&!wanted.has(channel))continue;
    const startMs=parseXmltvDate(node.getAttribute('start'));
    const endMs=parseXmltvDate(node.getAttribute('stop'));
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs))continue;
    const item={title:text(node,'title')||'Programme',description:text(node,'desc'),startMs,endMs};
    (result[channel]||(result[channel]=[])).push(item);
  }
  for(const list of Object.values(result))list.sort((a,b)=>a.startMs-b.startMs);
  return result;
}
