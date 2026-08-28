import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let s=fs.readFileSync(path,'utf8');
if(!s.includes("import path from 'node:path';\n"))throw new Error('seed import anchor missing');
s=s.replace("import path from 'node:path';\n","import path from 'node:path';\nimport {execFileSync as execLocalFileSync} from 'node:child_process';\n");
const old=`async function fetchPublicTraktTrending(url,mediaType){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
    const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});
    if(!res.ok)throw new Error(\`Trakt trending HTTP \${res.status}\`);
    const html=await res.text();
    const text=decodeHtmlText(html.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi,' ').replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi,' ').replace(/<[^>]+>/g,'\\n'));
    const out=[],seen=new Set();
    for(const rawLine of text.split(/\\r?\\n/)){
      const line=rawLine.replace(/\\s+/g,' ').trim();
      const m=line.match(/^(.{1,140}?)\\s+((?:19|20)\\d{2})$/);
      if(!m)continue;
      const title=m[1].trim(),year=m[2],norm=normalize(title);
      if(!norm||seen.has(\`\${norm}|\${year}\`))continue;
      if(/^(movies?|shows?|trakt|image|available to watch on)$/i.test(title)||/watchers?|plays?|comments?|followers?/i.test(title))continue;
      seen.add(\`\${norm}|\${year}\`);out.push({title,year,media_type:mediaType,ids:{}});
      if(out.length>=100)break;
    }
    if(out.length<100)throw new Error(\`Trakt trending parser found only \${out.length} \${mediaType} entries\`);
    return {items:out.slice(0,100),source:'Snoak · Trakt Trending direct fallback',sourceUrl:url,sourceUpdatedAt:Date.now()};
  }finally{clearTimeout(timer)}
}`;
const next=`async function fetchPublicTraktTrending(url,mediaType){
  let html='',fetchError='';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
    try{
      const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142 Safari/537.36','accept':'text/html,application/xhtml+xml'},signal:controller.signal,redirect:'follow'});
      if(!res.ok)throw new Error(\`HTTP \${res.status}\`);
      html=await res.text();
      console.log(\`app.trakt.tv Node fetch \${mediaType}: \${html.length} bytes.\`);
    }catch(err){
      fetchError=String(err?.cause?.message||err?.message||err);
      console.warn(\`app.trakt.tv Node fetch \${mediaType} failed: \${fetchError}; trying curl.\`);
      try{
        html=execLocalFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','25','--connect-timeout','10','--http1.1','--compressed','--user-agent','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/142 Safari/537.36','--header','Accept: text/html,application/xhtml+xml',url],{encoding:'utf8',maxBuffer:20*1024*1024});
        console.log(\`app.trakt.tv curl \${mediaType}: \${html.length} bytes.\`);
      }catch(curlErr){throw new Error(\`Node fetch: \${fetchError}; curl: \${String(curlErr?.stderr||curlErr?.message||curlErr).trim()}\`)}
    }
    const out=[],seen=new Set();
    const add=(title,year)=>{title=decodeHtmlText(String(title||'')).replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim();year=compactYear(year);const norm=normalize(title);if(!norm||!year||title.length>160||seen.has(\`\${norm}|\${year}\`))return;if(/^(movies?|shows?|trakt|image|available to watch on)$/i.test(title)||/watchers?|plays?|comments?|followers?/i.test(title))return;seen.add(\`\${norm}|\${year}\`);out.push({title,year,media_type:mediaType,ids:{}})};
    const text=decodeHtmlText(html.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi,' ').replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi,' ').replace(/<[^>]+>/g,'\\n'));
    for(const rawLine of text.split(/\\r?\\n/)){const line=rawLine.replace(/\\s+/g,' ').trim(),m=line.match(/^(.{1,140}?)\\s+((?:19|20)\\d{2})$/);if(m)add(m[1],m[2]);if(out.length>=100)break;}
    if(out.length<100){
      for(const m of html.matchAll(/\"title\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\]){1,200})\"[\\s\\S]{0,900}?\"year\"\\s*:\\s*(?:\"?((?:19|20)\\d{2})\"?)/g)){try{add(JSON.parse('\"'+m[1]+'\"'),m[2])}catch{add(m[1],m[2])}if(out.length>=100)break;}
    }
    console.log(\`app.trakt.tv parsed \${mediaType}: \${out.length} unique title/year entries.\`);
    if(out.length<100)throw new Error(\`Trakt trending parser found only \${out.length} \${mediaType} entries from \${html.length} bytes\`);
    return {items:out.slice(0,100),source:'Snoak · Trakt Trending direct fallback',sourceUrl:url,sourceUpdatedAt:Date.now()};
  }finally{clearTimeout(timer)}
}`;
if(!s.includes(old))throw new Error('Trakt fetch function anchor missing');
s=s.replace(old,next);
fs.writeFileSync(path,s);
execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Add curl fallback for canonical Snoak Trakt lists [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Canonical app.trakt.tv curl fallback promoted.');
