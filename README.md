# Swoop TV v0.8.31 — Google TV STARmeter Matching + Guide Banner Hotfix

Current Android/Google TV source baseline.

## v0.8.31 highlights

- Expands STARmeter provider matching through one prebuilt availability index with TMDb/IMDb matching, IPTV-cleaned title/year aliases and a controlled same-bucket fuzzy fallback.
- Prevents STARmeter from indexing the small Android Home snapshot as though it were the full provider library; person matching waits for the durable catalogue when needed.
- GitHub seed generation now preloads filmography credits for all 100 STARmeter people by default and preserves original title/name aliases.
- Prewarms STARmeter portraits much farther ahead so actor photos are ready before focus reaches them.
- Guide now always opens at the true top and shows an explicit LIVE TV / TV Guide date-and-current-time banner before All Channels and the two-hour EPG.
- Retains My SwoopTV, 100-item Top 100 focus rails, Live TV card parity, title/episode stability, whole-app warm-start cache and Hardware Test Mode.

## Android package

- applicationId: `tv.swoop.player`
- versionName: `0.8.31`
- versionCode: `831`
- minSdk: 23
- target/compile SDK: 36
- Java: 17
- Media3 / ExoPlayer: 1.11.0
- AndroidX WebKit: 1.15.0

## Warm-start seed

GitHub Actions refreshes `seed-cache.json` immediately before APK compilation. Provider credentials, provider-specific catalogue, profiles, personal history and live EPG remain device-local and are never baked into the generic APK.

## Hardware diagnostics

Open **Settings**, focus the Settings cog and press **OK five times within four seconds** to enable Hardware Test Mode. Select the numbered test, reproduce the issue, then choose **Save Diagnostics**.

See `TV_HARDWARE_TEST_CHECKLIST.md` for the v0.8.31 physical-TV gates.

## APK build

The included GitHub Actions workflow installs Android SDK 36 + Gradle 9.5.0, refreshes the full warm-start seed, runs verification, builds the test APK and overwrites the stable Downloader asset used by code **3682231**.
