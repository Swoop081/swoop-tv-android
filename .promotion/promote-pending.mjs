import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function replaceOnce(text,from,to,label){
  if(!text.includes(from)) throw new Error(`Missing promotion anchor: ${label}`);
  return text.replace(from,to);
}
function edit(path,fn){const before=read(path),after=fn(before);if(after===before)throw new Error(`No changes produced for ${path}`);write(path,after);}

edit('app/build.gradle',s=>s.replace('versionCode 840','versionCode 841').replace("versionName '0.8.40'","versionName '0.8.41'"));

edit('app/src/main/assets/src/seedCache.js',s=>{
  s=replaceOnce(
    s,
    "export function installSeedDiscovery(seed,mediaType='movie'){\n  const key=mediaType==='show'||mediaType==='series'||mediaType==='tv'?'tv':'movie';const value=seed?.discovery?.[key];return value&&typeof value==='object'?value:null;\n}\n",
    "export function installSeedDiscovery(seed,mediaType='movie'){\n  const key=mediaType==='show'||mediaType==='series'||mediaType==='tv'?'tv':'movie';const value=seed?.discovery?.[key];return value&&typeof value==='object'?value:null;\n}\nexport function installSeedCuratedList(seed,listKey=''){\n  const value=seed?.curated?.[String(listKey||'')];return value&&typeof value==='object'?value:null;\n}\n",
    'seed curated-list accessor'
  );
  return s;
});

edit('scripts/refresh-seed-cache.mjs',s=>{
  s=s.replaceAll("sourceVersion:'0.8.40'","sourceVersion:'0.8.41'");
  s=replaceOnce(
    s,
    "if(!Object.keys(discovery).length&&previous?.discovery&&typeof previous.discovery==='object')discovery=previous.discovery;\n\nconst priorPeople=",
    "if(!Object.keys(discovery).length&&previous?.discovery&&typeof previous.discovery==='object')discovery=previous.discovery;\n\nlet curated={};\nif(!OFFLINE){try{const [movies,shows]=await Promise.all([post({mode:'snoak-list',listKey:'trending-movies'},18000),post({mode:'snoak-list',listKey:'trending-shows'},18000)]);if(movies&&typeof movies==='object')curated['trending-movies']=movies;if(shows&&typeof shows==='object')curated['trending-shows']=shows;console.log('Seed Snoak Top 100 source lists refreshed.')}catch(err){console.warn(`Snoak Top 100 seed refresh unavailable: ${err.message}`)}}\nif(!Object.keys(curated).length&&previous?.curated&&typeof previous.curated==='object')curated=previous.curated;\n\nconst priorPeople=",
    'seed Snoak lists'
  );
  s=replaceOnce(
    s,
    "const seed={schema:2,sourceVersion:'0.8.41',builtAt:new Date().toISOString(),maxAgeHours:168,discovery,starmeter:",
    "const seed={schema:2,sourceVersion:'0.8.41',builtAt:new Date().toISOString(),maxAgeHours:168,discovery,curated,starmeter:",
    'seed curated payload'
  );
  s=s.replace("top100RankingSchema:4","top100RankingSchema:5");
  return s;
});

