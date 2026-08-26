# Swoop TV release notes

## v0.8.13 — Profile Flow + Landscape Editor

- Fixes the Google TV blocker where a focused profile could not reliably be opened with the remote. Profile selection now enters cached Home immediately, or reveals the preparation screen immediately only when a local library genuinely must be restored/imported.
- Removes the pre-entry blocking persistence wait from the Android profile-selection path and adds an explicit remote Enter fallback for profile cards.
- Redesigns Create/Edit Profile as a landscape-first TV screen with a wide two-panel layout instead of a tall mobile form. Identity and the 10 avatars live on the left; themes, profile options and PIN live on the right; Save/Delete stay visible.
- Restores the requested theme order: **Swoop, Chill, Prime Time, Rewind**.
- Restores **Chill** as the black/red cinematic Netflix-style theme. The neon logo-driven default is now permanently identified as **Swoop**.
- Migrates v0.8.11–v0.8.12 profiles that stored the neon Swoop theme under the old `chill` ID to the new `swoop` ID without resetting profile data.
- Selected avatars now use a clear framed selection state with a check badge.
- Google TV PIN entry is now click-to-activate: D-pad navigation can pass the PIN area without opening the numeric keyboard; pressing OK on Set PIN / Change PIN explicitly enables the field.
- Preserves every cumulative v0.8.12 cache-first launch, provider, EPG, branding, compact-rail, Top 100, navigation and premium-control change.
- Android versionName is **0.8.13** and versionCode is **813**.


## v0.8.12 — Cached Launch + Compact Ranked Rails

- Google TV normal launches are now **cache-first**: when a valid saved Swoop TV library exists, Home opens from that saved library instead of re-downloading every enabled provider.
- A full provider download remains the one-time recovery/import path when no valid saved library exists; manual Provider **Refresh** continues to fetch fresh provider data on demand.
- App updates preserve and reuse the durable local catalogue/Home snapshot rather than forcing a network refresh simply because the app package changed.
- The full durable catalogue restores locally after Home is interactive, without redrawing the already-finished Home frame.
- Adds durable Android TV EPG reuse in IndexedDB. Programme-guide data prepared during the initial/import refresh can be restored on later launches instead of being discarded on every process restart.
- The preparation/restoration screen now uses the supplied Swoop TV logo with a **transparent background**, removing the black rectangle around the logo.
- Google TV Home poster rails are reduced again to a more compact 10-foot size and use **larger horizontal gaps** for clearer visual separation.
- Top 100 cards no longer render the fallback movie/show title underneath the ranking numeral.
- Top 100 rank numerals are offset across the **lower-left poster edge**, with a substantial portion outside the card rather than covering the artwork/title area.
- Non-ranked Home rows use the same compact poster geometry and spacing but have no rank numeral.
- Preserves the v0.8.11 Swoop neon default theme, premium TV controls, scroll-first Up navigation, supplied ten-avatar set, full Top 100 data, startup/EPG architecture, native Media3 playback and all earlier production cleanup.
- Android versionName is **0.8.12** and versionCode is **812**.

## v0.8.11 — Swoop Neon Theme + Premium TV Controls

- Reworks the default Swoop TV theme around the supplied neon logo: deep black surfaces with **hot magenta + electric cyan** accents.
- Keeps the legacy internal `chill` theme ID for profile/save compatibility while renaming the visible default theme to **Swoop — Neon signature**. Existing default-theme profiles automatically receive the new look.
- Adds a unified premium Google TV control system across Home / Live TV / Guide / Movies / TV Shows / My List navigation, Providers, Settings/profile utilities, hero/detail actions, filter/category tabs and secondary actions.
- Active/selected states use restrained theme colour; D-pad focus uses the active theme gradient and glow.
- Continue Watching **Remove** is compact and quiet at rest, with a polished destructive-red focus state.
- Theme colours drive provider/library progress, Guide current-programme highlighting, badges and watch-progress accents.
- Preserves v0.8.10 compact unified Home card sizing and scroll-first Up navigation, plus all earlier TV work.
- Android versionName is **0.8.11** and versionCode is **811**.

## v0.8.10 — Google TV Compact Rails + Scroll-First Navigation

- Corrects the v0.8.9 Home-card sizing inversion. The compact Top 100 card size is restored as the reference geometry, and all other poster-based Home rows now use that same compact size and alignment.
- Top 100 rows retain rank overlays; all non-ranked rows use the same title cards without rank numbers.
- Keeps the full 100-item Top 100 datasets and incremental 20-card D-pad expansion.
- Fixes Home Up-navigation: while Home is scrolled below the top, the top bar is excluded from spatial D-pad targets. Up moves through higher content rows or scrolls upward instead of jumping to Home in the navigation bar.
- The primary top navigation becomes focusable from Home content only once the page has returned to the top.
- Android versionName is **0.8.10** and versionCode is **810**.

## v0.8.9 — Google TV Rail Alignment + Full Top 100

- Fixes the Google TV header being clipped at the top edge by adding a TV-specific safe-area offset and wider safe horizontal padding.
- Standardises all poster-based Home rows to one TV card geometry: identical poster width, 2:3 ratio, gap and baseline.
- Top 100 rank numbers are now visual overlays only; they no longer shift the poster card away from the alignment used by other rows.
- Raises Android TV prepared Home-row data limits from 18/20 to 100 titles while retaining a 20-card initial render budget.
- Adds incremental D-pad rail expansion in 20-card chunks as the user approaches the right edge, so 100-item rows remain responsive.
- Top 100 Movies and Top 100 TV Shows are completed to 100 titles whenever the connected library contains enough titles, using provider-library fallback ranking when external popularity feeds do not match all 100.
- The Home row count now reflects the complete prepared data set rather than the initial render window, so Top 100 reports 100 available instead of 20 when 100 titles are present.
- Preserves v0.8.8 supplied profile avatars, v0.8.7 branding, v0.8.6 EPG startup preparation and the v0.8.5 ready-before-Home launch gate.
- Android versionName is **0.8.9** and versionCode is **809**.

## v0.8.8 — Supplied Profile Avatar Set

- Replaces the previous emoji/gradient profile avatars with the **10 user-supplied animal portraits**.
- Avatar order is **Lion, Elephant, Giraffe, Zebra, Rhino, Turtle, Monkey, Meerkat, Parrot, Tiger**.
- Uses the supplied artwork directly in profile selection, profile editing, profile switching, PIN screens, Settings and navigation.
- Existing profile IDs remain compatible; existing Lion/Elephant/Monkey/Tiger/Zebra/Giraffe/Rhino/Meerkat profiles automatically display the new supplied artwork.
- Adds Turtle and Parrot as new selectable profile avatars.
- Preserves v0.8.7 branding plus all v0.8.6 ready-at-launch/EPG and TV responsiveness work.
- Android versionName is **0.8.8** and versionCode is **808**.

## v0.8.7 — Supplied Logo Integration

- Integrates the user-supplied neon **Swoop TV** logo artwork as the canonical Google TV test branding asset.
- Replaces the previous generated/lettermark Android launcher icon with the supplied Swoop TV logo, centred on black.
- Updates the Google TV launcher banner to use the same supplied logo.
- Replaces the top-left SWOOP/TV text-and-lettermark treatment with the supplied Swoop TV logo.
- Adds the supplied logo above the launch-refresh / library-preparation progress UI, including the durable-library restore path.
- Updates the PWA icon/manifest and shell cache to include the supplied logo artwork.
- Preserves the v0.8.6 compact Home hero, gated provider refresh, EPG-ready-at-launch flow, test signing identity and stable Downloader code **3682231**.
- Android versionName is **0.8.7** and versionCode is **807**.

## v0.8.6 — Google TV Compact Hero + EPG Ready-at-Launch

### Google TV Home scale
- Reduces the Android TV Home hero from the v0.8.5 520px / 74vh treatment to a compact **300–355px / ~43vh** TV-first hero.
- Shrinks hero title/logo, description, vertical padding and the right-side poster/rotation art so substantially more Home content is visible without scrolling.
- Reduces the Home overlap offset to keep the first content row visually attached to the hero without consuming the screen.

### Programme guide / EPG
- Moves EPG preparation into the same gated startup refresh used for playlist/catalogue preparation. Home is not revealed until the app has checked and prepared the programme guide stage.
- Adds an Android-native **streaming XMLTV indexer**. Large Xtream/XMLTV feeds are parsed while streaming instead of transferring the entire XML document into the WebView and parsing it on the JavaScript UI thread.
- The native XMLTV path supports gzip feeds by both HTTP content encoding and gzip file signature.
- Only programme data for the user’s actual live-channel EPG IDs and the useful near-term viewing window is retained, keeping memory and WebView transfer size bounded.
- Startup progress now includes a dedicated **TV Guide** stage and continues moving while a large guide is being prepared.
- Prepared EPG entries remain fresh for the Google TV session for up to six hours, avoiding thousands of per-channel EPG requests immediately after startup.
- Opening Guide with a fresh launch-prepared EPG now uses the existing cache immediately instead of starting another visible guide load.
- Existing per-channel Xtream EPG requests remain as a fallback for providers/channels that do not expose usable XMLTV IDs.

