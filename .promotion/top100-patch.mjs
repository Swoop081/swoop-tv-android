import {readFileSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';

const appPath='app/src/main/assets/app.js';
const testPath='tests/tv-ui-runtime-smoke.mjs';
const seedScriptPath='scripts/refresh-seed-cache.mjs';
const pendingPath='.promotion/promote-pending.mjs';
const selfPath='.promotion/top100-patch.mjs';

function replaceRequired(source,search,replacement,label){
  const next=source.replace(search,replacement);
  if(next===source)throw new Error(`v0.8.39 Top 100 patch could not patch ${label}`);
  return next;
}

let app=readFileSync(appPath,'utf8');
app=replaceRequired(app,'const TOP100_RANKING_SCHEMA=3;','const TOP100_RANKING_SCHEMA=4;','Top 100 ranking schema');
app=replaceRequired(
  app,
  'const SNOAK_CURATED_ROWS=new Map([\n',
  "const SNOAK_CURATED_ROWS=new Map([\n  ['top20-movies','trending-movies'],\n  ['top20-shows','trending-shows'],\n",
  'Snoak Top 100 curated sources'
);
app=replaceRequired(
  app,
  'function androidFastRowItems(id){\n  const fast=androidFastCatalog(),limit=String(id).startsWith(\'top20-\')?ANDROID_TV_HOME_DATA_RANKED_LIMIT:ANDROID_TV_HOME_DATA_STANDARD_LIMIT;\n  const cached=state.webDiscovery?.[id];',
  'function androidFastRowItems(id){\n  const fast=androidFastCatalog(),limit=String(id).startsWith(\'top20-\')?ANDROID_TV_HOME_DATA_RANKED_LIMIT:ANDROID_TV_HOME_DATA_STANDARD_LIMIT;\n  const cached=state.webDiscovery?.[id];\n  if(String(id).startsWith(\'top20-\')&&(!cached||Number(cached?.rankingSchema||0)<TOP100_RANKING_SCHEMA))return [];',
  'Android fast Top 100 stale-cache guard'
);
app=replaceRequired(
  app,
  'function cachedWebRowItems(id){const cache=state.webDiscovery?.[id];if(androidFastHomeMode()){',
  "function cachedWebRowItems(id){const cache=state.webDiscovery?.[id];if(String(id).startsWith('top20-')&&Number(cache?.rankingSchema||0)<TOP100_RANKING_SCHEMA)return [];if(androidFastHomeMode()){",
  'Top 100 stale-cache guard'
);
app=replaceRequired(
  app,
  "const profile=activeProfile(),finish=list=>{const filtered=dedupeHomeTitles((list||[]).filter(item=>!isDemoItem(item)&&profileAllowsMedia(profile,item,state.metadataCache?.[item.id]||{})));return (id==='top20-movies'||id==='top20-shows')?completeTop100FromLibrary(id,filtered):filtered};",
  "const profile=activeProfile(),finish=list=>{const filtered=dedupeHomeTitles((list||[]).filter(item=>!isDemoItem(item)&&profileAllowsMedia(profile,item,state.metadataCache?.[item.id]||{})));return (id==='top20-movies'||id==='top20-shows')?filtered.slice(0,HOME_RANKED_ROW_LIMIT):filtered};",
  'remove aggregate Top 100 filler'
);
app=replaceRequired(
  app,
  'if(!result.length&&SNOAK_CURATED_ROWS.has(id))result=',
  "if(!result.length&&SNOAK_CURATED_ROWS.has(id)&&!String(id).startsWith('top20-'))result=",
  'disable Top 100 local fallback'
);
app=replaceRequired(
  app,
  "  'Stops STARmeter blank/repaint stalls during held-D-pad traversal by batching deferred row patches, unloading distant artwork and serving TV-sized STARmeter images.',",
  "  'Stops STARmeter blank/repaint stalls during held-D-pad traversal by batching deferred row patches, unloading distant artwork and serving TV-sized STARmeter images.',\n  'Pins Top 100 Movies and Top 100 TV Shows directly to Snoak’s Trakt Trending Movies/Shows lists and removes unrelated provider-library filler.',",
  'Top 100 changelog entry'
);
writeFileSync(appPath,app);

let seedScript=readFileSync(seedScriptPath,'utf8');
seedScript=replaceRequired(seedScript,'top100RankingSchema:3','top100RankingSchema:4','seed Top 100 ranking schema');
writeFileSync(seedScriptPath,seedScript);

let tests=readFileSync(testPath,'utf8');
tests=replaceRequired(tests,"if (!appSource.includes('const TOP100_RANKING_SCHEMA=3;')) throw new Error('Top 100 ranking cache schema missing');","if (!appSource.includes('const TOP100_RANKING_SCHEMA=4;')) throw new Error('Top 100 ranking cache schema missing');",'Top 100 test schema');
tests += `\n// v0.8.39 direct Snoak/Trakt Top 100 sources.\nif (!appSource.includes("['top20-movies','trending-movies']") || !appSource.includes("['top20-shows','trending-shows']")) throw new Error('Top 100 rows are not pinned to Snoak Trakt trending lists');\nif (!appSource.includes("?filtered.slice(0,HOME_RANKED_ROW_LIMIT):filtered")) throw new Error('Top 100 rows still use aggregate provider-library filler');\nif (!appSource.includes("!String(id).startsWith('top20-')")) throw new Error('Top 100 local fallback guard missing');\n`;
writeFileSync(testPath,tests);

if(existsSync(pendingPath)){
  let pending=readFileSync(pendingPath,'utf8');
  const noteNeedle='- Adds sideloaded/provider subtitle handoff for SRT/VTT-style subtitle URLs when Swoop has subtitle metadata for the selected title.\n- Android versionName is **0.8.39** and versionCode is **839**.';
  if(pending.includes(noteNeedle)){
    pending=pending.replace(noteNeedle,'- Adds sideloaded/provider subtitle handoff for SRT/VTT-style subtitle URLs when Swoop has subtitle metadata for the selected title.\n- Replaces the previous aggregated Top 100 logic with Snoak’s **Trakt’s Trending Movies** and **Trakt’s Trending Shows** MDBList feeds as the sole ranking sources, preserving source order and removing unrelated library filler.\n- Android versionName is **0.8.39** and versionCode is **839**.');
  }
  writeFileSync(pendingPath,pending);
}

if(existsSync(selfPath))unlinkSync(selfPath);
console.log('v0.8.39 direct Snoak Top 100 patch applied; pending promotion will commit these changes.');