edit('app/src/main/assets/app.js',s=>{
  s=s.replace(
    "installSeedDiscovery, installSeedPerson, searchInstallSeedPeople, installSeedTitleMetadata, installSeedEpisodeMetadata",
    "installSeedDiscovery, installSeedCuratedList, installSeedPerson, searchInstallSeedPeople, installSeedTitleMetadata, installSeedEpisodeMetadata"
  );
  s=s.replace("const ANDROID_CURRENT_VERSION='0.8.40';","const ANDROID_CURRENT_VERSION='0.8.41';");
  s=replaceOnce(
    s,
    "const ANDROID_CURRENT_CHANGELOG=[\n",
    "const ANDROID_CURRENT_CHANGELOG=[\n  'Restores Top 100 Movies and Top 100 TV Shows from packaged Snoak Trakt Trending lists and removes the accidental Home Explore-all buttons.',\n  'STARmeter title rails now continue past the first eight results in memory-safe eight-card batches as you browse right.',\n  'Makes the My SwoopTV Favorites hero exactly the same height as Home and surfaces premium Audio/Speed, Subtitles and Fit/Fill controls in the native player.',\n",
    'v0.8.41 changelog'
  );
  s=s.replace("const TOP100_RANKING_SCHEMA=4;","const TOP100_RANKING_SCHEMA=5;");
  s=s.replace(
    "STARMETER_PREFETCH_AHEAD=6,STARMETER_TITLE_RENDER_LIMIT=8,STARMETER_PATCH_BATCH=3",
    "STARMETER_PREFETCH_AHEAD=6,STARMETER_TITLE_RENDER_LIMIT=8,STARMETER_TITLE_APPEND_BATCH=8,STARMETER_PATCH_BATCH=3"
  );

  const oldSnoak=`    const listKey=SNOAK_CURATED_ROWS.get(id);
    try{
      const payload=await fetchSwoopCuratedList({settings:state.settings,listKey});
      const source=payload?.items||[];
      const items=nativeCatalogMode?cacheNativeItems((await nativeCatalogMatchPayload(source,mediaType,{sourceLimit:800,limit:HOME_STANDARD_ROW_LIMIT,providerIds:nativeEnabledProviderIds()})).items||[]):NATIVE_ANDROID?await androidMatchDiscoveryPayload(source,mediaType,{sourceLimit:800,limit:HOME_STANDARD_ROW_LIMIT}):matchMDBListToCatalog(source,activeCatalog(),{sourceLimit:800,limit:HOME_STANDARD_ROW_LIMIT,mediaType});
      return {items:items.slice(0,rowLimit),enhanced:true,snoak:true,source:'snoak',sourceUpdatedAt:Number(payload?.sourceUpdatedAt||0)};
    }catch(err){
      const fallback=nativeCatalogMode?(nativeHomeRowCache.get(id)||[]):localHomeRowItems(id);
      return {items:(fallback||[]).slice(0,rowLimit),enhanced:false,snoak:false,source:'local-fallback',warning:err.message||String(err)};
    }`;
  const newSnoak=`    const listKey=SNOAK_CURATED_ROWS.get(id),seed=await getInstallSeedCache();
    let payload=installSeedCuratedList(seed,listKey),sourceName=payload?'snoak-seed':'',warning='';
    if(force||!payload){try{payload=await fetchSwoopCuratedList({settings:state.settings,listKey});sourceName='snoak-live'}catch(err){warning=err.message||String(err)}}
    if(payload){
      const source=payload?.items||[];
      const items=nativeCatalogMode?cacheNativeItems((await nativeCatalogMatchPayload(source,mediaType,{sourceLimit:800,limit:HOME_STANDARD_ROW_LIMIT,providerIds:nativeEnabledProviderIds()})).items||[]):NATIVE_ANDROID?await androidMatchDiscoveryPayload(source,mediaType,{sourceLimit:800,limit:HOME_STANDARD_ROW_LIMIT}):matchMDBListToCatalog(source,activeCatalog(),{sourceLimit:800,limit:HOME_STANDARD_ROW_LIMIT,mediaType});
      return {items:items.slice(0,rowLimit),enhanced:true,snoak:true,source:sourceName||'snoak',sourceUpdatedAt:Number(payload?.sourceUpdatedAt||0),warning};
    }
    const previous=state.webDiscovery?.[id],previousItems=Array.isArray(previous?.items)?previous.items:[];
    return {items:previousItems.slice(0,rowLimit),enhanced:Boolean(previous?.enhanced),snoak:true,source:previous?.source||'snoak-unavailable',warning:warning||'Snoak trending list unavailable.'};`;
  s=replaceOnce(s,oldSnoak,newSnoak,'Snoak seed-first Top 100');

  s=replaceOnce(
    s,
    "${opts.page?`<button class=\"section-link\" data-page=\"${opts.page}\">Explore all →</button>`:'<span class=\"rail-arrow\">›</span>'}",
    "${opts.page&&!opts.rowId?`<button class=\"section-link\" data-page=\"${opts.page}\">Explore all →</button>`:'<span class=\"rail-arrow\">›</span>'}",
    'Home Explore-all suppression'
  );

  s=replaceOnce(
    s,
    "<div class=\"rail starmeter-title-rail\">${titles.slice(0,STARMETER_TITLE_RENDER_LIMIT).map(x=>card(x,true)).join('')}</div>",
    "<div class=\"rail starmeter-title-rail\" data-starmeter-title-total=\"${titles.length}\">${titles.slice(0,STARMETER_TITLE_RENDER_LIMIT).map(x=>card(x,true)).join('')}</div>",
    'STARmeter title total marker'
  );

  s=replaceOnce(
    s,
    "function starmeterPage(){",
    `function appendStarmeterTitleRail(section){
  if(state.page!=='starmeter'||!section)return false;
  const rank=Number(section.dataset.starmeterRank||0),entry=starmeterPeople.find(x=>Number(x.rank)===rank);if(!entry)return false;
  const cached=starmeterPersonCache.get(starmeterNormalize(entry.name)),titles=starmeterPersonTitles(cached),rail=section.querySelector('.starmeter-title-rail');if(!rail||!titles.length)return false;
  const rendered=rail.querySelectorAll(':scope > .card').length;if(rendered>=titles.length)return false;
  const end=Math.min(titles.length,rendered+STARMETER_TITLE_APPEND_BATCH),html=titles.slice(rendered,end).map(x=>card(x,true)).join('');if(!html)return false;
  rail.insertAdjacentHTML('beforeend',html);rail.dataset.starmeterTitleTotal=String(titles.length);
  hydrateArtwork(rail);hydrateVisibleImdbRatings(rail);bindDynamicCards(rail);bindRailStability(section);return true;
}
function starmeterPage(){`,
    'STARmeter incremental title append'
  );

  s=replaceOnce(
    s,
    "let cards=tvRailCards(section),index=cards.indexOf(card);if(index<0)return null;\n  if(key==='ArrowLeft')return index>0?cards[index-1]:null;",
    "let cards=tvRailCards(section),index=cards.indexOf(card);if(index<0)return null;\n  if(key==='ArrowRight'&&state.page==='starmeter'&&card.closest('.starmeter-title-rail')){if(index>=Math.max(0,cards.length-2))appendStarmeterTitleRail(section);cards=tvRailCards(section);index=cards.indexOf(card);return index<cards.length-1?cards[index+1]:null}\n  if(key==='ArrowLeft')return index>0?cards[index-1]:null;",
    'STARmeter Right continuation'
  );
  return s;
});

