import {nativeInfo, nativeFetchText} from './native.js';
const BASE = 'https://api.mdblist.com';

function authUrl(path, apiKey, params={}) {
  const url = new URL(BASE + path);
  if (apiKey) url.searchParams.set('apikey', apiKey);
  Object.entries(params).forEach(([k,v])=>{ if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });
  return url.toString();
}

async function fetchJson(path, apiKey, params={}) {
  const url=authUrl(path, apiKey, params);
  if (nativeInfo()) {
    const text=await nativeFetchText(url);
    try { return JSON.parse(text); } catch { throw new Error('MDBList did not return valid JSON.'); }
  }
  const res = await fetch(url, {cache:'no-store'});
  if (!res.ok) throw new Error(`MDBList request failed (${res.status}).`);
  return res.json();
}

export async function getMDBListItems({apiKey, listId, username, listName, mediaType=''}) {
  let path;
  if (listId) path = `/lists/${encodeURIComponent(listId)}/items${mediaType ? `/${mediaType}` : ''}`;
  else if (username && listName) path = `/lists/${encodeURIComponent(username)}/${encodeURIComponent(listName)}/items${mediaType ? `/${mediaType}` : ''}`;
  else throw new Error('Enter an MDBList list ID or username + list name.');
  return fetchJson(path, apiKey, {extended:'ids_only'});
}

export async function getMDBListOfficialItems({apiKey, slug}) {
  if (!slug) throw new Error('MDBList official list slug is missing.');
  return fetchJson(`/lists/official/${String(slug).split('/').map(encodeURIComponent).join('/')}/items`, apiKey);
}

export async function getMDBListStreamingChart({apiKey, mediaType}) {
  const type = mediaType === 'series' || mediaType === 'show' || mediaType === 'shows' ? 'show' : 'movie';
  return fetchJson(`/justwatch/streaming-charts/${type}`, apiKey);
}

export async function getMDBListOfficialLists({apiKey}) {
  return fetchJson('/lists/official', apiKey, {append_to_response:'poster'});
}

function basicNormalize(s='') {
  return String(s).toLowerCase().normalize('NFKD').replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
}

const IPTV_PREFIXES = new Set([
  'top','new','new release','new releases','movie','movies','film','films','vod','cinema','premiere','premieres',
  'en','eng','english','us','usa','uk','au','ca','amz','amazon','prime','prime video','nf','netflix','atv','apple tv','apl','dsnp','disney','hmax','max','hbo max','paramount','pmtp','4k','uhd','fhd','hd','sd','hdr','dolby vision','dv','multi','latino'
]);

export function normalizeMediaTitle(value='') {
  let raw=String(value||'').normalize('NFKD').replace(/[’‘]/g,"'").trim();
  raw=raw.replace(/^\s*[\[(][^\])]{1,18}[\])]\s*/g,'');
  for(let i=0;i<4;i++){
    const m=raw.match(/^\s*([^|:\-]{1,24})\s*(?:\||:|\s-\s)\s*(.+)$/);
    if(!m)break;
    const prefix=basicNormalize(m[1]);
    if(!IPTV_PREFIXES.has(prefix))break;
    raw=m[2];
  }
  raw=raw
    .replace(/\b(?:2160p|1080p|720p|576p|480p|4k|uhd|fhd|hdr10\+?|hdr|dolby\s*vision|dv|web[- .]?dl|webrip|bluray|brrip|x26[45]|h26[45]|hevc|aac|eac3|ddp?5?1?)\b/gi,' ')
    .replace(/\s*[\[(](?:19|20)\d{2}[\])]\s*$/,' ')
    .replace(/\s+-\s+(?:19|20)\d{2}\s*$/,' ');
  return basicNormalize(raw);
}

function mediaYear(value='', explicit='') {
  const fromExplicit=String(explicit||'').match(/(?:19|20)\d{2}/);
  if(fromExplicit)return Number(fromExplicit[0]);
  const m=String(value||'').match(/(?:19|20)\d{2}/g);
  return m?.length?Number(m[m.length-1]):0;
}

function unwrapEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  return entry.movie || entry.show || entry.media || entry.item || entry;
}

function extractSource(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['items','movies','shows','results','data','list','entries']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  if (payload.data && typeof payload.data === 'object') {
    for (const key of ['items','movies','shows','results']) if (Array.isArray(payload.data[key])) return payload.data[key];
  }
  return [];
}

