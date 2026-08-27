import fs from 'node:fs';
import {execSync} from 'node:child_process';

const finalRefresh='REFRESH_V0835_FINAL.mjs';
if(!fs.existsSync(finalRefresh))throw new Error('v0.8.35 final refresh payload missing');
fs.writeFileSync('scripts/refresh-seed-cache.mjs',fs.readFileSync(finalRefresh,'utf8'));
execSync('python PROMOTE_V0835.py',{stdio:'inherit'});
fs.rmSync(finalRefresh,{force:true});
execSync('node scripts/generate-build-metadata.mjs',{stdio:'inherit'});
execSync('node tests/card-runtime-smoke.mjs',{stdio:'inherit'});
execSync('node tests/tv-ui-runtime-smoke.mjs',{stdio:'inherit'});
execSync("find app/src/main/assets -name '*.js' -print0 | xargs -0 -n1 node --check",{stdio:'inherit',shell:'/bin/bash'});
execSync('git config user.name "github-actions[bot]"');
execSync('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
execSync('git add -A');
execSync('git commit -m "Promote v0.8.35 STARmeter stable-row rendering hotfix"',{stdio:'inherit'});
execSync('git push origin HEAD:main',{stdio:'inherit'});
console.log('v0.8.35 source promoted; refreshing packaged warm-start seed.');
await import(`./refresh-seed-cache.mjs?promoted=${Date.now()}`);
