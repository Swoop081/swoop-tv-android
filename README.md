# Swoop TV v0.8.29 — Google TV Hardware Consolidation + Stability Pass

Current Android/Google TV source baseline.

## v0.8.29 highlights

- Reworks Home Top 100 into a 100-item logical rail with bounded 32-card render windows, ahead-of-focus expansion and provider-backed completion when the external trending match set is shorter than 100.
- Adds provider **Recently Added Movies** and **Recently Added TV Shows** directly beneath the two Top 100 Home rows.
- Makes Home / Movies / TV Shows featured artwork full-bleed with top-biased, face-safer framing and retains the compact 10-dot featured rotation indicator.
- Rebuilds STARmeter around three visible people at a time with single-flight catalogue hydration, large circular portraits, prominent rank and large provider-available mixed title rails.
- Enlarges **Who's Watching?** and focuses the first profile automatically so OK enters immediately.
- Reduces Live TV DOM pressure, restores large TV-friendly channel cards and keeps native preview hidden until Media3 reports a ready frame.
- Adds explicit TV detail/person/episode focus routing, larger cast presentation, persistent Back access, richer metadata and safe bottom spacing.
- Restores TV episode navigation with left-aligned seasons, episode thumbnails, original air date, runtime and synopsis where resolvable.
- Force-destroys stale detail/person state when navigating to a primary tab so an old actor page cannot leak back over Home/Live TV.
- Adds cached-first Guide repainting plus Guide-specific Hardware Test focus diagnostics.
- Retains the v0.8.28 whole-app warm-start seed and v0.8.27 Hardware Test workflow.

## Android package

- applicationId: `tv.swoop.player`
- versionName: `0.8.29`
- versionCode: `829`
- minSdk: 23
- target/compile SDK: 36
- Java: 17
- Media3 / ExoPlayer: 1.11.0
- AndroidX WebKit: 1.15.0

## Warm-start seed

GitHub Actions runs `node scripts/refresh-seed-cache.mjs` before APK compilation. The packaged provider-neutral seed can contain current discovery inputs, STARmeter people/portraits/credits, popular title metadata and selected episode metadata. Credentials, provider-specific catalogue, profiles, My List, Continue Watching/history and live EPG are never baked into the generic APK.

## Hardware diagnostics

Open **Settings**, focus the Settings cog and press **OK five times within four seconds** to enable Hardware Test Mode. Select the numbered test that matches the issue, reproduce it, then choose **Save Diagnostics**.

See `TV_HARDWARE_TEST_CHECKLIST.md` for the v0.8.29 physical-TV gates.

## APK build

The included GitHub Actions workflow installs Android SDK 36 + Gradle 9.5.0, refreshes the seed, runs runtime checks, builds the Google TV debug/test APK, publishes the versioned asset and overwrites the stable Downloader asset used by code **3682231**.