edit('app/src/main/assets/styles.css',s=>{
  s=replaceOnce(
    s,
    "html.android-tv .myswoop-page .myswoop-cinematic-hero{min-height:clamp(600px,78vh,820px)!important}",
    "html.android-tv .myswoop-page .myswoop-cinematic-hero{height:440px!important;min-height:440px!important;max-height:440px!important}",
    'My SwoopTV hero exact Home geometry'
  );
  return s;
});

edit('app/src/main/java/tv/swoop/player/MainActivity.java',s=>{
  s=s.replaceAll('0.8.40','0.8.41').replace('out.put(\"versionCode\", 840);','out.put(\"versionCode\", 841);');
  s=replaceOnce(s,"import android.graphics.Color;\n","import android.graphics.Color;\nimport android.graphics.drawable.GradientDrawable;\n",'premium player drawable import');
  s=replaceOnce(s,"import android.widget.FrameLayout;\nimport android.widget.ImageView;\n","import android.widget.FrameLayout;\nimport android.widget.ImageView;\nimport android.widget.Button;\nimport android.widget.LinearLayout;\n",'premium player button imports');
  s=replaceOnce(
    s,
    "    private volatile boolean nativePlayerVisible = false;\n",
    "    private volatile boolean nativePlayerVisible = false;\n    private boolean nativePlayerFillMode = false;\n",
    'player fit state'
  );

  const oldPremium=`    private void configurePremiumPlayerControls() {
        if (playerView == null) return;
        String[] ids = new String[]{"exo_rew","exo_play_pause","exo_ffwd","exo_subtitle","exo_settings"};
        for (String idName : ids) {
            View control = media3Control(idName);
            if (control == null) continue;
            control.setVisibility(View.VISIBLE);
            float scale = "exo_play_pause".equals(idName) ? 1.28f : 1.14f;
            control.setScaleX(scale);
            control.setScaleY(scale);
            control.setPadding(12,12,12,12);
            if ("exo_subtitle".equals(idName)) control.setContentDescription("Subtitles");
            if ("exo_settings".equals(idName)) control.setContentDescription("Audio and playback options");
        }
        View bottomBar = media3Control("exo_bottom_bar");
        if (bottomBar != null) {
            bottomBar.setBackgroundColor(Color.argb(188,7,8,14));
            bottomBar.setPadding(34,16,34,24);
        }
    }
`;
  const newPremium=`    private Button premiumPlayerButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(Color.WHITE);
        button.setTextSize(12f);
        button.setAllCaps(false);
        button.setFocusable(true);
        button.setFocusableInTouchMode(false);
        button.setPadding(18, 6, 18, 6);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.argb(220, 24, 26, 34));
        bg.setCornerRadius(16f);
        bg.setStroke(1, Color.argb(100, 255, 255, 255));
        button.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        lp.setMargins(6, 0, 6, 0);
        button.setLayoutParams(lp);
        return button;
    }

    private void configurePremiumPlayerControls() {
        if (playerView == null) return;
        String[] ids = new String[]{"exo_rew","exo_play_pause","exo_ffwd","exo_subtitle","exo_settings"};
        for (String idName : ids) {
            View control = media3Control(idName);
            if (control == null) continue;
            control.setVisibility(View.VISIBLE);
            float scale = "exo_play_pause".equals(idName) ? 1.28f : 1.14f;
            control.setScaleX(scale);
            control.setScaleY(scale);
            control.setPadding(12,12,12,12);
            if ("exo_subtitle".equals(idName)) control.setContentDescription("Subtitles");
            if ("exo_settings".equals(idName)) control.setContentDescription("Audio and playback options");
        }
        View bottomBar = media3Control("exo_bottom_bar");
        if (bottomBar != null) {
            bottomBar.setBackgroundColor(Color.argb(210,7,8,14));
            bottomBar.setPadding(34,16,34,24);
        }
        View basicControls = media3Control("exo_basic_controls");
        if (basicControls instanceof LinearLayout) {
            LinearLayout group = (LinearLayout) basicControls;
            Button audio = premiumPlayerButton("Audio & Speed");
            audio.setContentDescription("Audio tracks and playback speed");
            audio.setOnClickListener(v -> {
                playerView.showController();
                View settings = media3Control("exo_settings");
                if (settings != null) settings.performClick();
            });
            Button subtitles = premiumPlayerButton("Subtitles");
            subtitles.setContentDescription("Subtitle and closed caption tracks");
            subtitles.setOnClickListener(v -> {
                playerView.showController();
                View cc = media3Control("exo_subtitle");
                if (cc != null) cc.performClick();
            });
            Button fit = premiumPlayerButton("Fit");
            fit.setContentDescription("Toggle video between fit and fill");
            fit.setOnClickListener(v -> {
                nativePlayerFillMode = !nativePlayerFillMode;
                playerView.setResizeMode(nativePlayerFillMode
                        ? AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                        : AspectRatioFrameLayout.RESIZE_MODE_FIT);
                fit.setText(nativePlayerFillMode ? "Fill" : "Fit");
                playerView.showController();
            });
            group.addView(audio, 0);
            group.addView(subtitles, 1);
            group.addView(fit, 2);
        }
    }
`;
  s=replaceOnce(s,oldPremium,newPremium,'premium text control strip');
  return s;
});