### Android bridge
- Android bridge/user agent reports **0.8.6**.
- Direct provider text fetching now detects gzip by magic bytes as well as response headers and raises the direct-text safety ceiling to 128 MiB; full EPG uses the streaming index path instead.

### Build / update channel
- Android application ID remains `tv.swoop.player`; versionName is **0.8.6** and versionCode is **806**.
- Stable test signing is unchanged.
- The GitHub workflow continues to overwrite `Swoop-TV-v0.8.1-Google-TV-Test.apk` under `google-tv-test-v0.8.1`, preserving Downloader code **3682231**.

### Verification
- JavaScript syntax validation passes for `app.js` and the Android native bridge module.
- Android manifest/XML and GitHub workflow structure are validated during packaging.
- Existing v0.8.5 launch-refresh, Top 100 ordering, ready-Home gating, no-demo catalogue and TV responsiveness behaviour is preserved.

## v0.8.5 — Google TV Launch Refresh + Ready Home

- Google TV now gates entry to Home behind a complete launch refresh instead of showing a partially prepared library.
- After profile selection, Swoop TV displays a polished **Updating your TV library** screen with a real progress bar and stage text.
- Every refreshable enabled provider is downloaded at launch. If a provider is temporarily unavailable, the last successful saved library remains available as the fallback.
- Provider network requests on Android now use an asynchronous native bridge with chunked response transfer so downloads no longer block the WebView JavaScript thread for the full request duration.
- Xtream catalogue normalization now uses category maps instead of repeated category scans and yields between large item batches to keep the progress UI alive.
- The refreshed catalogue is saved once after all providers finish rather than repeatedly writing the full Android library after every provider.
- Home preparation happens before Home is shown. **Top 100 Movies** and **Top 100 TV Shows** are refreshed/prepared first. Other selected Home rows use their last successful discovery match or provider-local result during the same gate, avoiding dozens of serial recommendation requests at every launch.
- Discovery-to-library matching can run through the Android catalogue worker so Top 100 and curated row preparation does not monopolise the TV UI thread.
- Google TV builds a prepared Home-row cache during the launch gate, avoiding repeated full-catalog scans and large sorts when Home mounts.
- Top 100 rows have a local provider fallback if the online discovery source is unavailable, so the priority rows do not remain visibly empty.
- The first five Home row definitions are mounted on first render so Continue Watching, both Top 100 rows and both Recently Added rows are available immediately when present. Remaining row data is already prepared and is mounted on demand as D-pad navigation reaches it.
- Critical first-screen artwork is preloaded during the launch gate. Google TV no longer performs automatic post-Home row expansion or destination prewarming; remaining prepared rows are mounted only when navigation needs them.
- Automatic Android card-rating/metadata enrichment and hero enrichment are suppressed on the Home interaction path so optional metadata work cannot steal remote responsiveness.
- Preserves the v0.8.2 TV density/safe-area pass, v0.8.3 responsiveness fixes, v0.8.4 complete-frame/fallback presentation, v0.7.45 production cleanup and playlist-expiry support.
- Android application ID remains `tv.swoop.player`; versionName is **0.8.5** and versionCode is **805**.
- The stable Google TV test release alias remains `Swoop-TV-v0.8.1-Google-TV-Test.apk`, preserving Downloader code **3682231**.

# v0.8.4 — Google TV Instant UI + Invisible Background Work

- Makes responsiveness and complete-frame presentation a first-class Google TV rule: unfinished data work is not rendered as blank rails, skeletons or loading pages.
- Adds a compact persisted TV Home snapshot so repeat launches can open from a fully prepared cached slice while the full catalogue restores silently.
- Adds a three-chunk IndexedDB preview fallback for upgrades that do not yet have a v0.8.4 Home snapshot.
- Restores the complete durable catalogue behind the profile picker/Home without forcing a visible loading route or a Home rerender.
- Adds a persistent background catalogue Web Worker for large-library indexing. The catalogue is transferred to it in small idle-time chunks and the prepared movie stack is returned in bounded chunks, avoiding giant structured-clone handoffs on the WebView UI thread.
- Large-library Search and People/filmography matching can execute against the worker index rather than synchronously scanning/matching the full catalogue on the UI thread.
- Google TV People routes now use complete-frame navigation: the current finished page remains visible while remote person data and local filmography matches are prepared; only a finished result route is swapped on-screen.
- Google TV People Search no longer exposes a visible search spinner while remote person results are being prepared.
- Opportunistically prewarms a bounded set of Xtream EPG results and likely Home/detail artwork/data after Home is interactive, using low-concurrency/idle-time work.
- TV Guide rows no longer show programme-guide loading placeholders on Google TV; cached/prewarmed programme data is patched in without blocking remote input.
- Google TV Home renders only ready rows; web/discovery rows with no cached matches and lazy skeleton placeholders are omitted rather than exposed unfinished.
- Poster cards always retain a readable title fallback on Google TV, so slow artwork decoding cannot leave blank colour tiles.
- Series/movie detail selection prewarms on focus and, on Google TV, keeps the previous complete screen visible until detail/provider data is ready; the user never lands on a half-built detail route.
- Automatic heavy discovery, metadata and browse warmup work remains suppressed on the TV interaction path; the UI thread is reserved for remote input and rendering.
- Preserves the stable Downloader release URL/code 3682231 and test signing identity.

# Swoop TV Android TV Release Notes

## v0.8.3 — Google TV Startup Responsiveness

- Fixes the first large-library Google TV hardware stall: the profile picker could appear frozen for roughly a minute and Home could become unresponsive after entry.
- Android TV no longer performs a full automatic provider refresh before the interface is usable. Provider refresh remains available from Provider management.
- Profile selection now enters Home immediately and restores a large saved library behind a lightweight loading state instead of blocking the profile screen.
- Home is explicitly reset to the top on profile entry, preventing stale WebView scroll restoration from opening halfway down the page.
- Adds a Google TV large-library Home fast path that avoids synchronous full-catalog movie/live stacking during initial rendering and card lookup.
- Only three Home rows are mounted eagerly on large Android TV libraries, with 18 standard / 20 ranked cards per mounted row to keep D-pad geometry work bounded.
- Automatic discovery matching is deferred on the TV large-library fast path so background catalogue work cannot immediately monopolize the JavaScript thread.
- D-pad focus scrolling is immediate rather than smooth on Android TV.
- Preserves v0.8.2 density/safe-area sizing and all v0.8.1 native playback/remote integration.
- Android version is 0.8.3 / versionCode 803.
- The stable Downloader asset path is unchanged, so code **3682231** remains valid.

## v0.8.2 — Google TV Density + Safe-Area Pass

- Corrects the oversized first Google TV hardware build where navigation, options and settings could extend off-screen.
- Changes the Android TV HTML viewport from device-width to a fixed 1440px logical TV canvas.
- Enables WebView `setUseWideViewPort(true)` and `setLoadWithOverviewMode(true)` so the logical TV canvas is fitted to the physical display width.
- Removes the v0.8.1 108% Android TV font enlargement and moves to a compact 92% TV root size.
- Reduces TV-specific top bar, hero, rail/card, page header, Search, Settings, modal/provider, title-detail, episode, cast and Guide sizing.
- Reduces focused-card growth from 8.5% to 4.5% while retaining high-contrast D-pad focus rings.
- Keeps dialogs within 84% of viewport height with internal scrolling so action rows remain reachable.
- Preserves all v0.8.1 native playback, Android Back, D-pad, provider-fetch and renderer-recovery work.
- Preserves all v0.7.45 playlist-expiry, no-demo and production-cleanup behaviour.
- Android version is 0.8.2 / versionCode 802.
- GitHub Actions publishes both the versioned v0.8.2 APK and a stable compatibility alias at the existing v0.8.1 release URL so Downloader code **3682231** remains valid.

## Previous Android TV test notes

## v0.8.1 — Google TV Hardware Test — 26 August 2026

- Builds the Google TV / Android TV shell from the v0.7.45 Production Polish + Playlist Expiry web baseline.
- Application ID remains `tv.swoop.player`; versionCode 801 / versionName 0.8.1; minSdk 23; target/compile SDK 36.
- Embeds the existing Swoop TV HTML/CSS/JavaScript interface rather than rebuilding the product UI natively.
- Adds Google TV / Leanback launcher support, landscape immersive mode, TV icon/banner and cleartext HTTP IPTV compatibility.
- Adds a secure Android WebView app-assets origin, renderer-crash recovery, spatial D-pad navigation, 10-foot focus treatment and Android Back integration.
- Adds Android-native Media3 1.11.0 playback for Live TV, movies and episodes, including remote play/pause, seeking and live stream switching.
- Adds Android-native Xtream/M3U/XMLTV fetching to avoid browser CORS restrictions and support HTTP provider endpoints.
- Preserves v0.7.45 playlist expiry, production-copy cleanup and true empty-library behavior with no bundled dummy channels/movies/shows.
- Adds a GitHub Actions workflow that produces a debug-signed `Swoop-TV-v0.8.1-Google-TV-Test.apk` for sideload testing.
- Full v0.7.45 JavaScript test suite passes after the Android integration changes.

## v0.7.45 — Production Polish + Playlist Expiry

