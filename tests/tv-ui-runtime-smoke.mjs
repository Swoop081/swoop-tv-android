import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../app/src/main/assets/app.js', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../app/src/main/assets/styles.css', import.meta.url), 'utf8');
const nativeSource = fs.readFileSync(new URL('../app/src/main/assets/src/native.js', import.meta.url), 'utf8');
const activitySource = fs.readFileSync(new URL('../app/src/main/java/tv/swoop/player/MainActivity.java', import.meta.url), 'utf8');
const updaterSource = fs.readFileSync(new URL('../app/src/main/java/tv/swoop/player/SwoopUpdateManager.java', import.meta.url), 'utf8');
const updateReceiverSource = fs.readFileSync(new URL('../app/src/main/java/tv/swoop/player/SwoopUpdateReceiver.java', import.meta.url), 'utf8');
const manifestSource = fs.readFileSync(new URL('../app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const performancePackSource = fs.readFileSync(new URL('../app/src/main/assets/src/performancePack.js', import.meta.url), 'utf8');
const storageSource = fs.readFileSync(new URL('../app/src/main/assets/src/storage.js', import.meta.url), 'utf8');
const profilesSource = fs.readFileSync(new URL('../app/src/main/assets/src/profiles.js', import.meta.url), 'utf8');
const swSource = fs.readFileSync(new URL('../app/src/main/assets/sw.js', import.meta.url), 'utf8');
const installSeed = JSON.parse(fs.readFileSync(new URL('../app/src/main/assets/seed-cache.json', import.meta.url), 'utf8'));
const {performancePackProviderDelta} = await import(new URL('../app/src/main/assets/src/performancePack.js', import.meta.url));

const starmeterManifest = JSON.parse(fs.readFileSync(new URL('../app/src/main/assets/starmeter.json', import.meta.url), 'utf8'));
const starmeterPeople = Array.isArray(starmeterManifest?.people) ? starmeterManifest.people : [];
if (starmeterPeople.length !== 100) throw new Error(`STARmeter manifest must contain 100 people, got ${starmeterPeople.length}`);
const starmeterRanks = starmeterPeople.map(x=>Number(x.rank));
if (starmeterRanks.some((rank,index)=>rank!==index+1)) throw new Error('STARmeter ranks must be contiguous 1–100');
const starmeterNames = starmeterPeople.map(x=>String(x.name||'').trim().toLowerCase());
if (starmeterNames.some(x=>!x) || new Set(starmeterNames).size !== 100) throw new Error('STARmeter people must contain 100 unique non-empty names');
const releaseStarmeter = JSON.parse(fs.readFileSync(new URL('../swoop-tv-starmeter.json', import.meta.url), 'utf8'));
if (JSON.stringify(releaseStarmeter.people) !== JSON.stringify(starmeterManifest.people)) throw new Error('Bundled and release STARmeter manifests diverge');

const start = appSource.indexOf('function homeVisibleTitleKey(');
const end = appSource.indexOf('\nfunction androidFastRowItems(', start);
if (start < 0 || end < 0) throw new Error('Unable to locate Home title de-duplication helpers');
const dedupeSource = appSource.slice(start, end);
const prelude = `
const cleanDisplayTitle=x=>x?.name||'';
const normalizeMediaTitle=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function yearNumber(item){const m=String(item?.year||item?.name||'').match(/(?:19|20)\\d{2}/);return m?Number(m[0]):0}
`;
const dedupeHomeTitles = new Function(`${prelude}\n${dedupeSource}\nreturn dedupeHomeTitles;`)();
const input = [
  {id:'a',kind:'movie',name:'Villains Unite',year:'2026'},
  {id:'b',kind:'movie',name:'Villains Unite',year:'2026'},
  {id:'c',kind:'movie',name:'Villains Unite',year:'2017'},
  {id:'d',kind:'movie',name:'Another Film',year:'2026',tmdbId:'44'},
  {id:'e',kind:'movie',name:'Another Film Alt',year:'2026',tmdbId:'44'},
];
const output = dedupeHomeTitles(input);
if (output.length !== 3) throw new Error(`Expected 3 unique visible titles, got ${output.length}`);
if (output.filter(x=>x.name==='Villains Unite').length !== 2) throw new Error('Known different-year remakes should remain distinct');

// Existing ranked/trending guarantees.
if (!appSource.includes("if(id==='top20-movies'||id==='top20-shows')return '';")) throw new Error('Top 100 availability label suppression missing');
if (!appSource.includes("if(String(id).startsWith('top20-'))return'hot';")) throw new Error('Top 100 hot/trending mode missing');
if (!appSource.includes('const HOME_RANKED_ROW_LIMIT=100;')) throw new Error('Top 100 100-title cap missing');
if (!appSource.includes('const TOP100_RANKING_SCHEMA=5;')) throw new Error('Top 100 ranking cache schema missing');

// v0.8.23+ deterministic remote/focus system.
if (!appSource.includes('function tvQueueVerticalMove(key)')) throw new Error('Queued vertical D-pad navigation missing');
if (!appSource.includes('const tvRowColumnMemory=new Map()')) throw new Error('Per-row horizontal focus memory missing');
if (!appSource.includes('function tvGenericRailDirectionalTarget(current,key)')) throw new Error('Deterministic generic rail navigation missing');
if (appSource.includes('const style=getComputedStyle(el);')) throw new Error('TV focus hot path still performs getComputedStyle');
if (!cssSource.includes('scroll-behavior:auto!important')) throw new Error('TV rails still use animated scroll behaviour');

// v0.8.23 continuous 100-at-a-time catalogue rails.
if (!appSource.includes('const LONG_RAIL_BATCH_SIZE=100')) throw new Error('100-item long-rail batches missing');
if (!appSource.includes('LONG_RAIL_PREFETCH_THRESHOLD=24')) throw new Error('Ahead-of-end long-rail prefetch missing');
if (!appSource.includes('data-long-rail="media"') || !appSource.includes('data-long-rail="live"')) throw new Error('Long-rail pagination markers missing');
if (!appSource.includes('function prefetchMediaRail(') || !appSource.includes('function prefetchLiveRail(')) throw new Error('Long-rail prefetch functions missing');

// Home masthead and persistent TV navigation.
if (!cssSource.includes('height:440px!important')) throw new Error('v0.8.23 bounded Home hero missing');
if (!cssSource.includes('position:fixed!important') || !cssSource.includes('z-index:160!important')) throw new Error('Persistent Google TV top navigation missing');
if (!appSource.includes("key==='ArrowUp'&&firstSection&&currentSection===firstSection&&heroAction")) throw new Error('First Home row → hero Up routing missing');
if (!appSource.includes("key==='ArrowDown'&&tvIsTopNavigationElement(current)&&heroAction")) throw new Error('Top navigation → hero Down routing missing');
if (!appSource.includes('function updateAndroidTvViewportProfile()')) throw new Error('Adaptive TV viewport density missing');
if (!cssSource.includes('data-tv-density="compact"') || !cssSource.includes('data-tv-density="tight"')) throw new Error('Adaptive TV density CSS missing');


// v0.8.25 long-rail/vertical-position regressions.
if (!appSource.includes("if((key==='ArrowLeft'||key==='ArrowRight')&&tvRailSection(current))return true")) throw new Error('Horizontal rail ownership guard missing; focus can escape to another row at a render boundary');
if (!appSource.includes("const r=card.getBoundingClientRect(),cx=(r.left+r.right)/2")) throw new Error('Visual-column Up/Down targeting missing');
if (!appSource.includes('LONG_RAIL_INITIAL_RENDER=24') || !appSource.includes('LONG_RAIL_RENDER_CHUNK=24')) throw new Error('Larger lazy-render safety window missing');
if (!appSource.includes("['home','Home'],['myswoop','My SwoopTV'],['live','Live TV'],['guide','Guide'],['starmeter','STARmeter'],['movies','Movies']")) throw new Error('STARmeter primary navigation placement missing');
if (!appSource.includes('function starmeterPage()') || !appSource.includes('function prewarmStarmeterHotCache')) throw new Error('STARmeter page/hot-cache implementation missing');
if (!appSource.includes("fetch('./starmeter.json'")) throw new Error('Bundled STARmeter fallback manifest missing');
if (!appSource.includes("[data-starmeter-retry]") || !appSource.includes('starmeterObserver?.disconnect?.()')) throw new Error('STARmeter retry/observer cleanup missing');
if (!appSource.includes('function prewarmSelectedEpisodeMetadata()') || !appSource.includes('fetchEpisodeMetadata')) throw new Error('Episode metadata background enrichment missing');
if (!cssSource.includes('grid-template-columns:minmax(0,39%) minmax(0,31%) minmax(0,30%)')) throw new Error('Live TV left/preview/brand three-column hero missing');
if (!cssSource.includes('grid-auto-columns:minmax(0,168px)!important')) throw new Error('Larger Browse Live TV tiles missing');
if (!cssSource.includes('font-size:8px!important')) throw new Error('Smaller TV IMDb badge missing');

// Continue Watching long-press options.
if (!appSource.includes('window.__swoopTvFocusedSupportsLongPress')) throw new Error('Continue Watching long-press capability hook missing');
if (!appSource.includes('window.__swoopTvLongPressFocused')) throw new Error('Continue Watching long-press action hook missing');
if (!activitySource.includes('__swoopTvLongPressFocused')) throw new Error('Android long-press Select bridge missing');
if (!appSource.includes('data-continue-options-id')) throw new Error('Continue Watching context-menu target marker missing');

// Clean artwork + Live TV preview/contained branding.
if (!cssSource.includes('html.android-tv .card.poster .card-copy')) throw new Error('TV poster overlay suppression missing');
if (!appSource.includes('live-preview-anchor')) throw new Error('Live TV preview anchor missing');
if (!nativeSource.includes('export async function nativePreviewLive')) throw new Error('Native Live TV preview bridge missing');
if (!activitySource.includes('startPreviewPlayer')) throw new Error('Media3 muted preview player missing');
if (!activitySource.includes('import android.util.Log;') || !activitySource.includes('WebView renderer exited')) throw new Error('Android renderer-loss diagnostics missing');
if (!cssSource.includes('object-fit:contain!important') || !cssSource.includes('transform:none!important')) throw new Error('Contained Live TV logo treatment missing');

// Guide redesign and automatic continuation.
if (!appSource.includes('function guidePage()') || !appSource.includes('hours=2')) throw new Error('Two-hour TV Guide window missing');
if (!appSource.includes('guide-main-header')) throw new Error('TV Guide main/right title header missing');
if (!cssSource.includes('grid-template-columns:minmax(285px,22vw)')) throw new Error('Wider TV Guide category sidebar missing');
if (!appSource.includes('function maybeAutoLoadGuideFromFocus')) throw new Error('Automatic Guide channel pagination missing');

// Actor shell speed-up.
if (!appSource.includes('const personLibraryCache=new Map()')) throw new Error('Actor/person catalogue cache missing');
if (!appSource.includes('loadAndroidPersonData')) throw new Error('Actor/person asynchronous hydration path missing');

// GitHub update manifest + one-time What’s New.
if (!appSource.includes('swoop-tv-latest.json')) throw new Error('GitHub build manifest update check missing');
if (!manifestSource.includes('android.permission.REQUEST_INSTALL_PACKAGES') || !manifestSource.includes('android.permission.UPDATE_PACKAGES_WITHOUT_USER_ACTION')) throw new Error('Android updater permissions missing');
if (!manifestSource.includes('.SwoopUpdateReceiver')) throw new Error('PackageInstaller status receiver missing');
if (!updaterSource.includes('PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED') || !updaterSource.includes('downloadVerifiedApk') || !updaterSource.includes('SHA-256')) throw new Error('Native verified self-update pipeline missing');
if (!updaterSource.includes('Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES') || !updaterSource.includes('Settings.ACTION_SECURITY_SETTINGS') || !updaterSource.includes('Settings.ACTION_APPLICATION_DETAILS_SETTINGS')) throw new Error('Google TV update-permission settings fallbacks missing');
if (!updaterSource.includes('installAfterPermission') || !updaterSource.includes('pendingManual || automaticUpdates()')) throw new Error('Updater permission-return continuation missing');
if (!updaterSource.includes('requestAutomaticInstallPermission') || !updaterSource.includes('lastPermissionPromptVersionCode')) throw new Error('Launch-time automatic update permission prompt missing');
if (!appSource.includes('async function bootstrapAndroidPreLogin()') || !appSource.includes('ANDROID_BOOT_FUN_LINES') || !appSource.includes('startupBootFunTitle') || !appSource.includes('while(Date.now()-started<2800)')) throw new Error('Cinema-style non-blocking pre-login boot pipeline missing');
if (!cssSource.includes('width:min(440px,54vw)') || !cssSource.includes('height:24px!important') || !cssSource.includes('.startup-cinema-card')) throw new Error('Large Swoop TV cinema boot presentation missing');
if (!profilesSource.includes("providerMode='private'") || !profilesSource.includes('privateProviders=[]')) throw new Error('Privacy-first profile provider ownership fields missing');
if (!appSource.includes("Shared household providers") || !appSource.includes("Private providers") || !appSource.includes('function scopedProviderId(')) throw new Error('Shared/private account provider selection missing');
if (!appSource.includes('state.sharedProviders=') || !appSource.includes("const PROVIDER_ACCOUNT_SCHEMA=2") || !appSource.includes("return profile.providerMode==='shared'?'shared':'private'")) throw new Error('Privacy-first household/private provider scope migration missing');
if (!profilesSource.includes("providerMode='private'")) throw new Error('Secondary account profile constructor is not privacy-first');
if (!appSource.includes("const PROVIDER_ACCOUNT_SCHEMA=2") || !appSource.includes("i===0?{...p,providerMode:'shared'}:{...p,providerMode:'private'")) throw new Error('Secondary-account privacy migration missing');
if (!appSource.includes("return profile.providerMode==='shared'?'shared':'private'")) throw new Error('Secondary account provider mode does not fail closed to private');
if (!appSource.includes('Private providers · Recommended') || !appSource.includes('Use shared household providers')) throw new Error('Privacy-first provider choice UI missing');
if (!appSource.includes("if(state.catalog.length){const enabled=new Set(enabledProviders().map(p=>p.id));base=base.filter")) throw new Error('Private account catalogue isolation guard missing');
if (!updaterSource.includes('url + ".sha256"')) throw new Error('Stable APK checksum verification missing');
if (!updateReceiverSource.includes('STATUS_PENDING_USER_ACTION') || !updateReceiverSource.includes('STATUS_SUCCESS')) throw new Error('Android install approval/success fallback handling missing');
if (!appSource.includes('data-android-update-check') || !appSource.includes('data-android-auto-update') || !appSource.includes('data-android-update-permission')) throw new Error('Settings automatic-update controls missing');
if (!appSource.includes('function maybeShowWhatsNewOnLogin()')) throw new Error('One-time What’s New login presentation missing');
if (!appSource.includes('data-show-whats-new')) throw new Error('Settings What’s New route missing');
if (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.52';")) throw new Error('Current Android UI version marker missing');
if (!activitySource.includes('InputMethodManager') || !activitySource.includes('isWebTextInputActive()') || !activitySource.includes('imm.isAcceptingText()') || !activitySource.includes('&& !isWebTextInputActive())') ) throw new Error('First-run TV keyboard Select/Enter pass-through missing');
if (!appSource.includes("event.key==='Enter'") || !appSource.includes('form.requestSubmit')) throw new Error('First-run keyboard Enter/Done handling missing');
if (!appSource.includes('submit.disabled=false') || !appSource.includes("submit.removeAttribute('disabled')")) throw new Error('First-run avatar Continue enable hotfix missing');
if (!appSource.includes('function tvProfileAvatarChoices(){return PROFILE_AVATARS}') || !appSource.includes('tvProfileAvatarChoices().map')) throw new Error('Full 20-avatar TV chooser missing');
for(const id of ['cheetah','seal','triceratops','capybara','panda','dinosaur','red-panda','kangaroo','dog','cat']){if(!profilesSource.includes(`avatar-${id}.svg`)||!fs.existsSync(new URL(`../app/src/main/assets/assets/avatar-${id}.svg`,import.meta.url)))throw new Error(`High-resolution TV avatar missing: ${id}`)}
if(!activitySource.includes('SwoopTV/0.8.52 AndroidTV')||!activitySource.includes('out.put("versionCode", 852)'))throw new Error('Native Android v0.8.52 markers are not aligned');
if (!appSource.includes('let androidProfileEntryCommitted=false;')) throw new Error('Android profile-entry commitment latch missing');
if (!appSource.includes('if(NATIVE_ANDROID)androidProfileEntryCommitted=true;')) throw new Error('Profile selection does not commit Android Home entry');
if (appSource.includes('refreshPerformancePackInfo().catch(()=>null);prepareStarmeterBeforeLogin().catch(()=>false)')) throw new Error('STARmeter still launches before profile selection');
if (!appSource.includes('if(androidProfileEntryCommitted){profilePickerOpen=false;render();requestAnimationFrame(()=>forceAndroidHomeEntry())')) throw new Error('Android pre-login completion can still reopen Who’s Watching after Home entry');
if (!cssSource.includes('html.android-tv .profile-starmeter-prep{display:none!important}')) throw new Error('Who’s Watching still exposes optional STARmeter progress as a loading gate');
if (!swSource.includes('swoop-tv-v0852-shell')) throw new Error('v0.8.52 service-worker cache marker missing');
if (appSource.includes("id:'profile-main',name:'Swoop TV',avatar:'lion'")) throw new Error('Manufactured Swoop TV/lion first-run profile still exists');
if (!appSource.includes('const FIRST_ACCOUNT_SCHEMA=1;') || !appSource.includes("firstRunStage=state.profiles.length?'done':(state.providers.length?'avatar':'provider')") || !appSource.includes("let modal=(state.profiles.length||state.providers.length)?null:'provider'")) throw new Error('Zero-account provider-first onboarding missing');
if (!appSource.includes('setInterval(()=>{androidBootFunIndex=(androidBootFunIndex+1)%ANDROID_BOOT_FUN_LINES.length;tick()},15000)')) throw new Error('Cinema loading messages are not held for 15 seconds');
if (!cssSource.includes('.first-account-avatar-grid') || !cssSource.includes('font-size:clamp(24px,2.6vw,38px)!important')) throw new Error('First-run avatar layout or smaller startup copy missing');
if (!updaterSource.includes('ManageAppExternalSourcesActivity') || !updaterSource.includes('Intent.EXTRA_PACKAGE_NAME') || !updaterSource.includes('Toast.makeText')) throw new Error('Direct-app install-permission guidance/fallback missing');
if (!appSource.includes('function firstRunProviderWizardModal()') || !appSource.includes('data-first-provider-method') || !appSource.includes('data-first-provider-next') || !appSource.includes('Name this playlist') || !appSource.includes('data-first-account-avatar') || !appSource.includes('completeFirstRunIfReady') || !appSource.includes('firstRunProviderBusy=true')) throw new Error('Guided provider-first background-loading avatar onboarding missing');
if (!appSource.includes('function tvModalRoot()')) throw new Error('TV modal focus scope missing');
if (!appSource.includes("document.documentElement.classList.toggle('tv-modal-open'")) throw new Error('TV modal scroll lock class missing');
if (!appSource.includes('data-whats-new-done autofocus')) throw new Error('What’s New primary-action autofocus missing');
if (!cssSource.includes('html.android-tv.tv-modal-open')) throw new Error('TV modal background scroll lock CSS missing');
if (!appSource.includes('modalRoot.contains(found)')) throw new Error('TV focus restore can still escape behind an open modal');


// v0.8.26 hardware performance/stability regressions.
if (!appSource.includes('async function tvAdvanceLongRailRight(current)')) throw new Error('Async long-rail boundary continuation missing');
if (!appSource.includes('ANDROID_HEAVY_NONPERSISTENT_PAGES')) throw new Error('Android heavy-page DOM eviction missing');
if (!appSource.includes('STARMETER_INITIAL_VISIBLE=100,STARMETER_APPEND_BATCH=100')) throw new Error('STARmeter visible-window virtualization constants missing');
if (!appSource.includes('function appendStarmeterSections(') || !appSource.includes('function setupStarmeterAutoLoad()')) throw new Error('STARmeter virtual append/autoload missing');
if (!appSource.includes('function hydrateStarmeterIdentity(')) throw new Error('STARmeter identity-only prewarm path missing');
if (!appSource.includes('function appendLiveCategorySections(')) throw new Error('Live TV in-place category append missing');
if (!appSource.includes('function patchLiveHeroFocusedChannel(')) throw new Error('Focused Live TV hero update missing');
if (!appSource.includes('function tvTopbarDirectionalTarget(') || !appSource.includes('function tvTopbarDownTarget(')) throw new Error('Deterministic topbar focus routing missing');
if (!cssSource.includes('.hero-rotation-dots i.active')) throw new Error('Small non-focusable Home hero dots missing');
if (!cssSource.includes('.media-category-page .page-hero') || !cssSource.includes('height:440px!important')) throw new Error('Movies/TV Shows approved Home hero parity missing');
if (!cssSource.includes('grid-template-columns:230px minmax(0,1fr)!important')) throw new Error('Large people-first STARmeter layout missing');
if (!cssSource.includes('border-radius:999px!important;object-fit:cover!important')) throw new Error('Circular STARmeter portraits missing');
if (!cssSource.includes('width:75%!important;height:75%!important')) throw new Error('Reduced centered Live TV brand treatment missing');


// v0.8.27 hardware-test workflow diagnostics.
if (!appSource.includes('const TV_HARDWARE_TESTS=[') || !appSource.includes("id:'NAV-001'") || !appSource.includes("id:'STAB-001'")) throw new Error('Numbered hardware regression test catalog missing');
if (!appSource.includes('function tvDiagRecord(') || !appSource.includes('function tvDiagnosticSnapshotSync(')) throw new Error('Hardware diagnostic event/snapshot system missing');
if (!appSource.includes('function noteTvHardwareSettingsTap()') || !appSource.includes('tvHardwareSettingsTapCount<5')) throw new Error('Hidden five-press Settings activation missing');
if (!appSource.includes('data-hardware-export') || !appSource.includes('exportTvHardwareDiagnostics')) throw new Error('On-device diagnostic export controls missing');
if (!appSource.includes("tvDiagRecord('key'") || !appSource.includes("tvDiagRecord('focus'")) throw new Error('D-pad/focus event logging missing');
if (!appSource.includes("entryTypes:['longtask']")) throw new Error('Long-task performance observer missing');
if (!nativeSource.includes('export async function nativeSaveDiagnostics')) throw new Error('Native diagnostic save wrapper missing');
if (!nativeSource.includes('export async function nativeClearDiagnostics') || !activitySource.includes('public String clearDiagnostics()')) throw new Error('Native diagnostic session reset missing');
if (!activitySource.includes('public String saveDiagnostics(String payloadJson)') || !activitySource.includes('Swoop-TV-v0.8.52-Diagnostics-')) throw new Error('Android diagnostic file export bridge missing');
if (!activitySource.includes('rendererGoneCount') || !activitySource.includes('javaHeapUsedBytes') || !activitySource.includes('nativeKeyEventCount')) throw new Error('Native renderer/memory/key diagnostics missing');
if (!cssSource.includes('.tv-hardware-overlay') || !cssSource.includes('pointer-events:none')) throw new Error('Non-focusable hardware HUD missing');

// v0.8.28 packaged warm-start seed cache.
if (Number(installSeed.schema||0) < 2) throw new Error('Install seed cache schema 2+ missing');
if (String(installSeed.sourceVersion||'') !== '0.8.44') throw new Error('Install seed source version is not v0.8.44');
if (!Array.isArray(installSeed?.starmeter?.people) || installSeed.starmeter.people.length !== 100) throw new Error('Install seed must carry the full STARmeter Top 100');
if (!appSource.includes("from './src/seedCache.js'")) throw new Error('Install seed cache runtime module is not wired into app.js');
if (!appSource.includes('installSeedDiscovery(seed,key)')) throw new Error('Discovery seed-first path missing');
if (!appSource.includes('installSeedTitleMetadata(seed,item)')) throw new Error('Title metadata seed-first path missing');
if (!appSource.includes('installSeedEpisodeMetadata(seed,item,ep.season,ep.episodeNum)')) throw new Error('Episode metadata seed-first path missing');
if (!appSource.includes('installSeedCache||await getInstallSeedCache()') || !appSource.includes('searchInstallSeedPeople(seed,term,12)')) throw new Error('People Search install-seed hot path missing');
if (!appSource.includes('loadAndroidPersonData(seed,{credits:Array.isArray(installRecord?.credits)?installRecord.credits:[]})')) throw new Error('Actor-page seeded filmography path missing');



// v0.8.29 physical-TV consolidation regressions.
if (!appSource.includes('const ANDROID_TV_HOME_EAGER_ROWS=5')) throw new Error('Home Recently Added rows are not included in the eager TV row budget');
if (!appSource.includes('function completeTop100FromLibrary(') || !appSource.includes('HOME_RANKED_ROW_LIMIT')) throw new Error('Top 100 provider-backed completion path missing');
if (!appSource.includes('function discardTransientMediaRoutes()')) throw new Error('Primary-route stale detail/person teardown missing');
if (!appSource.includes('if(detailItem||personView)discardTransientMediaRoutes()')) throw new Error('Primary navigation does not force-close stale detail/person routes');
if (!appSource.includes('function focusDefaultProfileChoice()')) throw new Error('Default first-profile focus helper missing');
if (!appSource.includes('if(personView){closePerson();return true}')) throw new Error('Android Back does not close person route before underlying detail');
if (!appSource.includes('const starmeterHydrateQueue=[]') || !appSource.includes('let starmeterHydrateBusy=0') || !appSource.includes('function pumpStarmeterHydration()')) throw new Error('Bounded-concurrent STARmeter hydration queue missing');
if (!appSource.includes("guide:categories") || !appSource.includes("guide:channels") || !appSource.includes("guide:program:")) throw new Error('Guide focus diagnostics missing');
if (!activitySource.includes('Player.STATE_READY') || !activitySource.includes('previewPlayerView.setVisibility(View.GONE)')) throw new Error('Live preview ready-state blank-surface guard missing');
if (!appSource.includes('function tvDetailDirectionalTarget(')) throw new Error('Detail/episode deterministic directional navigation missing');
if (!cssSource.includes('object-fit:cover!important') || !cssSource.includes('object-position:center 28%!important')) throw new Error('Full-width face-safer Home/media hero treatment missing');
if (!cssSource.includes('width:200px!important;height:200px!important')) throw new Error('Large TV profile avatar treatment missing');
if (!cssSource.includes('.episode-card') || !cssSource.includes('grid-template-columns:minmax(220px,300px)')) throw new Error('Wide episode-row/thumbnail treatment missing');



// v0.8.32 fast-navigation + hydration stability regressions.
if (!appSource.includes('STARMETER_HYDRATE_CONCURRENCY=2') || !appSource.includes('STARMETER_PREFETCH_AHEAD=6') || !appSource.includes('STARMETER_TITLE_RENDER_LIMIT=8')) throw new Error('v0.8.37 STARmeter memory-safe concurrency/lookahead/title limits missing');
if (!appSource.includes('const visible=starmeterPeople.slice(0,100)')) throw new Error('STARmeter does not mount a fixed 100-row surface');
if (!appSource.includes('function tvPrefetchArtworkWindow(current,ahead=28,behind=3)')) throw new Error('Directional TV artwork prefetch window missing');
if (!appSource.includes('const artworkPrewarmPool=new Map()') || !appSource.includes("[item?.backdrop,'w1280']")) throw new Error('Correct-size retained hero artwork prewarm missing');
if (!appSource.includes('let homeHeroSwapToken=0') || !appSource.includes('async function replaceHomeHero()')) throw new Error('Atomic Home hero swap guard missing');
if (!appSource.includes('async function prewarmAndroidEntryArtwork(timeoutMs=1800)')) throw new Error('Android profile-to-Home entry prewarm missing');
if (!cssSource.includes('.hero-title-slot.logo-ready .hero-title-text')) throw new Error('Hero title fallback-until-logo-ready CSS missing');
if (!cssSource.includes('height:360px!important') || !cssSource.includes('.starmeter-person-section')) throw new Error('Stable fixed-height STARmeter row geometry missing');
if (!cssSource.includes('.live-hub-preview-panel.preview-active')) throw new Error('Live preview hidden-until-active treatment missing');
if (!cssSource.includes('transform:scale(1.30)')) throw new Error('Guide logo scale-up within existing cells missing');
if (!activitySource.includes('launchSplashView') || !activitySource.includes('onPageFinished') || !activitySource.includes('swoop_launch_logo')) throw new Error('Branded Android cold-launch overlay missing');

// v0.8.31 STARmeter provider matching + Guide banner hardware hotfix.
if (!appSource.includes("const PINNED_HOME_ROWS=['top20-movies','top20-shows'];")) throw new Error('Home is not discovery-first after My SwoopTV migration');
if (!appSource.includes('function mySwoopPage()') || !appSource.includes("['myswoop','My SwoopTV']")) throw new Error('My SwoopTV primary personal hub missing');
if (!appSource.includes("else if(state.page==='myswoop'||state.page==='mylist')body=mySwoopPage()")) throw new Error('Legacy My List route does not resolve to My SwoopTV');
if (!appSource.includes('def.ranked?Math.min(data.length,HOME_RANKED_ROW_LIMIT)')) throw new Error('Android Top 100 does not mount the full ranked focus set');
if (!appSource.includes('function cancelStarmeterWork()') || !appSource.includes('starmeterGeneration')) throw new Error('STARmeter cancellation/generation guard missing');
if (!appSource.includes('function tvStarmeterDirectionalTarget(current,key)')) throw new Error('STARmeter deterministic escape/navigation missing');
if (!appSource.includes("Provider availability index is still preparing")) throw new Error('STARmeter bounded provider-index fallback missing');
const workerSource = fs.readFileSync(new URL('../app/src/main/assets/src/catalog-index-worker.js', import.meta.url), 'utf8');
if (!workerSource.includes('function buildAvailabilityIndex(active=[])') || !workerSource.includes('function fastPersonMatch(') || !workerSource.includes("indexed:true")) throw new Error('Indexed provider availability person matching missing');
if (!cssSource.includes('grid-auto-columns:190px!important') || !cssSource.includes('width:190px!important;height:120px!important')) throw new Error('Live TV Recent Channels component parity missing');
if (!appSource.includes('guide-main-header guide-live-banner') || !cssSource.includes('.guide-live-banner{min-height:132px!important')) throw new Error('Guide Live TV/date/time banner missing');
if (!cssSource.includes('-webkit-line-clamp:4!important')) throw new Error('Expanded Home hero synopsis treatment missing');

if (!workerSource.includes('normalizeMediaTitle') || !workerSource.includes('availability.bucket') || !workerSource.includes('year-1') || !workerSource.includes('fuzzyScore')) throw new Error('Expanded indexed STARmeter title/year/fuzzy matching missing');
if (!appSource.includes("tvHomeSnapshotActive)await withTimeout(ensureDurableLibraryRestored()")) throw new Error('STARmeter does not wait for full durable Android provider catalogue');
if (!appSource.includes("clearPersistentPageViews('guide')") || !appSource.includes('<div class="eyebrow">LIVE TV</div><h1>TV Guide</h1>')) throw new Error('Guide true-top/date-time banner entry guard missing');
if (!cssSource.includes('.guide-live-banner{') || !cssSource.includes('height:146px!important')) throw new Error('Guide hardware banner visual height missing');
const seedScriptSource = fs.readFileSync(new URL('../scripts/refresh-seed-cache.mjs', import.meta.url), 'utf8');
if (!seedScriptSource.includes('SWOOP_SEED_CREDIT_PEOPLE||100') || !seedScriptSource.includes('original_title') || !seedScriptSource.includes('original_name')) throw new Error('Full Top 100 filmography seed generation/aliases missing');



// v0.8.36 functional provider-delta contract.
const deltaFirst=performancePackProviderDelta([],[{id:'a',kind:'movie',name:'A',year:2025,logo:'https://image/a.jpg'},{id:'b',kind:'series',name:'B',year:2024,logo:'https://image/b.jpg'}]);
if(deltaFirst.added!==2||deltaFirst.changed!==0||deltaFirst.removed!==0||deltaFirst.nextRows.length!==2)throw new Error('Performance Pack initial provider delta is incorrect');
const deltaSameReordered=performancePackProviderDelta(deltaFirst.nextRows,[{id:'b',kind:'series',name:'B',year:2024,logo:'https://image/b.jpg'},{id:'a',kind:'movie',name:'A',year:2025,logo:'https://image/a.jpg'}]);
if(deltaSameReordered.unchanged!==2||deltaSameReordered.added||deltaSameReordered.changed||deltaSameReordered.removed||deltaSameReordered.fingerprint!==deltaFirst.fingerprint)throw new Error('Performance Pack fingerprint must be order-independent and retain unchanged provider items');
const deltaStreamOnly=performancePackProviderDelta(deltaFirst.nextRows,[{id:'a',kind:'movie',name:'A',year:2025,logo:'https://image/a.jpg',streamUrl:'https://provider/new-session/a'},{id:'b',kind:'series',name:'B',year:2024,logo:'https://image/b.jpg',streamUrl:'https://provider/new-session/b'}]);
if(deltaStreamOnly.changed!==0||deltaStreamOnly.unchanged!==2)throw new Error('Performance Pack visual/metadata delta must ignore playback URL/session churn');
const deltaChanged=performancePackProviderDelta(deltaFirst.nextRows,[{id:'a',kind:'movie',name:'A',year:2025,logo:'https://image/a-v2.jpg'},{id:'c',kind:'movie',name:'C',year:2026}]);
if(deltaChanged.added!==1||deltaChanged.changed!==1||deltaChanged.removed!==1||deltaChanged.changedItems.length!==2)throw new Error('Performance Pack changed/added/removed provider delta is incorrect');

// v0.8.36 Performance Pack + incremental retention architecture.
if (!appSource.includes("from './src/performancePack.js'")) throw new Error('v0.8.36 Performance Pack runtime module is not wired into app.js');
if (!performancePackSource.includes("const DB_NAME='swoop-tv-performance-pack'") || !performancePackSource.includes("PERFORMANCE_ARTWORK_CACHE='swoop-tv-artwork-v1'")) throw new Error('Performance Pack persistent storage/artwork cache missing');
if (!performancePackSource.includes('syncProviderPerformancePack') || !performancePackSource.includes('providerFingerprint(rows=[])')) throw new Error('Provider delta fingerprint engine missing');
if (!appSource.includes('syncProviderPerformancePack(providerId,result.items') || !appSource.includes('syncProviderPerformancePack(providerId,cat') || !appSource.includes('syncProviderPerformancePack(p.id,resultItems')) throw new Error('Xtream/M3U add and provider refresh do not feed the incremental Performance Pack');
if (!performancePackSource.includes('STARMETER_RETENTION_MS=90*24*60*60*1000') || !performancePackSource.includes('loadPerformancePackStarmeter') || !performancePackSource.includes('savePerformancePackStarmeter')) throw new Error('Persistent 90-day STARmeter cache missing');
if (!appSource.includes('const missing=people.filter(row=>!starmeterPersonCache.has(row.key))') || !appSource.includes('applyPersistedStarmeterRows')) throw new Error('STARmeter is not reusing persisted people before matching newcomers');
if (!appSource.includes('if(e.repeat){starmeterHeldDirectional=true') || !appSource.includes("window.addEventListener('keyup'") || !appSource.includes('starmeterHeldKeys.size>0')) throw new Error('Held D-pad mutation freeze/release handling missing');
if (!swSource.includes("ARTWORK_CACHE='swoop-tv-artwork-v1'") || !swSource.includes("e.request.destination==='image'")) throw new Error('Service-worker persistent artwork cache path missing');
if (!appSource.includes("if('serviceWorker'in navigator&&location.protocol.startsWith('http'))")) throw new Error('Android service-worker registration is still disabled by native playback');
if (!storageSource.includes('schema:3') || !storageSource.includes('chunkHashes') || !storageSource.includes('catalogChunkFingerprint')) throw new Error('Incremental durable catalogue chunk persistence missing');

// v0.8.37 physical-TV UX + STARmeter renderer-memory hotfix.
if (!appSource.includes('const ARTWORK_PREWARM_MEMORY_LIMIT=NATIVE_ANDROID?48:260') || !appSource.includes('function trimArtworkPrewarmPool()')) throw new Error('v0.8.37 Android decoded-artwork memory cap missing');
if (appSource.includes('prewarmArtworkUrls(rounds,160)') || !appSource.includes('const hot=starmeterPeople.slice(0,12)')) throw new Error('STARmeter still performs the v0.8.36 all-people artwork prewarm');
if (!appSource.includes('STARMETER_HYDRATE_CONCURRENCY=2') || !appSource.includes('STARMETER_PREFETCH_AHEAD=6') || !appSource.includes('STARMETER_TITLE_RENDER_LIMIT=8')) throw new Error('STARmeter memory-pressure limits are not active');
if (!cssSource.includes('grid-template-columns:136px minmax(0,1fr)!important') || !cssSource.includes('height:136px!important') || !cssSource.includes('grid-auto-columns:70px!important')) throw new Error('Five-up STARmeter TV geometry missing');
if (!cssSource.includes('content-visibility:auto!important') || !cssSource.includes('contain:layout paint style!important')) throw new Error('STARmeter offscreen paint containment missing');
if (appSource.includes('<span class="card-saved">✓ MY LIST</span>') || appSource.includes('>My List<')) throw new Error('Legacy My List poster/UI treatment returned');
if (!appSource.includes("label:'Favorites'") || !appSource.includes("rail('Favorites'") || !appSource.includes('Add to Favorites')) throw new Error('Favorites naming is not consistent across saved-content UI');
if (!appSource.includes('function mySwoopHeroCandidates()') || !appSource.includes('function scheduleMySwoopHeroRotation()') || !appSource.includes('data-myswoop-hero')) throw new Error('My SwoopTV Favorites cinematic hero missing');
if (!appSource.includes('item.seriesPoster||parent?.logo||item.seasonPoster') || !appSource.includes('item=continueDisplayItem(raw)')) throw new Error('Recently Watched series-poster presentation missing');
const whatsStart=appSource.indexOf('function whatsNewModal()'),whatsEnd=appSource.indexOf('function continueOptionsModal',whatsStart),whatsBlock=appSource.slice(whatsStart,whatsEnd>whatsStart?whatsEnd:whatsStart+2500);
if (!whatsBlock.includes('data-whats-new-done autofocus') || whatsBlock.includes('data-close aria-label="Close"') || whatsBlock.includes('data-close-modal')) throw new Error('What’s New must expose only the Got it close action');
if (!appSource.includes('data-live-hero-item') || !appSource.includes('live-hub-brand-copy') || !cssSource.includes('position:sticky!important') || !cssSource.includes('grid-template-columns:minmax(0,35%) minmax(0,65%)!important')) throw new Error('Persistent two-column Live TV header missing');
if (!activitySource.includes('AspectRatioFrameLayout.RESIZE_MODE_ZOOM')) throw new Error('Native Live TV preview zoom-fill treatment missing');
if (!cssSource.includes('padding-bottom:180px!important')) throw new Error('TV page bottom safe-space tail missing');
// v0.8.44 consolidated physical-TV fixes.
const snoakMovies=installSeed?.curated?.['trending-movies']?.items||[],snoakShows=installSeed?.curated?.['trending-shows']?.items||[];
if (!appSource.includes('installSeedCuratedList') || !appSource.includes("['top20-movies','trending-movies']") || !appSource.includes("['top20-shows','trending-shows']")) throw new Error('Snoak Top 100 runtime mapping/seed fallback missing');
if (snoakMovies.length<100 || snoakShows.length<100) throw new Error(`Packaged Snoak Top 100 source lists incomplete: movies=${snoakMovies.length}, shows=${snoakShows.length}`);
if (!appSource.includes("opts.page&&!opts.rowId")) throw new Error('Home Explore-all regression returned');
if (!appSource.includes('STARMETER_TITLE_APPEND_BATCH=8') || !appSource.includes('function appendStarmeterTitleRail(')) throw new Error('STARmeter title continuation beyond eight missing');
if (!cssSource.includes('.myswoop-cinematic-hero{height:440px!important;min-height:440px!important;max-height:440px!important}')) throw new Error('My SwoopTV hero no longer exactly matches Home height');
if (!activitySource.includes('premiumPlayerButton("Audio & Speed")') || !activitySource.includes('premiumPlayerButton("Subtitles")') || !activitySource.includes('premiumPlayerButton("Fit")')) throw new Error('Premium player text controls missing');

console.log('Google TV UI runtime smoke passed');


// v0.8.33 route-top restoration + complete pre-login STARmeter preparation.
if (!appSource.includes('function tvForceRouteTop()') || !appSource.includes("target.closest?.('.topbar')")) throw new Error('v0.8.33 canonical route-top restoration missing');
if (!appSource.includes('function prepareStarmeterBeforeLogin()') || !appSource.includes("tvCatalogWorkerRequest('person-match-batch'")) throw new Error('v0.8.33 pre-login STARmeter batch preparation missing');
if (!appSource.includes('async function bootstrapAndroidPreLogin()') || !appSource.includes('prepareStarmeterBeforeLogin().catch(()=>false)')) throw new Error('STARmeter preparation does not start during the Android pre-login boot pipeline');
if (!appSource.includes('const routeTab=document.querySelector(`.desktop-nav [data-page=') || !appSource.includes('CSS.escape(state.page)')) throw new Error('First-row Up does not escape to the active route tab');
if (!cssSource.includes('height:136px!important') || !cssSource.includes('.profile-starmeter-prep')) throw new Error('v0.8.37 compact STARmeter fixed-row/profile-prewarm CSS missing');
if (!fs.readFileSync(new URL('../app/src/main/assets/src/catalog-index-worker.js', import.meta.url), 'utf8').includes("msg.type==='person-match-batch'")) throw new Error('STARmeter worker batch-match contract missing');

// v0.8.34 STARmeter fail-open chunked pre-login matching hotfix.
if (!appSource.includes('const STARMETER_PRELOGIN_BATCH_SIZE=12')) throw new Error('v0.8.34 STARmeter chunk size missing');
if (!appSource.includes('offset+=STARMETER_PRELOGIN_BATCH_SIZE') || !appSource.includes("tvCatalogWorkerRequest('person-match-batch',{people:chunk},12000)")) throw new Error('v0.8.34 chunked STARmeter matching missing');
if (appSource.includes("tvCatalogWorkerRequest('person-match-batch',{people},24000)")) throw new Error('All-100 STARmeter worker request regression returned');
if (!appSource.includes('setTimeout(()=>prepareStarmeterBeforeLogin().catch(()=>false),5000)')) throw new Error('STARmeter optimisation is not deferred until after profile entry');
if (!appSource.includes("STARmeter is usable now · provider matching will retry in the background.")) throw new Error('STARmeter fail-open recovery state missing');
if (!appSource.includes('const body=visible.length?visible.map(starmeterPersonSection).join')) throw new Error('STARmeter page is still hard-gated by background matching');


// v0.8.35 STARmeter physical-TV stable-row rendering hotfix.
if (!appSource.includes('const starmeterDeferredPatches=new Set(),starmeterDeferredIdentityPatches=new Map()')) throw new Error('v0.8.35 deferred STARmeter patch queues missing');
if (!appSource.includes('function flushStarmeterDeferredPatches()') || !appSource.includes('function starmeterMutationBlocked()') || !appSource.includes('starmeterHeldDirectional')) throw new Error('v0.8.36 held-D-pad STARmeter settle guard missing');
const patchStart=appSource.indexOf('function patchStarmeterPersonNow(rank)');
const patchEnd=appSource.indexOf('function restoreFocusSignatureIn',patchStart);
const patchBlock=patchStart>=0&&patchEnd>patchStart?appSource.slice(patchStart,patchEnd):'';
if (!patchBlock || patchBlock.includes('oldPerson.replaceWith') || patchBlock.includes("querySelector('.starmeter-person-column'),oldLibrary")) throw new Error('STARmeter person identity column is still being replaced during hydration');
if (!patchBlock.includes("querySelector('.starmeter-library-column')") || !patchBlock.includes('oldLibrary.replaceChildren')) throw new Error('STARmeter library-only patch path missing');
if (appSource.includes("if(state.page==='starmeter'&&!profilePickerOpen&&!detailItem&&!personView)render();return true;") || appSource.includes("if(state.page==='starmeter'&&!profilePickerOpen&&!detailItem&&!personView)render();scheduleStarmeterBackgroundRetry")) throw new Error('STARmeter background preparation still full-rerenders the active page');
if (!cssSource.includes('contain:layout paint style!important') || !cssSource.includes('overflow-y:hidden!important') || !cssSource.includes('transition:none!important')) throw new Error('v0.8.35 STARmeter paint containment/clipping contract missing');


// v0.8.38 STARmeter viewport-budget regression guards
if (!appSource.includes("STARMETER_PATCH_BATCH=3,STARMETER_ACTIVE_RADIUS=7,STARMETER_ART_RADIUS=8")) throw new Error('v0.8.38 STARmeter patch/artwork budgets missing');
if (!appSource.includes("img?.closest?.('.starmeter-title-rail'))size='w154'")) throw new Error('v0.8.38 STARmeter title artwork must request w154');
if (!appSource.includes("img?.closest?.('.starmeter-person-card'))size='w185'")) throw new Error('v0.8.38 STARmeter portrait artwork must request w185');
if (!appSource.includes("const starmeterTv=NATIVE_ANDROID&&state.page==='starmeter'")) throw new Error('v0.8.38 STARmeter artwork hydration isolation missing');
if (!appSource.includes('function trimStarmeterArtwork()')) throw new Error('v0.8.38 offscreen STARmeter artwork eviction missing');
if (!appSource.includes('let budget=STARMETER_PATCH_BATCH')) throw new Error('v0.8.38 bounded STARmeter deferred patch flush missing');
if (!cssSource.includes('v0.8.38 — STARmeter viewport-budget hotfix')) throw new Error('v0.8.38 STARmeter CSS guard missing');
if (!cssSource.includes('grid-auto-flow:column!important;grid-template-rows:100px!important;grid-auto-rows:100px!important')) throw new Error('v0.8.38 STARmeter rail must stay single-row');
if (!activitySource.includes('SwoopTV/0.8.52 AndroidTV') || !activitySource.includes('public String version() { return "0.8.52"; }')) throw new Error('v0.8.52 native Android markers missing');

// v0.8.44 direct Snoak/Trakt Top 100 sources.
if (!appSource.includes("['top20-movies','trending-movies']") || !appSource.includes("['top20-shows','trending-shows']")) throw new Error('Top 100 rows are not pinned to Snoak Trakt trending lists');
if (!appSource.includes("?filtered.slice(0,HOME_RANKED_ROW_LIMIT):filtered")) throw new Error('Top 100 rows still use aggregate provider-library filler');
if (!appSource.includes("!String(id).startsWith('top20-')")) throw new Error('Top 100 local fallback guard missing');

if (!appSource.includes('data-profile-starmeter-bar') || !appSource.includes("copy.textContent=starmeterBackgroundComplete?'Ready':'Please wait…'")) throw new Error('Who’s Watching preparation progress bar missing');
if (!cssSource.includes('html.android-tv .home-content,') || !cssSource.includes('padding-bottom:210px!important')) throw new Error('Home final-row breathing room missing');
if (!cssSource.includes('html.android-tv .profile-choice:focus-visible') || !cssSource.includes('.profile-choice:focus-visible .profile-avatar-xl')) throw new Error('Avatar-only profile focus treatment missing');
if (!activitySource.includes('setShowSubtitleButton(true)') || !activitySource.includes('setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS)') || !activitySource.includes('setTimeBarScrubbingEnabled(true)')) throw new Error('Premium Media3 playback controls missing');
if (!activitySource.includes('buildSubtitleConfigurations(JSONArray subtitleTracks)') || !nativeSource.includes('item?.subtitles') || !nativeSource.includes('subtitleUrl')) throw new Error('Sideloaded subtitle handoff missing');
if (!activitySource.includes('Audio and playback options')) throw new Error('Premium audio/settings control emphasis missing');

// v0.8.44 Live TV current-programme header.
if (!appSource.includes('data-live-hero-now') || !appSource.includes('function scheduleLiveHeroNowPlaying(')) throw new Error('Live TV current-programme header/sync missing');
if (!appSource.includes('currentProgramme(channel)') || !appSource.includes('ensureLiveEpg(channel)')) throw new Error('Live TV Now Playing is not sourced from the existing EPG cache/path');
if (!appSource.includes('NOW PLAYING') || !cssSource.includes('.live-hub-now>strong')) throw new Error('Live TV Now Playing presentation missing');

if (!profilesSource.includes("id:'cheetah'") || !profilesSource.includes("id:'cat'") || !profilesSource.includes("id:'red-panda'")) throw new Error('Supplied first-run avatar expansion missing');


// v0.8.49 full-size first-run TV onboarding.
if (!appSource.includes("const ANDROID_CURRENT_VERSION='0.8.52';")) throw new Error('v0.8.52 Android web runtime version marker missing');
if (!cssSource.includes('v0.8.49 — 80% TV-first onboarding wizard') || !cssSource.includes('width:80vw!important') || !cssSource.includes('height:80vh!important')) throw new Error('First-run provider wizard is not using the 80% TV viewport canvas');
if (!cssSource.includes('.first-run-provider-wizard .provider-method strong{font-size:clamp') || !cssSource.includes('.first-run-provider-wizard .field input,') || !cssSource.includes('.first-run-provider-wizard .cta-row .btn{')) throw new Error('First-run wizard typography/inputs/actions are not responsively TV-scaled');
