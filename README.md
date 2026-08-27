# Swoop TV v0.8.30 — Google TV My SwoopTV + STARmeter Stability Consolidation

Current Android/Google TV source baseline.

## v0.8.30 highlights

- Adds **My SwoopTV** after Home for Continue Watching, saved movies/shows, favourite channels and Recently Watched. The standalone My List tab is retired.
- Home is discovery-first and keeps the approved hero dimensions while using more of the left copy area for the featured synopsis.
- The two Home Top 100 rails mount all 100 logical focus targets on Google TV to eliminate the recurring stop around item 25–27.
- STARmeter now uses one indexed provider-availability map for person filmography matching, bounded timeouts/retries, cancellation on exit and deterministic D-pad escape.
- STARmeter retains large centred circular portraits, prominent ranking and large provider-available title rails.
- Every Live TV channel row below Browse Live TV reuses the same size/spacing treatment as Recent Channels.
- Guide adds a Live TV/date/time banner above All Channels and the EPG without altering the approved left category sidebar.
- Retains the v0.8.29 profile/detail/episode/route fixes, v0.8.28 warm-start seed and v0.8.27 Hardware Test Mode.

## Android package

- applicationId: `tv.swoop.player`
- versionName: `0.8.30`
- versionCode: `830`
- minSdk: 23
- target/compile SDK: 36
- Java: 17
- Media3 / ExoPlayer: 1.11.0
- AndroidX WebKit: 1.15.0

## Warm-start seed

GitHub Actions refreshes `seed-cache.json` immediately before APK compilation. Provider credentials, provider-specific catalogue, profiles, personal history and live EPG remain device-local and are never baked into the generic APK.

## Hardware diagnostics

Open **Settings**, focus the Settings cog and press **OK five times within four seconds** to enable Hardware Test Mode. Select the numbered test, reproduce the issue, then choose **Save Diagnostics**.

See `TV_HARDWARE_TEST_CHECKLIST.md` for the v0.8.30 physical-TV gates.

## APK build

The included GitHub Actions workflow installs Android SDK 36 + Gradle 9.5.0, refreshes the warm-start seed, runs verification, builds the test APK and overwrites the stable Downloader asset used by code **3682231**.