- Adds an **Expiry** field to connected provider details. Xtream expiry data is stored on connection and refreshed with the provider account.
- Removes all bundled demo channels, movies, TV shows and the sample M3U playlist. With no connected provider, Swoop TV now presents an empty library.
- Purges legacy demo references from saved catalogues, profiles and native Windows library state so sample content cannot return after upgrading.
- Removes customer-facing development/source attribution and over-explained implementation copy across Home, Search, Settings, provider setup, loading states and playback.
- Keeps the v0.7.44 People Search hotfix intact.

## v0.7.44 — People Search Black-Screen Hotfix

- Fixes the black/frozen screen that could occur when selecting an actor, actress or director directly from global Search.
- The problem was a navigation return-value bug: Swoop TV detached and preserved the Search page, but the suspension helper returned `undefined`; People Search interpreted that as failure and returned before rendering the person page, leaving the app container empty.
- The base-view suspension helper now returns explicit `true` / `false` status and safely rolls back if detaching fails.
- People-route opening now has an additional guarded render fallback that restores the preserved Search or title-detail view if an unexpected render exception occurs.
- Existing person credits, local provider matching, persistent Search state and Back navigation are preserved.
- No provider refresh, SQLite rebuild, Cloudflare Worker redeploy, profile reset or playback change is required.

## v0.7.43 — Continue Watching + Home Layout Recovery

- Fixes the **Remove from Continue Watching** control across normal rendering, lazy Home rows and persistent/restored views.
- Episodic Continue Watching cards pass their parent-series identity directly to removal, ensuring the whole in-progress series disappears when requested.
- Continue Watching removal now uses delegated event handling and invalidates a detached cached Home snapshot when needed, preventing removed titles from reappearing after navigation.
- Home layout reconciliation now runs on startup and whenever a profile is applied. This repairs profiles that were missing part of the agreed curated layout even if an older build had already marked its Home schema current.
- Restores and locks the complete 28-row Snoak sequence, keeps **Recently Added Movies / TV Shows** above it, and keeps **Recommended For You / My List** at the bottom. Previously approved Home removals remain removed.
- Preserves unrelated custom/optional rows.
- No provider refresh, SQLite rebuild, Cloudflare Worker redeploy, profile reset, watched-history reset or playback change is required.

## v0.7.42 — Persistent Views + Browse Prewarm

- **Tabs stay loaded:** top-level Home, Live TV, Guide, Movies, TV Shows, My List, Search and Settings views are detached and retained in memory rather than destroyed when navigating to another tab. Returning restores the same DOM, loaded poster images, horizontal rail scroll positions and vertical page position.
- **No routine re-hydration on Back/tab return:** already-loaded artwork keeps its resolved image/object URL and does not go back through gradient placeholders simply because the user visited another screen.
- **Background browse prewarm:** after Home settles, Swoop TV quietly fetches the first provider categories/rails for Live TV, Movies and TV Shows and warms a bounded set of artwork URLs. First entry into those tabs therefore starts from populated caches rather than a cold SQLite/artwork path.
- **Targeted resume work:** restoring a cached page only resumes missing lazy rows/EPG/category jobs; it does not rebuild the whole screen.
- **Safe invalidation:** persistent views are cleared when the provider catalogue/index changes or when the user switches profile, so cached UI cannot survive a different library/profile context.
- No Cloudflare Worker redeploy, provider refresh, SQLite rebuild, watched/resume reset or playback change is required.

## v0.7.41 — Home New & Hot Cleanup

- Removes **New & Hot Movies** and **New & Hot TV Shows** from the Home screen.
- Bumps the Home layout schema so existing profiles drop those rows automatically on first launch of v0.7.41.
- Keeps **Recently Added Movies** and **Recently Added TV Shows** as the provider-recency rows near the top of Home.
- Preserves all v0.7.40 Continue Watching removal controls and all existing Snoak daily rails.
- No provider refresh, SQLite rebuild, Cloudflare Worker redeploy, watched/resume reset or playback change is required.

## v0.7.40 — Continue Watching Remove Control

- Adds an always-available **Remove** button to each title card in the Home **Continue Watching** rail.
- Removing a movie clears only that movie's resume entry; removing an episodic card clears the in-progress entries for that parent TV series so the show leaves Continue Watching cleanly.
- Movie/TV detail pages now also show **Remove from Continue Watching** whenever that title currently has an in-progress entry.
- Removal is profile-scoped and persists immediately without marking the title watched, deleting viewing history, changing My List, or altering provider/SQLite catalogue data.
- When the last Continue Watching item is removed, the now-empty Home row disappears immediately instead of leaving stale UI behind.
- No Cloudflare Worker redeploy, provider refresh, SQLite rebuild, profile reset or playback change is required.

## v0.7.39 — Automatic Launch Provider Refresh

- Adds a launch gate that refreshes enabled TV providers with reusable saved credentials/URLs before Swoop TV exposes the profile picker or any catalogue UI.
- The first visible app screen is now a dedicated **Refreshing your TV library…** progress screen with live percentage and provider-stage messaging.
- The previous durable/SQLite catalogue may be restored behind the launch gate only as a safety fallback; it is not displayed before the provider refresh finishes.
- Xtream providers with saved server/username/password and URL-backed M3U providers refresh automatically on every app launch.
- Successful refreshes replace that provider's catalogue and native SQLite rows before browsing starts.
- If a provider is temporarily offline or its refresh fails, Swoop TV keeps the last saved catalogue for that provider so the app remains usable instead of opening empty.
- Local-file-only M3U providers cannot be re-downloaded automatically and continue using their saved library.
- Multi-provider launches refresh enabled providers sequentially with one overall progress percentage.
- No Cloudflare Worker redeploy, profile reset, watched/resume reset or playback change is required.

## v0.7.38 — Faster Browse Artwork Hydration

- Speeds up poster population across Home, Movies and TV Shows rails, especially large-library rows that previously sat on gradient placeholders while visible.
- Visible and near-visible movie/TV cards now request full TMDb metadata when the provider item has no usable poster, instead of performing only the lightweight IMDb-rating lookup.
- Poster/IMDb metadata patches the existing card in place; rows are not rebuilt and horizontal scroll position is preserved.
- Visible artwork is promoted to eager/high-priority loading and the artwork observer prefetches substantially farther ahead both vertically and horizontally.
- Mixed-content/provider artwork relay concurrency increases from 3 to 8 jobs in large-library Auto mode (6 to 12 in Full Cinematic), while high-priority visible jobs jump ahead of background artwork.
- If a provider poster URL fails, Swoop TV can force one metadata repair lookup and substitute TMDb artwork rather than leaving the card permanently on a gradient.
- Viewport metadata concurrency increases from 2 to 4 in large-library mode and unnecessary per-card delay is reduced, while work remains bounded to visible/near-visible cards rather than the whole catalogue.
- No Cloudflare Worker redeploy, provider refresh, SQLite rebuild, profile reset, watched/resume reset or playback change is required.

## v0.7.37 — Faster Detail Hydration

- Starts TMDb metadata and Xtream movie/series detail requests before the first detail-screen paint so network work overlaps the immediate route transition instead of beginning afterward.
- Adds detail prewarming on title-card hover, keyboard focus and touch-start. The active Home hero also prewarms its provider movie/series payload.
- Adds a shared in-flight provider-detail cache so prewarm and click never duplicate the same Xtream request.
- Full TMDb metadata no longer blocks on MDBList IMDb rating retrieval. The Worker returns poster/backdrop/title-logo/plot/cast metadata as soon as TMDb responds; IMDb ratings continue through the existing dedicated lightweight background route.
- Fresh cinematic metadata is no longer re-requested solely because its IMDb rating cache is stale; rating refresh is queued independently.
- Existing metadata/detail caches continue to work. No provider refresh, SQLite rebuild, profile reset, watched/resume reset or playback change is required.
- Cloudflare Worker advances to **v0.1.21** / metadata parser **0.4.8**. Redeploy is recommended to remove MDBList latency from the full metadata route.

## v0.7.36 — Crunchyroll TV Title Cleanup

- Adds Crunchyroll provider/source aliases to TV/movie title cleanup: `CR`, `Crunchyroll` and `Crunchy Roll`.
- Fixes provider titles such as `CR - Mushoku Tensei: Jobless Reincarnation` leaking the `CR -` source prefix into Home/detail hero titles and blocking clean TMDb title-logo lookup.
- The same cleanup is used by display titles, metadata requests, strict identity matching and the Cloudflare Worker; raw provider names remain unchanged for source/provider contexts.
- Title lookup schema advances to **4**, so stale pre-v0.7.36 no-logo cache entries for Crunchyroll-prefixed titles retry automatically once.
- Cloudflare Worker advances to **v0.1.20** / metadata parser **0.4.7** for server-side parity. Redeploy is recommended, but the client performs the corrected cleanup itself.
- No provider refresh, SQLite rebuild, watched/resume reset, Home-layout reset or playback change is required.

## v0.7.35 — Curated Home + Snoak Daily Rails

