# Swoop TV v0.8.5 — Google TV Launch Refresh + Ready Home

Android TV / Google TV hardware-test branch built from the Swoop TV v0.7.45 product baseline.

## v0.8.5 launch contract

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

## Android package

- Application ID: `tv.swoop.player`
- versionName: `0.8.5`
- versionCode: `805`
- minSdk: 23
- target/compile SDK: 36
- Media3 / ExoPlayer: 1.11.0

## Downloader test channel

The GitHub Actions workflow continues to overwrite the stable test asset:

`google-tv-test-v0.8.1 / Swoop-TV-v0.8.1-Google-TV-Test.apk`

That preserves **Downloader code 3682231**. The installed app reports **0.8.5 (805)**. The workflow also publishes `Swoop-TV-v0.8.5-Google-TV-Test.apk` for version tracking.

The bundled signing key is test-only and must never be used for production.
