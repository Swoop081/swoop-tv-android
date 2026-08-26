# Swoop TV v0.8.9 — Google TV Rail Alignment + Full Top 100

Android TV / Google TV hardware-test branch built from the Swoop TV v0.7.45 product baseline.

## v0.8.9 launch contract

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

### v0.8.9 TV-specific additions

- Adds a dedicated Google TV top safe-area inset so the Swoop TV logo, navigation and profile controls are fully visible on overscanned displays.
- Unifies every poster-based Home rail to the same card width, aspect ratio, gap and baseline as the Top 100 rails. Top 100 ranks remain overlays and no longer shift poster alignment.
- Top 100 Movies and Top 100 TV Shows now prepare up to 100 actual titles. When external ranking feeds match fewer than 100 provider titles, the remainder is filled from the strongest titles in the connected library.
- Keeps only 20 cards mounted initially per TV rail, then appends 20 more as D-pad navigation approaches the right edge. The list remains 100 titles without bringing back the large-DOM responsiveness problem.
- Profile avatars now use the ten supplied animal portraits: Lion, Elephant, Giraffe, Zebra, Rhino, Turtle, Monkey, Meerkat, Parrot and Tiger.
- Avatar portraits are used consistently in profile selection, profile editing, profile switching, PIN screens and Settings.

- The Home hero is capped at roughly **43% of the TV viewport (300–355px on the logical TV canvas)** instead of the previous 520px/74vh treatment. More of the first content rail is visible immediately.
- Programme-guide preparation is now part of startup. Xtream XMLTV and configured M3U XMLTV feeds are checked before Home is revealed.
- Android parses large XMLTV feeds **natively as a stream**, retaining only near-term programmes for live channels actually present in the playlist. This avoids handing a huge XML document to the WebView/JavaScript thread.
- Gzipped XMLTV is supported even when a provider does not correctly advertise the compression header.
- The startup progress bar has a dedicated **TV Guide** stage, and the prepared guide cache is reused by Guide and Live Now/Next.


The supplied neon **Swoop TV** logo is now the canonical visible brand asset for this TV test branch. It is used on the Android launcher icon/banner, the launch-refresh/library-preparation screen, and the top-left application brand control.

## Android package

- Application ID: `tv.swoop.player`
- versionName: `0.8.9`
- versionCode: `809`
- minSdk: 23
- target/compile SDK: 36
- Media3 / ExoPlayer: 1.11.0

## Downloader test channel

The GitHub Actions workflow continues to overwrite the stable test asset:

`google-tv-test-v0.8.1 / Swoop-TV-v0.8.1-Google-TV-Test.apk`

That preserves **Downloader code 3682231**. The installed app reports **0.8.9 (809)**. The workflow also publishes `Swoop-TV-v0.8.9-Google-TV-Test.apk` for version tracking.

The bundled signing key is test-only and must never be used for production.