- Rebuilds the default Home row sequence around a tighter discovery hierarchy while preserving the existing hero, Continue Watching and Top 100 ranked rails.
- Removes **Recently Watched**, **Recent Channels**, **Trending Now — Movies**, **Trending Now — TV Shows**, **Live Now**, **Top Rated Movies**, **Top Rated TV Shows**, **Action Movies**, **Comedy Movies** and **Drama TV Shows** from the active Home layout. Their underlying history/live/metadata/catalogue systems remain intact.
- Keeps **New & Hot Movies**, **New & Hot TV Shows**, **Recently Added Movies** and **Recently Added TV Shows** immediately below the pinned Continue Watching / Top 100 rows.
- Adds 28 Snoak/MDBList Home rails in the requested fixed order: latest Netflix, Amazon Prime, Apple TV+, HBO Max, Disney+, the requested second HBO Max row, Latest Mini Series, Popular K-Drama, Trending Anime, then paired Popular Action / Animated / Comedy / Documentary / Drama / Horror / Romance / Sci-Fi / Thriller movie/show rails plus Popular Reality Shows.
- Snoak rails are strict availability intersections: external list order decides ranking, but only titles confidently matched to the enabled provider library are rendered. Existing strict title/year/TMDb/IMDb identity protections remain in force.
- **Recommended For You** and **My List** are retained but locked to the bottom of Home, below the curated Snoak block and any additional optional/custom rows.
- Existing profiles are migrated once to the new Home layout without touching provider credentials, watched/resume state, My List contents, profile themes or SQLite catalogue data. Custom/optional rows not explicitly removed are preserved between the Snoak block and the two bottom rows.
- Advances the discovery schema so old cached row identities are refreshed cleanly for the new Snoak rails.
- Cloudflare Worker **v0.1.19** expands the Snoak allow-list with the platform/latest/miniseries/K-Drama/anime feeds and Popular Romance Shows. Redeploy is required for the new curated Home rails to populate from Snoak.
- No provider refresh or SQLite rebuild is required.

## v0.7.34 — TV Hero + Title Logo Reliability

- Fixes remaining TV-series title-logo failures caused by chained quality/provider prefixes including `4K-MAX -`, `4K-NF -`, `4K-AMZ -` and Disney shorthand such as `D+ -`.
- Title cleanup now repeatedly strips leading quality markers, provider/service tags and separator ornaments before strict title/year identity matching. Decorative market suffixes such as `(US)` / `(FR)` are removed from the search/display title while the release year remains a hard identity constraint.
- Home hero presentation now uses the same **logo-first** policy as title detail pages: raw provider titles are hidden while logo metadata is being resolved; a cleaned text fallback appears only after Swoop TV has confirmed that no usable title logo exists.
- The currently visible Home hero is now the first metadata-enrichment target, including in large-library Auto mode. Rotating to another hero triggers immediate enrichment and patches the title/logo in place when the lookup completes.
- Previously cached no-logo results created by the older one-prefix parser automatically retry once through title-lookup schema 3. No provider refresh or SQLite rebuild is required.
- The bundled Cloudflare Worker advances to **v0.1.18** / metadata parser 0.4.6 and mirrors the same chained-prefix cleanup. Redeploy is recommended for complete server-side parity, while the client also sends the cleaned title itself.
- Existing Continue Watching poster fixes, People search, category rails, EPG, Snoak discovery, strict wrong-release protection, IMDb hydration and Windows/mpv playback remain unchanged.

## v0.7.33 — Continue Watching Series Poster Fix

- Fixes TV episodes in **Continue Watching** using episode screenshots/stills as the large poster artwork.
- Continue Watching episode cards now prefer the provider's season poster when the Xtream series payload supplies one, then fall back to the parent series poster. Episode thumbnails remain available inside the episode list itself.
- The card still resumes the exact saved episode and keeps the `Sx Ex` label/progress bar; only the Home artwork/title presentation changes.
- TV Continue Watching cards let the poster artwork carry the series title rather than overlaying the episode name over the poster.
- Episode snapshots now retain `seasonPoster`, `seriesPoster`, `seriesBackdrop` and `seriesTitle` so the correct artwork survives app restarts and profile persistence.
- Existing saved episodes are repaired by hydrating their `parentSeriesId` alongside the episode entry in native/SQLite mode, so no provider refresh or SQLite rebuild is required.
- Movie Continue Watching, watched/resume semantics, episode playback, provider data, category rails, TV Guide/EPG and Windows/mpv playback behavior remain unchanged.

## v0.7.32 — People Search

- Expands global Search beyond titles/channels/categories to include **actors, actresses and directors**.
- Adds a dedicated horizontal **People** result rail above normal catalogue results, with TMDb profile image, department and known-for titles.
- Clicking a person opens the existing Swoop TV person/filmography route directly from Search; Back restores the exact Search screen and query state.
- People results are discovered through the owner-managed TMDb Worker, while the resulting filmography is still strictly intersected against the user's enabled provider library before anything is shown as available.
- Person filmography handling now understands both acting and directing identities: people known for Acting use cast credits; people known for Directing use directing/crew credits.
- Search remains local/SQLite-first for Movies, TV Shows and Live TV; remote people search is a separate lightweight request and does not broaden or replace provider catalogue matching.
- Cloudflare Worker **v0.1.17** adds the `person-search` route. Redeploy is required for People results to appear in Search. No provider refresh, SQLite rebuild, profile reset, watched/resume reset or playback change is required.

## v0.7.31 — Movies + TV Category Rails

- Reworks the **Movies** and **TV Shows** landing pages to use the same category-first browse model as Live TV: provider category heading followed by a horizontal swipe rail of titles.
- Movie and TV category rows follow the exact order returned by each Xtream provider's `get_vod_categories` / `get_series_categories` APIs. Multi-provider ordering respects Swoop TV provider priority and preserves the first occurrence of overlapping category names.
- M3U/provider categories that do not expose an Xtream category endpoint retain first-seen provider order rather than being alphabetically rearranged.
- Windows/SQLite mode loads only **18 titles per visible category**, with **10 categories initially mounted**. **Load more categories** adds another 10 rows at a time instead of hydrating the entire movie/show catalogue.
- Native category queries are limited and concurrent, then patch only the completed rail in place. This keeps horizontal scroll positions stable and avoids the full-page rerender behavior of the old giant grid.
- Existing movie source stacking remains intact inside category rails; TV shows keep their existing provider identities. Poster artwork, gold IMDb badges and detail navigation continue to use the current metadata system.
- Future Xtream refreshes persist provider category ID/order on Movies and TV Shows as well as Live TV. Existing catalogues do **not** require a refresh because the tab fetches provider category order live and caches it for ten minutes.
- The dedicated Category-First **TV Guide/EPG is unchanged**, as is the Live TV landing page from v0.7.30.
- No Cloudflare Worker redeploy, provider refresh, SQLite rebuild, watched/resume reset or playback-profile change is required.

## v0.7.30 — Live TV Category Rails

- Reworks the **Live TV landing page only** into provider-category rows inspired by modern mobile TV apps: category name first, then a horizontal swipe rail of channel tiles.
- The existing **TV Guide remains exactly the dedicated EPG view** designed in v0.7.23–v0.7.27; no Guide layout or programme-grid behavior is changed.
- Provider category order is reused from the existing provider-order logic rather than alphabetically rearranging the Live TV landing page.
- Favourite Channels and Recent Channels remain above the provider-category rows.
- Live channel tiles use a compact logo-first presentation with the channel name beneath, while every v0.7.29 stream remains independently selectable/playable.
- Windows/SQLite mode loads only **18 channels per visible category rail**, with at most 10 categories mounted initially. **Load more categories** adds another 10 rows at a time. This avoids hydrating thousands of Live TV streams just to open the Live tab.
- Native category-rail requests run with a small concurrency limit and patch only the completed rail in place, avoiding full-page rerenders and preserving horizontal scroll position.
- Provider filtering is retained and resets the visible category batch cleanly.
- No provider refresh, SQLite rebuild, Cloudflare Worker redeploy, EPG change, metadata change, watched/resume reset or playback-profile change is required.

## v0.7.29 — Separate Live Streams

- **Live TV no longer collapses duplicate-looking channels.** Every provider stream remains a separate Live TV entry even when another stream has the same channel name, category/group or EPG/tvg-id.
- This applies to the Live TV hub, category browsing, TV Guide, search, favourites/recent-channel hydration and native SQLite queries. Alternate HD/FHD/4K/provider endpoints are therefore independently selectable/playable.
- Windows native SQLite queries now treat Live TV as raw stream rows instead of logical-channel stacks. Existing v0.7.28 databases work immediately; **no provider refresh or SQLite rebuild is required**. Future imports also write per-stream Live TV logical identities.
- TV Guide category counts and Settings Live counts now reflect actual separate stream entries rather than deduplicated logical channels.
- Movie/VOD source stacking is unchanged. Similar movie sources can still be grouped for Smart Source Selection; this change is Live-TV-only.
- Existing provider ordering, EPG retrieval, Category-First Guide, Snoak discovery, metadata/IMDb handling, watched/resume state and Windows/mpv playback profile are preserved.

## v0.7.28 — Brand Lockup Cleanup

- Fixed the navigation/profile brand lockup displaying **SWOOP TV TV**.
- The lockup now renders **SWOOP TV** once, retaining the existing smaller accent treatment for **TV**.
- Branding-only change; no provider, Guide, metadata, SQLite, profile, watched/resume or playback behavior changes.
- Automated tests and JavaScript syntax checks pass; ZIP integrity is verified.

