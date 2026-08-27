# Swoop TV v0.8.34 — STARmeter Fail-Open Batch Recovery Hotfix

Current Android/Google TV source baseline.

## v0.8.34 highlights

- Fixes the v0.8.33 physical-TV STARmeter failure captured at 28%.
- Replaces one all-100 provider match with 12-person indexed worker batches and commits each completed batch immediately.
- Keeps pre-login STARmeter warming, but profile selection no longer waits for it.
- Removes the full-page STARmeter completion gate: the 100-person page remains navigable and unfinished rows hydrate safely in place.
- Partial/time-out preparation automatically retries in the background instead of trapping focus behind an error loader.
- Retains v0.8.33 route-top restoration, fixed row geometry, portrait prewarming and all v0.8.32 performance work.

## Android package

- applicationId: `tv.swoop.player`
- versionName: `0.8.34`
- versionCode: `834`
- minSdk: 23
- target/compile SDK: 36
- Java: 17
- Media3 / ExoPlayer: 1.11.0
- AndroidX WebKit: 1.15.0

## Warm-start seed

GitHub Actions refreshes `seed-cache.json` immediately before APK compilation. Provider credentials, provider-specific catalogue, profiles, personal history and live EPG remain device-local and are never baked into the generic APK.

## Hardware diagnostics

Open **Settings**, focus the Settings cog and press **OK five times within four seconds** to enable Hardware Test Mode. Select the numbered test, reproduce the issue, then choose **Save Diagnostics**.

See `TV_HARDWARE_TEST_CHECKLIST.md` for the v0.8.34 physical-TV gates.

## APK build

The included GitHub Actions workflow installs Android SDK 36 + Gradle 9.5.0, refreshes the full warm-start seed, runs verification, builds the test APK and automatically overwrites/validates the stable Downloader asset used by code **3682231** after every successful `main` build.