function tokenScore(a,b){
  const A=new Set(String(a).split(' ').filter(Boolean)),B=new Set(String(b).split(' ').filter(Boolean));
  if(!A.size||!B.size)return 0;
  let same=0;for(const t of A)if(B.has(t))same++;
  return same/Math.max(A.size,B.size);
}
function bigrams(s){const x=` ${s} `,out=[];for(let i=0;i<x.length-1;i++)out.push(x.slice(i,i+2));return out}
function diceScore(a,b){if(a===b)return 1;const A=bigrams(a),B=bigrams(b);if(!A.length||!B.length)return 0;const counts=new Map();A.forEach(x=>counts.set(x,(counts.get(x)||0)+1));let hit=0;for(const x of B){const n=counts.get(x)||0;if(n){hit++;counts.set(x,n-1)}}return 2*hit/(A.length+B.length)}
function fuzzyScore(a,b){if(!a||!b)return 0;if(a===b)return 1;if(Math.min(a.length,b.length)>=5&&(a.includes(b)||b.includes(a)))return .94;return Math.max(tokenScore(a,b),diceScore(a,b));}

export function matchMDBListToCatalog(listPayload, catalog=[], {limit=0, sourceLimit=0, mediaType=''}={}) {
  const extracted = extractSource(listPayload).map(unwrapEntry);
  const source = sourceLimit ? extracted.slice(0, sourceLimit) : extracted;
  const wantedKind = mediaType==='movie'?'movie':(['series','show','shows','tv'].includes(mediaType)?'series':'');
  const candidates=catalog.filter(x=>(x.kind==='movie'||x.kind==='series')&&(!wantedKind||x.kind===wantedKind));
  const byTmdb = new Map(),byImdb = new Map(),byTitle = new Map();
  const normalizedCandidates=[];
  for (const item of candidates) {
    const title=normalizeMediaTitle(item.name),year=mediaYear(item.name,item.year);
    if (item.tmdbId) byTmdb.set(String(item.tmdbId), {item,year});
    if (item.imdbId) byImdb.set(String(item.imdbId).toLowerCase(), {item,year});
    if(title){
      if(year&&!byTitle.has(`${title}|${year}`))byTitle.set(`${title}|${year}`,item);
      if(!byTitle.has(title))byTitle.set(title,item);
      normalizedCandidates.push({item,title,year});
    }
  }
  const out=[];
  for (const raw of source) {
    const m = unwrapEntry(raw) || {};
    const ids = m.ids || raw?.ids || {};
    const tmdb = m.tmdb ?? m.tmdb_id ?? ids.tmdb ?? raw?.tmdb ?? raw?.tmdb_id ?? (typeof raw?.id==='number'?raw.id:'');
    const imdb = m.imdb ?? m.imdb_id ?? ids.imdb ?? raw?.imdb ?? raw?.imdb_id;
    const titleRaw = m.title || m.name || raw?.title || raw?.name || '';
    const title=normalizeMediaTitle(titleRaw),year=mediaYear(titleRaw,m.year||m.release_year||raw?.year||raw?.release_year||'');
    let hit=null;
    const tmdbHit=tmdb?byTmdb.get(String(tmdb)):null,imdbHit=imdb?byImdb.get(String(imdb).toLowerCase()):null;
    if(tmdbHit&&(!year||!tmdbHit.year||tmdbHit.year===year))hit=tmdbHit.item;
    if(!hit&&imdbHit&&(!year||!imdbHit.year||imdbHit.year===year))hit=imdbHit.item;
    if(!hit&&title)hit=year?byTitle.get(`${title}|${year}`):byTitle.get(title);
    if(!hit&&title){
      let best=null,bestScore=0;
      for(const c of normalizedCandidates){
        if(year&&c.year&&Math.abs(c.year-year)>1)continue;
        const score=fuzzyScore(title,c.title);
        if(score>bestScore){bestScore=score;best=c.item}
      }
      if(bestScore>=(year ? .90 : .94))hit=best;
    }
    if (hit && !out.some(x=>x.id===hit.id)) out.push(hit);
    if (limit && out.length>=limit) break;
  }
  return out;
}

export function mdblistPayloadCount(payload) {
  return extractSource(payload).length;
}