## v0.7.27 — TV Guide Header Clipping Hotfix

- Fixed the category-first TV Guide header overlaying/clipping the first channel row.
- Root cause: `.guide-header` still carried the legacy `top: 74px` sticky offset from the old full-width Guide. Once v0.7.23 placed the grid inside `.guide-grid-scroll`, that offset became relative to the guide's own scroll container and created a 74px internal gap over the first row.
- The guide grid now owns a `position: relative` context and its header uses `position: sticky; top: 0`, keeping the Channels/time bar flush to the top of the grid without covering the first channel.
- No EPG, provider-category, SQLite, metadata, playback, profile or watched/resume behavior changes.
- Automated tests and JavaScript syntax checks pass; ZIP integrity is verified.

## v0.7.26 — Provider-Order Guide + EPG Repair

- TV Guide category navigation now follows the exact order returned by each enabled Xtream provider's `get_live_categories` endpoint. Multi-provider order respects Swoop TV provider priority, deduplicating repeated category names while preserving first occurrence.
- Existing native catalogues do not need a rebuild for the ordering fix: the Guide fetches provider category order live on entry and caches it for ten minutes. New/refreshed Xtream imports additionally save `providerCategoryId` / `providerCategoryOrder` on live channels so SQLite has a persistent provider-order fallback.
- Native SQLite category aggregation no longer sorts categories by channel count. It now prefers stored provider category order, then first-seen database order.
- Fixes Xtream short-EPG compatibility by sending the standard `limit` parameter. v0.7.25 sent `epg_limit`, which some Xtream panels accept poorly or ignore.
- EPG retrieval now uses three levels: `get_short_epg` → `get_simple_data_table` → authenticated provider `xmltv.php` fallback. The XMLTV fallback is used only when the lightweight APIs return no programme data for the selected category.
- Xtream XMLTV is cached for ten minutes and filtered to the category's currently loaded channels before rows are updated.
- Windows bridge v0.7.26 adds `/native/xtream-xmltv`. Cloudflare Worker **v0.1.16** adds a token-protected `mode: xmltv` relay and now permits the standard Xtream `limit` parameter.
- Category-first 48-channel paging, progress feedback, playback, Snoak discovery, metadata/IMDb behavior, profiles, watched/resume state and source stacking are unchanged.
- Automated tests and JavaScript syntax checks pass; ZIP integrity is verified.

## v0.7.25 — Provider-Prefix TV Logo Repair

- Fixes title-logo enrichment for TV-provider names whose service tag is wrapped in punctuation, including the confirmed patterns `-MAX - Lanterns`, `-AMZ - Reacher`, `-A+ - Ted Lasso` and `-NF - Stranger Things`.
- Leading separator ornaments are stripped before source-prefix parsing. `A+`, `Apple TV+` and `AppleTV+` are now recognised aliases alongside the existing Max, Amazon and Netflix tags.
- The corrected cleanup is shared by visible fallback titles, client metadata requests, strict metadata identity comparison and the bundled Worker, so a provider tag can no longer prevent an otherwise valid TV logo lookup.
- Adds title-lookup cache schema v2. Affected v0.7.24 entries that recorded “no logo” under the broken provider-prefixed query retry automatically when next viewed; confirmed new results are cached normally. Temporary network errors do not mark the corrected retry complete.
- Strict year identity remains mandatory. This repair does not reintroduce the Odyssey-style wrong-release fallback.
- Bundled Cloudflare Worker **v0.1.15** mirrors the new provider-prefix parser and identifies itself with metadata user-agent 0.4.5. Redeploy is recommended for complete server-side parity.
- No provider refresh, SQLite rebuild, profile reset, watched/resume reset or playback change is required.

## v0.7.24 — TV Title Logo Reliability

- Fixed TV-show title-logo enrichment failing on common Xtream/provider series names such as `Lioness (2023) (US)`. Swoop TV now removes chained market/language/year suffixes from the metadata search title while preserving the provider year as a strict match constraint.
- Detail pages now use a **logo-first title slot**: provider/raw title text stays hidden while the logo lookup is unresolved, a lightweight placeholder holds the layout, and the cleaned text title is shown only after Swoop TV has confirmed that no usable title logo is available.
- Existing metadata cache entries without an explicit title-logo lookup result retry once automatically, so TV shows cached by older builds are repaired without a provider refresh or SQLite rebuild.
- Title-logo requests load immediately rather than waiting for normal artwork lazy-loading. Final artwork failure safely reveals the cleaned text fallback.
- Artwork fallback handling is hardened so a failed relay cannot recurse indefinitely.
- `cleanDisplayTitle` now also turns names like `Lioness (2023) (US)` into `Lioness` for fallback presentation without weakening title/year identity matching.
- Bundled Cloudflare Worker **v0.1.14** mirrors the same series-name cleanup. Redeploy is recommended for server-side parity, but the v0.7.24 client sends a cleaned title + extracted year and therefore works with the already deployed v0.1.13 Worker.
- Existing Category-First TV Guide, Snoak discovery, Top 100 rails, strict discovery matching, IMDb hydration, provider data, watched/resume state and Windows/mpv playback are unchanged.

# Swoop TV Release Notes

## v0.7.23 — Category-First TV Guide

- Rebuilds the TV Guide around the provider's **live channel categories** instead of a single massive channel list.
- Adds a left-side category navigator with channel counts. Selecting a category populates that category's channel logos in the middle and the three-hour EPG schedule on the right.
- Native Windows/SQLite mode now queries only the selected live category. The initial guide page is limited to 48 channels and **Load more** adds 48 at a time, avoiding hydration/EPG work for thousands of off-screen channels.
- Keeps **All Channels** as an option, but it uses the same paged 48-channel window rather than loading the full provider catalogue.
- EPG loading is scoped to the currently displayed category channels, so progress percentages describe the work actually being performed.
- M3U/XMLTV source documents are cached for ten minutes and then filtered per selected category. Switching groups does not repeatedly redownload the full XMLTV file, and categories not previously viewed can still receive EPG data.
- Expands native live-category discovery from 60 to 200 groups so large providers expose substantially more of their own category structure.
- Preserves channel logos, current-program highlighting, Jump to Now, channel playback, provider source behavior, existing EPG cache entries and v0.7.18 long-task feedback.
- No Cloudflare Worker redeploy, provider refresh, SQLite rebuild, discovery reset, watched/resume reset or playback change is required.

## v0.7.22 — Snoak Daily Discovery

- Promotes a curated set of **Snoak's actively maintained MDBList lists** to Swoop TV's primary external ranking layer while keeping the provider catalogue as the sole source of playable titles.
- **Top 100 Movies / TV Shows** now blend Snoak's JustWatch, Television Stats, IMDb, Rotten Tomatoes and Trakt lists ahead of the existing TMDb/official fallback signals.
- **Trending Now** prioritises Snoak Trakt Trending + JustWatch + Television Stats. **New & Hot** prioritises Latest Streaming Movies / Latest Shows, with the movie rail also using Trakt's digital-release trending list. **Popular on Streaming** prioritises Snoak's JustWatch list.
- Adds Snoak-backed ranking to selected existing genre rails: Action, Animation, Comedy, Crime TV, Drama, Horror Movies, Reality TV, Romance Movies, Sci-Fi and Thriller. The rows still show only local provider matches and fall back to Swoop TV's existing local genre filter if the web source is unavailable.
- Adds a Worker-side **allow-list** for public Snoak list slugs. Clients cannot request arbitrary MDBList usernames/lists through the owner service.
- The Worker asks MDBList for list metadata as well as items. When MDBList exposes an update timestamp and it is more than **8 days old**, Swoop TV rejects that source and uses its fallback instead of presenting stale data as current.
- MDBList requests are cached for six hours at the Worker edge to keep owner API usage modest; end users still do not need an MDBList key.
- Strict title/year/ID matching from v0.7.19 remains mandatory when intersecting Snoak candidates with the TV-provider library. Discovery never writes external IDs back onto provider catalogue items merely because a ranked list matched.
- Cloudflare Worker **v0.1.13** adds the Snoak discovery source and the allow-listed `snoak-list` route. Redeploy the bundled Worker to activate this release's discovery changes.
- No provider refresh, SQLite rebuild, profile reset, watched/resume reset or playback change is required.

## v0.7.21 — Cast Library Browsing

- Makes every cast portrait/name on movie and TV detail pages clickable.
- Selecting a cast member opens a dedicated filmography page showing only that actor/actress's **movies and TV shows that are actually available in the enabled Swoop TV provider library**.
- Uses TMDb person/combined-credit identity, then reuses Swoop TV's strict local title/year/ID matching rather than treating the online filmography as playable content. Wrong-year or ambiguous titles are not shown as local matches.
- Native Windows/SQLite builds can match up to 800 movie credits and 800 TV credits per person, matching the Worker’s 800-credit filmography cap. Browser-mode libraries use the same strict local matcher.
- Adds visible staged progress while Swoop TV resolves the person, loads filmography credits and matches Movies/TV Shows to the provider catalogue.
- Preserves navigation state in both directions: Back from a cast page restores the exact original title detail; opening a title from the cast page and pressing Back restores the exact cast page and scroll position.
- Existing metadata caches without TMDb person IDs remain usable: the Worker can resolve a cast member by exact name until refreshed metadata supplies the person ID.
- Cloudflare Worker **v0.1.12** adds the `person-credits` route and includes TMDb person IDs in future cast metadata. Redeploy the bundled Worker for cast browsing to work.
- No provider refresh, SQLite rebuild, discovery reset, watched/resume reset or playback change is required.