edit('tests/tv-ui-runtime-smoke.mjs',s=>{
  s=s.replaceAll('0.8.40','0.8.41');
  s=s.replaceAll('TOP100_RANKING_SCHEMA=4','TOP100_RANKING_SCHEMA=5');
  s=s.replaceAll('top100RankingSchema:4','top100RankingSchema:5');
  s=replaceOnce(
    s,
    "// v0.8.40 Live TV current-programme header.\n",
    `// v0.8.41 consolidated physical-TV fixes.
if (!appSource.includes('installSeedCuratedList') || !appSource.includes("listKey:'trending-movies'") || !appSource.includes("listKey:'trending-shows'")) throw new Error('Packaged Snoak Top 100 seed fallback missing');
if (!appSource.includes("opts.page&&!opts.rowId")) throw new Error('Home Explore-all regression returned');
if (!appSource.includes('STARMETER_TITLE_APPEND_BATCH=8') || !appSource.includes('function appendStarmeterTitleRail(')) throw new Error('STARmeter title continuation beyond eight missing');
if (!cssSource.includes('.myswoop-cinematic-hero{height:440px!important;min-height:440px!important;max-height:440px!important}')) throw new Error('My SwoopTV hero no longer exactly matches Home height');
if (!activitySource.includes('premiumPlayerButton("Audio & Speed")') || !activitySource.includes('premiumPlayerButton("Subtitles")') || !activitySource.includes('premiumPlayerButton("Fit")')) throw new Error('Premium player text controls missing');

// v0.8.40 Live TV current-programme header.
`,
    'v0.8.41 tests'
  );
  return s;
});

