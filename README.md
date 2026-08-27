# Swoop TV v0.8.37 — Performance Pack + Incremental Library Cache

Current Android/Google TV source baseline.

## v0.8.37 highlights

- Adds a persistent **Swoop TV Performance Pack** on Android. The packaged seed begins preparing reusable metadata/artwork immediately and provider setup performs a one-time local optimisation pass.
- Connected-provider snapshots are fingerprinted item-by-item. Later refreshes retain unchanged records and only send added/changed titles through priority artwork warming.
- Durable catalogue persistence now fingerprints 2,000-item chunks and rewrites only changed chunks instead of blindly rewriting the entire browser database.
- Adds a persistent `swoop-tv-artwork-v1` Cache Storage layer, preserved across shell-cache upgrades, so already-downloaded posters/backdrops/logos can be served locally on later launches.
- STARmeter provider matches persist for 90 days independently of rank. Existing people are restored immediately after a ranking update; only genuinely new entrants need first-time matching.
- STARmeter stale provider matches revalidate quietly after the cached page is usable.
- Held/long-pressed D-pad navigation now freezes STARmeter async DOM hydration for the entire key hold and resumes only after key release/scroll settle.
- Settings exposes **Optimise Library Now** so the Performance Pack can be topped up without reconnecting a provider.

## Incremental-sync model

The provider may still require Swoop TV to download its current playlist/catalogue when that provider offers no changed-since/delta API. After download, Swoop TV compares the result with its retained local fingerprints and avoids repeating expensive artwork/cache work for unchanged items. Provider credentials and provider-specific content remain device-local.

## Android package

- applicationId: `tv.swoop.player`
- versionName: `0.8.37`
- versionCode: `836`
- minSdk: 23
- target/compile SDK: 36
- Java: 17
- Media3 / ExoPlayer: 1.11.0
- AndroidX WebKit: 1.15.0

## Warm-start seed

GitHub Actions refreshes `seed-cache.json` immediately before APK compilation. The generic APK can therefore ship current provider-neutral STARmeter identities/filmographies and popular metadata. On-device Performance Pack storage merges that seed with the viewer's provider catalogue and retained artwork rather than discarding previous work after an app update.

## Hardware diagnostics

Open **Settings**, focus the Settings cog and press **OK five times within four seconds** to enable Hardware Test Mode. Select the numbered test, reproduce the issue, then choose **Save Diagnostics**.

See `TV_HARDWARE_TEST_CHECKLIST.md` for the v0.8.37 physical-TV gates.

## APK build

The included GitHub Actions workflow installs Android SDK 36 + Gradle 9.5.0, refreshes the warm-start seed, runs verification, builds the test APK and automatically overwrites/validates the stable Downloader asset used by code **3682231** after every successful `main` build.
