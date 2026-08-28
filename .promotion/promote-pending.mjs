import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
let s=fs.readFileSync(path,'utf8');
const old="const traktUrl=type==='movie'?'https://media-og.trakt.tv/movies/trending':'https://trakt.tv/shows/trending';";
const next="const traktUrl=type==='movie'?'https://trakt.tv/users/snoak/lists/trakt-s-trending-movies':'https://trakt.tv/users/snoak/lists/trakt-s-trending-shows';";
if(!s.includes(old)) throw new Error('Direct Trakt fallback URL anchor not found');
s=s.replace(old,next);
fs.writeFileSync(path,s);
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Use canonical Snoak Trakt lists for v0.8.41 seed fallback [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 canonical Snoak Trakt fallback promoted.');
