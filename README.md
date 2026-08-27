# Swoop TV v0.8.32 — Google TV Fast Navigation + Hydration Stability

Current Android/Google TV source baseline.

## v0.8.32 highlights

- STARmeter now mounts a fixed 100-person surface with stable row geometry, bounded concurrent matching and an 18-person directional look-ahead so rapid vertical D-pad navigation cannot outrun rendering.
- Home/Top 100 artwork prefetch follows focus direction and warms substantially farther ahead of the visible rail.
- Home hero swaps are atomic: the previous hero remains until the next backdrop is decoded, correct `w1280` backdrop prewarming is used, and text remains visible until a title logo is ready.
- Android profile-to-Home startup prewarms visible Home artwork before revealing the route; Live TV also warms initial categories/channel logos ahead of focus.
- Live preview chrome remains visually absent until the native Media3 preview is active.
- TV Guide logo artwork is larger inside the existing approved cells; Guide geometry is unchanged.
- Android cold launch now uses a branded Swoop TV launch surface rather than an all-black frame.

## Android package

- applicationId: `tv.swoop.player`
- versionName: `0.8.32`
- versionCode: `832`
- minSdk: 23
- target/compile SDK: 36
- Java: 17
- Media3 / ExoPlayer: 1.11.0
- AndroidX WebKit: 1.15.0

## Warm-start seed

GitHub Actions refreshes `seed-cache.json` immediately before APK compilation. Provider credentials, provider-specific catalogue, profiles, personal history and live EPG remain device-local and are never baked into the generic APK.

## Hardware diagnostics

Open **Settings**, focus the Settings cog and press **OK five times within four seconds** to enable Hardware Test Mode. Select the numbered test, reproduce the issue, then choose **Save Diagnostics**.

See `TV_HARDWARE_TEST_CHECKLIST.md` for the v0.8.32 physical-TV gates.

## APK build

The included GitHub Actions workflow installs Android SDK 36 + Gradle 9.5.0, refreshes the full warm-start seed, runs verification, builds the test APK and overwrites the stable Downloader asset used by code **3682231**.
