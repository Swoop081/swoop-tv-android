# Swoop TV v0.8.12 — Cached Launch + Compact Ranked Rails

Android TV / Google TV hardware-test branch built from the Swoop TV v0.7.45 product baseline.

## v0.8.12 launch + rail additions

- Normal Google TV launches reuse the saved provider library/Home snapshot immediately; providers are not re-downloaded on every app open or APK update.
- Provider network refresh remains available from Providers → Refresh / Refresh All and is still used when no valid saved library exists.
- Durable EPG data is reused across launches.
- Startup/preparation branding uses the transparent supplied Swoop TV logo.
- All Home poster rails are smaller with increased spacing. Top 100 rank numerals straddle the lower-left edge and ranked title fallback text is suppressed.

## v0.8.12 visual/control additions

- Makes the supplied neon Swoop TV logo the visual source for the **default theme**: deep black, hot magenta and electric cyan.
- Keeps the historical internal theme ID `chill` for saved-profile compatibility, but presents it as **Swoop — Neon signature** so existing default profiles migrate automatically without a reset.
- Applies the active profile theme to the Google TV control system: Home / Live TV / Guide / Movies / TV Shows / My List tabs, header utilities, action buttons, filter/category tabs, Guide controls and secondary text actions.
- Focused controls use the current theme gradient and glow rather than a generic white block; selected tabs use restrained theme colour at rest.
- Continue Watching **Remove** retains a semantic destructive red treatment but now uses the same premium glass geometry and focus language.
- Provider/library progress, Guide current-programme accents, badges and playback progress now inherit the active theme rather than old hard-coded red/purple accents.
- Retains the v0.8.10 compact Home poster geometry and scroll-first Up navigation.

## v0.8.10 historical launch contract (superseded by v0.8.12 cache-first launch)

Swoop TV now treats launch as a gated library-preparation phase on Google TV. The app does not expose Home until the provider library and priority Home content are ready.

- After profile selection, Swoop TV immediately opens a polished **Updating your TV library** screen with a real percentage progress bar, current stage and provider status.
- Every enabled provider with saved refreshable credentials is refreshed during the launch gate. Local-file providers that cannot be refreshed automatically keep their saved content.
- Android provider downloads run through an asynchronous native network bridge. Large responses are transferred to the WebView in bounded chunks so the progress UI can continue rendering while network work runs.
- Xtream category and catalogue downloads run concurrently. Catalogue normalization yields between large batches rather than processing the whole playlist in one uninterrupted UI-thread pass.
- The previous successful library is loaded first as a protected fallback, but it is never shown as a partially refreshed Home screen.
- The refreshed catalogue is persisted once after provider refresh finishes rather than rewriting the full library after every provider.
- Swoop TV prepares Home before revealing it. **Top 100 Movies** and **Top 100 TV Shows** are refreshed and prepared first. Remaining selected Home rows are resolved from their last successful match or provider-local data before Home is exposed, so launch does not wait on dozens of separate recommendation requests.
- Discovery-to-library matching and large-library indexing use the Android catalogue worker where available so expensive matching stays off the WebView interaction path.
- A prepared Home-row cache is built during the gate, and critical first-screen artwork is warmed before Home is shown.
- If an online Top 100 source is unavailable, Google TV can build a provider-library fallback rather than exposing an empty priority row.
- Home always enters at scroll position 0 and only after preparation reaches 100%.
- Once Home appears, there is no automatic Android row expansion, destination prewarm or missing-card metadata crawl. Additional already-prepared Home rows are mounted only when D-pad navigation reaches them, so background DOM/artwork work cannot steal the remote interaction budget.
- If a launch refresh fails but a previous successful library exists, Swoop TV prepares and opens that saved library instead of leaving the customer stranded on an unusable screen.

The intended customer experience is therefore: **choose profile → watch one clear progress screen → enter a complete, responsive Home**. There is no half-loaded Home phase.

### v0.8.10 TV-specific additions

- Corrects the v0.8.9 sizing inversion: the compact Top 100 poster geometry is the reference size, and **all other Home poster rails are reduced to that same compact size**.
- Top 100 retains its rank-number overlay; non-ranked rails use the identical card shell without a number.
- Keeps complete 100-title Top 100 data while mounting cards incrementally for responsiveness.
- Adds **scroll-first Up navigation** on Home. While the page is below the top, the top navigation is removed from D-pad targeting, so Up continues through higher rows and scrolls the page upward.
- Home / Live TV / Guide / Movies / TV Shows / My List can only receive focus once Home is actually back at the top.
- Retains the Google TV safe-area header inset, gated launch refresh, native XMLTV preparation, supplied branding and ten supplied animal profile avatars.


The supplied neon **Swoop TV** logo is now the canonical visible brand asset for this TV test branch. It is used on the Android launcher icon/banner, the launch-refresh/library-preparation screen, and the top-left application brand control.

## Android package

- Application ID: `tv.swoop.player`
- versionName: `0.8.12`
- versionCode: `812`
- minSdk: 23
- target/compile SDK: 36
- Media3 / ExoPlayer: 1.11.0

## Downloader test channel

The GitHub Actions workflow continues to overwrite the stable test asset:

`google-tv-test-v0.8.1 / Swoop-TV-v0.8.1-Google-TV-Test.apk`

That preserves **Downloader code 3682231**. The installed app reports **0.8.12 (812)**. The workflow also publishes `Swoop-TV-v0.8.12-Google-TV-Test.apk` for version tracking.

The bundled signing key is test-only and must never be used for production.