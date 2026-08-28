import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='scripts/refresh-seed-cache.mjs';
const lines=fs.readFileSync(path,'utf8').split('\n');
const index=lines.findIndex(line=>line.includes('const anchorPattern=new RegExp'));
if(index<0)throw new Error('Trakt media-surface regex anchor was not found');
lines[index]=`  const anchorPattern=new RegExp("<a\\\\b[^>]*href=[\\\"'](?:https?:\\\\/\\\\/(?:www\\\\.)?trakt\\\\.tv)?\\\\/"+kind+"\\\\/[^\\\"']+[\\\"'][^>]*>([\\\\s\\\\S]*?)<\\\\/a>",'gi');`;
fs.writeFileSync(path,lines.join('\n'));
execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Fix v0.8.41 Trakt seed regex syntax [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 Trakt seed regex syntax repaired and checked.');