## v0.7.20 — Branding Consistency

- Standardises the visible product name as **Swoop TV** throughout the app. Short-form user-facing product-name references now read **Swoop TV**.
- Updates long-task/progress copy such as **SWOOP TV IS WORKING**, **Still running — Swoop TV has not frozen**, provider refresh/indexing messages, connection-helper text and local catalogue status messages.
- Updates user-facing native Windows bridge/bootstrap messages, player/dialog labels, storage/service errors, sample/demo labels and bundled documentation to use the full **Swoop TV** brand.
- Keeps lowercase implementation identifiers such as `swoop-tv-*` storage/cache keys, `x-swoop-token`, CSS/data attribute names and local filenames unchanged because they are technical identifiers rather than visible brand copy.
- Branding-only release: no provider refresh, SQLite rebuild, discovery reset, metadata change, watched/resume change or Windows/mpv playback change is required.

## v0.7.19 — Ranked Rail Stability + Strict Discovery Matching

- Fixes the Top 100 horizontal rails jumping/bouncing back toward rank 1 while the user is scrolling. Mounted rails now record active horizontal interaction and defer asynchronous row replacement instead of swapping the entire rail under the pointer/trackpad.
- Ranked rails disable CSS scroll snapping and forced smooth scrolling, giving mouse wheel, trackpad and drag input direct native horizontal movement without the jagged snap-back behavior shown in the screen recording.
- Expands Top 100 discovery depth substantially. The client scans up to 600 candidates per blended source, the native SQLite matcher accepts up to 800 candidates, and the Worker supplies a multi-page TMDb popularity pool rather than only the first 20 results.
- If a blended Top 100 result still has fewer than 100 local matches and MDBList is configured, Swoop TV supplements it from the full official MDBList popularity list and keeps the original blended order first.
- Discovery matching now follows the same identity rule as metadata matching: when a web candidate has an explicit year, title matches require that exact year. ID matches are also rejected when both sides have conflicting years.
- Discovery matching no longer writes TMDb/IMDb IDs back onto provider catalogue items merely because a title candidate matched, preventing a discovery guess from contaminating later metadata resolution.
- Fixes the `Odyssey (2025)` / `The Odyssey (2026)` case at the ranked-list matching layer, not just at the artwork/metadata layer.
- Advances the ranked-discovery cache schema once so stale pre-fix Top 100 rows are discarded, including the auxiliary native cache. Provider credentials, SQLite catalogue, profiles, watched/resume state and playback data are preserved.
- Cloudflare Worker v0.1.11 adds deeper multi-page TMDb popularity discovery. Redeploying the bundled Worker is recommended for the fullest Top 100 pool; the client-side strict matching and rail-stability fixes work immediately with the app update.

## v0.7.18 — Visible Progress + Long Task Feedback

- Adds a consistent long-task feedback system so users are never left with only a spinner or the word “Refreshing…” during work that can take several seconds or minutes.
- Provider refresh cards now show a live **percentage, moving progress bar and plain-language stage** while Swoop TV contacts the provider, downloads sections, indexes SQLite and saves the refreshed library.
- **Refresh All** shows an overall persistent progress HUD with current provider, overall percentage and elapsed time; it remains visible even if the Provider Manager is not the only thing on screen.
- Provider connection retains its existing step list but now adds a numeric percentage beside the progress bar. Large-library restore also displays its calculated percentage beside restored/indexed item counts.
- TV Guide loading now reports channel-by-channel progress and fills rows progressively. Native SQLite browse/search and series-episode waits use animated indeterminate activity bars when a truthful exact percentage is not available.
- Active progress bars include a moving highlight and explicit **Still running — Swoop TV has not frozen** reassurance so slow network stages still visibly look alive.
- No provider catalogue semantics, SQLite schema, Top 100/recently-added rails, metadata matching, IMDb hydration, watched/resume state or Windows/mpv playback behavior changes.

## v0.7.17 — Top 100 Ranked Rails

- Expands **Top 20 Movies** to **Top 100 Movies** and **Top 20 TV Shows** to **Top 100 TV Shows**.
- Both ranked Home rails can now return and render up to **100 locally available titles** while preserving their existing blended web-ranking logic and four-hour refresh cadence.
- Keeps the existing internal `top20-movies` / `top20-shows` row IDs for profile-layout compatibility, so no Home customization or profile migration is required.
- Ranked card numbering now accommodates 1–100 cleanly, including a compact three-digit treatment for rank 100.
- All other Home rails remain capped at 100 as in v0.7.11. Provider recently-added sorting, strict title/year matching, IMDb viewport hydration, source stacking, watched/resume state and Windows/mpv playback are unchanged.

## v0.7.16 — Provider Recently Added Rails

- Changes the two provider recency rows from release-year sorting to provider-addition sorting.
- Renames **New & Recent Movies** to **Recently Added Movies** and **New & Recent TV Shows** to **Recently Added TV Shows** so the labels describe the source of recency accurately.
- Xtream movie imports retain the provider `added` timestamp; series imports retain `added` / `last_modified` timestamps when supplied by the provider.
- Adds a dedicated Windows SQLite `provider-added` sort. Duplicate movie stacks use the newest provider timestamp across their sources, while older indexed rows fall back to provider stream/series sequence until refreshed.
- Existing users can use the rows immediately. For exact timestamp ordering on a catalogue imported before v0.7.16, run **Refresh All** once so Swoop TV captures the provider's addition timestamps. No SQLite rebuild is required.
- Only the two provider recency Home rows change. v0.7.15 strict title/year matching, IMDb hydration, 100-item rails, source stacking, watched/resume state and Windows/mpv playback remain preserved.

## v0.7.15 — Strict Title-Year Metadata Matching

- Fixes false TMDb/IMDb enrichment where a provider title could inherit artwork and ratings from a different release with a similar name, such as `Odyssey (2025)` being decorated as `The Odyssey (2026)`.
- Removes the old year-qualified-search fallback that retried a title without its year when TMDb returned no same-year result. If an explicit provider year cannot be matched, Swoop TV now keeps the provider identity/artwork rather than guessing.
- Adds strict normalized-title + exact-year validation for title-search matches.
- Validates supplied/cached TMDb and IMDb IDs against the provider year before trusting them, preventing stale IDs from earlier false matches from continuing to contaminate metadata.
- Adds a client-side identity guard for both full metadata and lightweight IMDb-rating responses. Wrong-year artwork, title logos, metadata and IMDb scores are rejected even if an older Worker returns them.
- Cloudflare Worker v0.1.10 now returns the resolved title/year from the lightweight IMDb route so the app can verify identity before rendering the badge.
- Performs a one-time metadata-cache schema refresh on upgrade to remove ambiguous metadata cached by earlier builds. This does **not** refresh/rebuild the provider catalogue or SQLite database.
- Existing v0.7.14 detail-navigation stability, v0.7.13 viewport IMDb hydration, 100-item Home rails, source stacking, watched/resume state and Windows/mpv playback remain unchanged.

## v0.7.14 — Detail Navigation + Interaction Stability

- Fixes the title-detail transition captured in the Windows screen recording: raw provider names such as `EN - 2073 (2024)` / `AMZ - ...` no longer flash as the large title before metadata settles. Detail presentation uses the cleaned title immediately while full raw source names remain available in Smart Source Selection.
- Keeps the text title visible underneath the title-logo slot until the logo image has actually loaded, then crossfades to the logo. This removes the blank period caused by replacing text with an unloaded image.
- Stops metadata enrichment, native source hydration and Xtream detail loading from fully rerendering the detail route. Backdrop/title/body updates are patched in place so already-loaded artwork is retained and controls are not replaced underneath pointer clicks.
- Preserves the already-rendered browse DOM while a detail route is open. Back restores the exact Home/list screen, loaded artwork and previous scroll position immediately rather than reconstructing lazy/skeleton rows.
- Changes native Home-row priming and web-discovery refreshes to patch mounted rows instead of rebuilding the whole Home page, eliminating the blank/bounce cycle seen after returning from details.
- Cleans common provider/source prefixes before TMDb metadata/IMDb identity lookup, improving title/logo matching while keeping raw source labels unchanged for playback selection.
- Adds faster pressed-state feedback for cards/buttons. No provider refresh, SQLite rebuild, profile reset or mpv playback-profile change is required.

## v0.7.13 — Viewport IMDb Rating Hydration

- Fixes IMDb badges being absent across large category rails even when the underlying films/shows clearly have IMDb ratings.
- Poster cards now request IMDb ratings as they approach the viewport instead of relying only on Swoop TV's small general metadata-enrichment queue.
- Adds a separate throttled viewport rating queue with conservative concurrency in Auto/large-library mode, so long 100-item rails can progressively populate without attempting to enrich the whole library at once.
- IMDb rating results are cached for 30 days. Existing v0.7.12 blank-rating cache state is selectively invalidated once without clearing poster/backdrop metadata or rebuilding the provider catalogue.
- Visible cards update their gold IMDb badge in place after the rating arrives; the page does not need a full re-render.
- General metadata requests now share in-flight work by title instead of dropping duplicate requests.
- Cloudflare Worker v0.1.9 adds a lightweight `imdb-rating` metadata route that resolves the TMDb/IMDb identity and requests only the IMDb score. The client falls back to the v0.1.8 full metadata route when needed for compatibility.
- No provider refresh, SQLite rebuild, watched/resume reset or playback change is required.

