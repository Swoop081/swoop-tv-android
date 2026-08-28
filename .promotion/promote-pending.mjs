import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let s=fs.readFileSync(path,'utf8');
const old=`    }catch(workerErr){
      try{
        curated[key]=await fetchTraktMediaSurface(type);
        console.log(\`Seed Snoak \${key}: \${curated[key].items.length} current Trakt media-surface entries.\`);
      }catch(mediaErr){
        try{
          const traktUrl=type==='movie'?'https://trakt.tv/users/snoak/lists/trakt-s-trending-movies':'https://trakt.tv/users/snoak/lists/trakt-s-trending-shows';
          curated[key]=await fetchPublicTraktTrending(traktUrl,type);
          console.log(\`Seed Snoak \${key}: \${curated[key].items.length} direct Snoak Trakt fallback entries.\`);
        }catch(traktErr){
          try{curated[key]=await fetchPublicMdbList(url,type);console.log(\`Seed Snoak \${key}: \${curated[key].items.length} MDBList public fallback entries.\`)}
          catch(publicErr){console.warn(\`Snoak \${key} seed refresh unavailable: \${workerErr.message}; Trakt media: \${mediaErr.message}; Snoak Trakt: \${traktErr.message}; MDBList: \${publicErr.message}\`);if(previous?.curated?.[key]?.items?.length>=100)curated[key]=previous.curated[key]}
        }
      }
    }
`;
const next=`    }catch(workerErr){
      try{
        const traktUrl=type==='movie'?'https://app.trakt.tv/users/snoak/lists/trakt-s-trending-movies':'https://app.trakt.tv/users/snoak/lists/trakt-s-trending-shows';
        curated[key]=await fetchPublicTraktTrending(traktUrl,type);
        console.log(\`Seed Snoak \${key}: \${curated[key].items.length} canonical app.trakt.tv entries.\`);
      }catch(traktErr){
        try{curated[key]=await fetchPublicMdbList(url,type);console.log(\`Seed Snoak \${key}: \${curated[key].items.length} MDBList mirror entries.\`)}
        catch(publicErr){console.warn(\`Snoak \${key} seed refresh unavailable: \${workerErr.message}; app.trakt.tv: \${traktErr.message}; MDBList: \${publicErr.message}\`);if(previous?.curated?.[key]?.items?.length>=100)curated[key]=previous.curated[key]}
      }
    }
`;
if(!s.includes(old))throw new Error('Expected Snoak fallback chain was not found');
s=s.replace(old,next);
fs.writeFileSync(path,s);
execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Use canonical app.trakt.tv Snoak lists for v0.8.41 [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('Canonical Snoak app.trakt.tv list sources promoted.');