edit('RELEASE_NOTES.md',s=>{
  const entry=`## v0.8.41 — Top 100 Restore + Full STARmeter Rails + Player/Hub Parity

- Restores **Top 100 Movies** and **Top 100 TV Shows** from packaged copies of Snoak’s Trakt Trending Movies/Shows feeds so the rows are populated immediately and are no longer dependent on a live discovery request at Home render time.
- Removes the accidental **Explore all →** links from Home rail headers; Home returns to the clean title + arrow treatment.
- Keeps STARmeter’s memory-safe initial eight title cards per person, but appends another eight as focus approaches the end so every matched title remains browsable without recreating the renderer-pressure problem.
- Makes the **My SwoopTV** cinematic Favorites hero exactly the same 440 px Google TV masthead height as Home.
- Surfaces premium native-player text controls for **Audio & Speed**, **Subtitles**, and **Fit/Fill** while retaining Media3 rewind, play/pause, fast-forward, timeline, buffering and embedded/external subtitle handling.
- Bumps the Top 100 ranking cache schema to v5 so broken/empty v4 ranking caches are rejected.

`;
  if(!s.startsWith('## v0.8.41'))s=entry+s;
  return s;
});

edit('TV_HARDWARE_TEST_CHECKLIST.md',s=>{
  const entry=`## v0.8.41 focused hardware checks

- **TOP100-RESTORE-001:** Home shows populated Top 100 Movies and Top 100 TV Shows from Snoak trending sources after a fresh install/update; no empty pinned rows.
- **HOME-CLEAN-001:** Home rail headers do not show Explore-all buttons.
- **STAR-RAIL-001:** On a STARmeter person with more than eight provider matches, hold/right-browse past card 8 and confirm additional cards append smoothly.
- **MYSWOOP-HERO-001:** My SwoopTV hero height/crop matches Home exactly.
- **PLAYER-PREMIUM-001:** Native player exposes Audio & Speed, Subtitles and Fit/Fill; multi-audio files show Media3 audio track choices and subtitle tracks remain selectable.

`;
  if(!s.startsWith('## v0.8.41'))s=entry+s;
  return s;
});

try{fs.rmSync('.promotion/promote-pending.mjs')}catch{}
execFileSync('git',['config','user.name','github-actions[bot]']);
execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
execFileSync('git',['add','-A'],{stdio:'inherit'});
execFileSync('git',['commit','-m','Promote v0.8.41 consolidated TV fixes [skip ci]'],{stdio:'inherit'});
execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});
console.log('v0.8.41 promotion applied and pushed.');