## v0.7.12 — Poster IMDb Rating Overlay

- Removes the release year and generic star-rating metadata line from movie/TV poster cards so the artwork stays clean.
- Adds a compact **gold IMDb rating badge** in the bottom-right corner of movie/TV posters when a trusted IMDb rating is available.
- Resolves the canonical IMDb title ID from TMDb `external_ids`, then fetches the IMDb rating through the existing owner-managed MDBList API integration.
- Never labels TMDb/provider scores as IMDb: if MDBList is not configured, the title has no IMDb ID, or the rating lookup fails, the badge is simply omitted.
- Keeps the full provider/source names in Smart Source Selection and leaves detail/playback/provider behavior unchanged.
- No provider refresh or SQLite rebuild is required.

## v0.7.11 — Expanded Home Rails

- Expands every Home content rail except **Top 20 Movies** and **Top 20 TV Shows** to a maximum of **100 items** when enough matching content is available.
- Top 20 rows remain fixed at exactly **20** items and keep their numbered/ranked treatment.
- Increases native SQLite Home-row queries from 24 to 100 items for provider recents, categories, Live Now, Top Rated and genre/search-driven rows.
- Expands built-in web discovery matching to support up to 100 items for Trending, New & Hot, Popular on Streaming, Most Watched and Box Office rows.
- Recommended For You can now return up to 100 titles, and profile-scoped Continue Watching / Recently Watched / Recent Channels retention is raised to 100 so those rails can grow to the same cap.
- Existing provider data, SQLite catalogue, source stacking, metadata, watched/resume semantics and Windows/mpv playback behavior are unchanged. No provider refresh is required.

## v0.7.10 — Settings Provider Priority

- Moves **TV Providers** to the top of Settings, immediately below the Settings header, so provider status, library counts, **Manage Providers** and **Refresh All** are the first controls available.
- Profile controls now sit directly below TV Providers, followed by Performance.
- No provider, catalogue, discovery, watched/resume, metadata, theme or playback behavior changes. Existing SQLite/provider data is reused and no refresh is required.

## v0.7.9 — Disconnected Demo Artwork Guard

- Fixes misleading artwork appearing on the built-in mock/demo catalogue when no TV provider is connected.
- Demo movie/show names are synthetic UI placeholders and are now excluded from TMDb metadata lookups, preventing title-name collisions from attaching unrelated real posters/backdrops.
- Cached metadata from earlier builds is ignored for demo items, so existing users do not need to clear storage.
- Disconnected demo cards return to intentional Swoop TV gradient artwork with the demo title/year visible; real provider titles continue to use normal TMDb artwork enrichment.
- No provider, SQLite catalogue, discovery, watched/resume or Windows/mpv playback changes. No provider refresh is required.

## v0.7.8 — Poster Cleanup + Recommendation Trust

- Removes the duplicated movie/TV title-name overlay from poster cards when artwork is available, leaving the poster itself to carry the title treatment.
- Keeps the original full provider/source title untouched inside Smart Source Selection so labels such as `NF - ...`, `EN - ...` and quality/source variants remain available when choosing a stream.
- Stops presenting raw Xtream/provider `rating` values as trustworthy 0–10 star ratings on movie/TV browse cards, Home hero and detail pages. Visible star ratings now come from TMDb metadata and must validate to the 0–10 range.
- Fixes the cold-start **Recommended For You** bug: with no viewing history, the row no longer fills with arbitrary catalogue titles just because they have provider rating values.
- Tightens personalised fallback scoring after viewing starts: non-TMDb fallback recommendations now require actual genre affinity; same media type alone can no longer qualify an unrelated title.
- Existing SQLite catalogue, provider credentials, source stacking, watched/resume data, discovery rows and the proven Windows/mpv playback profile are unchanged. No provider refresh is required.

## v0.7.7 — Home Polish + Watched Controls

- Removes **Because You Watched** completely; **Recommended For You** is the one personalised recommendations row.
- Pins Home ordering to **Continue Watching → Top 20 Movies → Top 20 TV Shows**. Smart ordering only affects rows below those three.
- The three pinned rows are shown as locked priorities in Customize Home and cannot be disabled or moved.
- Adds profile-scoped **Mark as Watched / Mark as Unwatched** on movie/TV detail pages.
- Mark Watched removes the title from Continue Watching; Mark Unwatched resets watched/resume state. Natural playback completion also marks the title watched.
- Adds a subtle **WATCHED** badge to completed movie/show cards.
- Replaces the old abstract profile avatar set with eight playful animals: Lion, Elephant, Monkey, Tiger, Zebra, Giraffe, Rhino and Meerkat; legacy profile avatar IDs migrate automatically.
- Refines Home row spacing, priority-row hierarchy, horizontal scrolling, artwork loading placeholders and avatar presentation while preserving the four profile themes.
- Existing SQLite catalogue, provider credentials, blended discovery, multi-provider logic and the proven Windows/mpv playback profile are unchanged. No provider refresh is required.

## v0.7.6 — Interaction Responsiveness + Detail Playback Hotfix

- Fixes **Play / Resume appearing to do nothing from a full-screen title detail page**. The v0.7.5 detail route was hiding the Smart Source chooser and native-player overlay behind the detail route; both now render above title details.
- Detail thumbnails now navigate **immediately**. SQLite source hydration and Xtream detail loading continue after the dedicated title screen is already visible instead of blocking the click.
- Single-source SQLite titles with an existing playable URL skip an unnecessary source lookup round-trip.
- Play/Resume gives immediate **Opening…** feedback while Swoop TV resolves a source.
- Detail Play uses the already-resolved detail item directly; if a native item alias is missing from memory, Swoop TV performs a targeted SQLite get instead of silently doing nothing.
- Background discovery and Home-row priming no longer force a Home rerender while a title detail/player interaction is active.
- The native startup cache is reduced further; Movies/Shows/Live continue to page from SQLite on demand.
- Existing SQLite catalogue, provider credentials, profiles, resume data and the proven mpv compatibility profile are preserved. No provider refresh is required.

# Swoop TV v0.7.6 — Detail Navigation + Render Performance

- Movie and TV thumbnails now open a dedicated full-screen detail screen instead of appending detail content to the bottom of Home/Movies/Shows. Back returns to the prior browse position.
- Detail metadata/episode refreshes preserve the title-screen scroll position.
- Fixes the oversized intrinsic row height that could reserve roughly 1200px for off-screen Home sections and appear as huge blank gaps.
- Reuses one artwork IntersectionObserver per render instead of accumulating observers across repeated Home rerenders.
- In large-library mode, artwork starts closer to the viewport and web artwork relay concurrency is reduced. TMDb cards request smaller poster images while cinematic hero/detail backdrops retain large images.
- Native catalogue pages initially mount 72 movies/shows and 96 live channels, then page with Load More, reducing first-paint DOM/image pressure.
- Lean mode reduces expensive hover scaling/shadows and uses visible shimmer/fallback cards while images decode asynchronously, reducing layout/paint jerk.
- SQLite catalogue, provider profiles, themes, resume data, multi-provider logic, discovery and the proven mpv playback profile are unchanged. Existing native catalogue is reused; no provider refresh is required.

# Swoop TV Release Notes

## v0.7.6 — Native Catalogue Playback Continuity Hotfix

- Fixes SQLite-native catalogue thumbnails/details that could fail to launch playback after migration.
- Native logical catalogue rows now expose all underlying source IDs and cache aliases for those IDs.
- Playback always resolves a concrete provider source from SQLite before launching mpv.
- Legacy Continue Watching/My List IDs created before migration map to the new logical SQLite title identity.
- Resume/history updates deduplicate old source IDs and logical stack IDs, preserving saved position across migration and source stacking.
- Existing SQLite database, provider credentials, themes, discovery and mpv compatibility profile are unchanged.

## v0.7.4.1 — Settings Navigation Access Hotfix

- Fixes the v0.7.4 oversight where the Settings page existed but had no normal navigation entry.
- Adds a persistent Settings gear in the desktop top bar.
- Adds Settings to the mobile bottom navigation and Who’s Watching/profile picker.
- Makes the existing **Native Catalogue Database** status card directly accessible for SQLite verification.
- No database schema/query, provider, profile/theme, discovery, or native playback changes.

## v0.7.4.1 — Native Catalogue Database Foundation

### Native large-library architecture
- Moves the full Windows-native IPTV catalogue out of the browser UI and into a local **SQLite 3.53.4** database under `%LOCALAPPDATA%\SwoopTV`.
- First native launch downloads the official Windows x64 SQLite tools (about 6.25 MiB) and validates the pinned SHA-256 before extraction.
- Creates indexed catalogue tables for provider, kind, group, logical identity, TMDb/IMDb identity, cleaned title/year and source score.
- Adds **FTS5** full-text indexing for fast title/channel/category search.
- Uses WAL mode, NORMAL synchronous mode, memory temp storage and a bounded SQLite cache for responsive local reads.

### Paged / indexed UI queries
- Movies, TV Shows and Live TV use native paged queries rather than keeping the full provider dump in browser memory.
- Adds native category aggregation and FTS5 ranked search.
- Home local/category rows request only the items needed for the row.
- Discovery/MDBList candidate matching runs against indexed SQLite records instead of rescanning the entire raw catalogue in JavaScript.
- My List, Continue Watching, Recent Channels and profile state hydrate only referenced catalogue items.
- Native duplicate/movie/live logical grouping happens in SQL, with source counts retained for source-stack UI.

### Migration / provider refresh
- Existing browser-side v0.7.x catalogues migrate into SQLite once after profile selection with visible progress.
- Provider imports write to SQLite in **2,000-item chunks**.
- Refreshing/removing a provider updates only that provider's database rows.
- After a successful native migration, the large browser catalogue is retired while metadata/discovery caches remain separate.
- Future Windows launches activate SQLite query mode directly and only load small initial windows of Movies, TV Shows and Live TV.

### Settings / compatibility
- Adds **Settings → Native Catalogue Database** status with raw/logical counts, FTS5 status and page-window information.
- v0.7.3 Auto/Recommended large-library visual safeguards remain intact.
- Multi-provider unified library, profiles/themes, dynamic discovery, Smart Sources, premium Live TV, resume/Up Next and EPG remain intact.
- Proven Windows/mpv playback compatibility/buffering profile is unchanged.
- Cloudflare Connection + Metadata Worker remains **v0.1.7**; no Worker update is required.
- PWA shell cache is `swoop-tv-v0741-shell`; Windows bridge/bootstrap reports **v0.7.4.1**.

### Verification
- JavaScript syntax checks pass.
- Full automated test suite passes.
- Added native SQLite/FTS schema, query endpoint, 2,000-item import, browser-catalog retirement and playback-profile regression assertions.
- SQLite Windows tools version/hash pin is validated against the current official 3.53.4 distribution metadata / package verification.
- Final ZIP integrity verified before release.
- Actual Windows PowerShell/SQLite/mpv runtime remains an in-user validation step.

## v0.7.3 — Large Library Performance Pass

- Adds automatic large-library performance mode at 12,000+ enabled catalog items.
- Home eager-renders five rows, then lazy-mounts later rows as they approach the viewport.
- Large-library rows render a smaller initial card set; Top 20 remains a full 20.
- Adds `content-visibility`/containment for off-screen sections.
- Throttles background metadata enrichment and removes repeated whole-Home re-renders from metadata completion.
- Adds cached/debounced unified Search.
- Reduces expensive blur/shadow effects in automatic performance mode while preserving profile theme identity.
- Adds Settings → Performance with Auto / Recommended and Full Cinematic options.
- PWA shell cache is `swoop-tv-v073-shell`.
- Windows bridge/bootstrap reports v0.7.3.
- Playback compatibility profile is unchanged.

## v0.7.2 — Blended Discovery + Startup Stability

### Discovery
- Replaces the single-chart Trending implementation with a **blended Swoop TV ranking**.
- Adds TMDb daily trending, weekly trending, popular and current-release/airing signals through the owner-managed Swoop TV metadata service.
- Worker v0.1.7 can optionally use owner secret `MDBLIST_API_KEY` to add MDBList/JustWatch and supported Trakt/IMDb popularity inputs without requiring end-user accounts.
- **Trending Now** weights fast-moving daily, Trakt/streaming and weekly activity rather than mirroring one chart.
- **Top 20** is kept steadier using popular/IMDb/TMDb/streaming inputs.
- Adds selectable **New & Hot Movies**, **New & Hot TV Shows**, **Popular on Streaming — Movies**, **Popular on Streaming — TV**, **Most Watched This Week — Movies**, **Most Watched This Week — TV** and **Box Office Now** rows.
- Fast-moving web rows refresh at roughly 90 minutes; steadier rankings retain longer caching.
- Manual **Refresh discovery now** no longer requires a local MDBList key.
- A local MDBList key is now described only as an optional requirement for custom personal MDBList rows.

### Large-library stability
- Fixes a major profile/startup freeze path. Swoop TV no longer starts restoring a very large IndexedDB catalog while **Who’s Watching?** is still on screen.
- Library restore begins only after a profile is selected and shows real progress.
- Durable catalog storage is upgraded from one huge IndexedDB value to **2,000-item catalog chunks** with a manifest and separate metadata/discovery records.
- Existing single-record v0.7.1 catalogs migrate through a background Web Worker, with catalog data returned to the UI in smaller chunks.
- Fixes repeated full movie/live duplicate-index rebuilding caused by `activeCatalog()` returning a new filtered array on every call. The active catalog and stack indexes now remain stable until provider/profile context actually changes.
- Metadata and discovery cache writes no longer rewrite the full IPTV catalog on every enrichment/update.

### Infrastructure
- Cloudflare Connection + Metadata Worker upgraded to **v0.1.7**.
- New optional owner secret: `MDBLIST_API_KEY`.
- Worker health response now exposes `discoveryConfigured` and `mdblistConfigured`.
- PWA shell cache is `swoop-tv-v072-shell`.
- Windows bridge/bootstrap reports **v0.7.2**.
- Proven Windows/mpv playback compatibility profile is unchanged.

### Verification
- JavaScript syntax checks pass.
- Full automated test suite passes.
- Added blended discovery Worker source tests.
- Added chunked-storage / background-migration / deferred-profile-restore structural assertions.

## v0.7.1 — Profile Theme Engine

### New
- Added a **profile-linked full Theme Engine**. Theme choice is saved independently for every household profile and changes immediately when profiles switch.
- Added four launch themes: **Chill**, **Prime Time**, **Rewind** and **Vice**.
- Theme selection is available from both **Edit Profile** and **Customize Home**.
- Added theme previews and theme labels to profile management / Who's Watching surfaces.
- Themes now alter Home hero composition, navigation, card/rail geometry, buttons, badges, progress states, focus states, detail/settings surfaces, provider progress screens and TV Guide presentation.
- Existing background colour is now an optional **per-profile override** on top of a theme rather than the only appearance control.
- Added a one-click **Use theme default** action to restore the selected theme's intended background.

### Theme direction
- **Chill** — cinematic black/red presentation.
- **Prime Time** — navy/blue modern streaming presentation with rounded cards and cleaner hierarchy.
- **Rewind** — blue/yellow nostalgic video-store treatment with retro marquee and shelf-style rows.
- **Vice** — neon pink/cyan/purple Miami-night treatment with sunset/glow styling.
- All themes are original Swoop TV implementations and do not include third-party logos or copied branded artwork.

### Migration / persistence
- Existing profiles default to **Chill**.
- Theme ID, background override state and custom background colour are stored as profile settings.
- Older custom non-black profile backgrounds are preserved as an override where possible.

### Preserved
- v0.7.0 Multi-Provider + Unified Library behavior.
- Per-profile Continue Watching, My List, viewing history, recommendations, Live favourites and Home rows.
- Smart Sources, Premium Live TV, source stacking, EPG, TMDb/MDBList discovery and rotating Home hero.
- Proven Windows/mpv compatibility/buffering profile remains unchanged.

### Infrastructure
- Windows bridge/bootstrap reports **v0.7.1**.
- PWA cache is `swoop-tv-v071-shell`.
- Cloudflare Connection + Metadata Worker remains **v0.1.6**; no Worker update is required.

### Verification
- JavaScript syntax checks pass.
- Existing automated Xtream/M3U/MDBList/TMDb/profile/playback/multi-provider tests pass.
- Added theme catalog, palette and profile-theme persistence assertions.
- Final ZIP integrity is verified before release.

## v0.7.0 — Multi-Provider + Unified Library

### New
- Added a full **Provider Manager**. Swoop TV can keep multiple Xtream Codes and M3U providers connected at the same time.
- Adding a new provider extends the library instead of replacing the existing catalog.
- Providers can be **enabled/disabled, refreshed, reordered by priority, edited/reconnected, or removed** independently.
- Added **Refresh All Providers** and per-provider health / last-refresh information.
- Added provider-level counts for Live TV, Movies and TV Shows.
- Added **provider filters** on Movies, TV Shows and Live TV so a user can view the combined library or one provider at a time.
- Movie duplicate stacks work across providers and provider priority is used as a tie-breaker after quality/HDR/codec ranking.
- Added conservative **Live TV source stacking** using matching EPG/tvg ID, or exact cleaned channel name + group.
- Xtream EPG, VOD details and series/episode requests use the credentials belonging to the specific provider that owns the selected item.
- TV Guide can combine EPG data from multiple enabled Xtream/XMLTV providers.
- Provider credentials are stored as multiple durable provider profiles.

### Preserved
- Profiles and per-profile Continue Watching, My List, viewing history, recommendations, Live favourites, Home rows and appearance.
- Smart movie source selection and automatic immediate-failure fallback.
- Premium Live TV controls, in-process Windows channel switching and native mpv playback.
- TMDb/MDBList discovery, Top 20/Trending rows, rotating Top 5 hero, title detail pages, episode browsing and Up Next.
