# Swoop TV v0.8.27 — Google TV Hardware Test Workflow

Swoop TV is a content-neutral IPTV player. This source package is the current Google TV / Android TV hardware-test branch.

## v0.8.27 highlights

- Adds a hidden **Hardware Test Mode**. Press OK on the Settings cog five times within four seconds to toggle it.
- Shows a non-focusable live diagnostics HUD with current page, rail/index focus, scroll, DOM/card/image counts, pending background work, key input and renderer-reset metrics.
- Adds numbered NAV / PERF / LIVE / STAR / STAB regression sessions so photos, videos and exported logs refer to the same reproducible test.
- Adds **Save Diagnostics** while test mode is active. Android writes a timestamped JSON file with UI state, rolling D-pad/focus events, long tasks, JavaScript/native memory, playback/preview state and renderer-loss information.
- Preserves the diagnostic session through a WebView renderer restart so black-screen/reset failures do not erase all useful evidence.
- Automates version/APK naming, update-manifest generation and GitHub release summary creation from `app/build.gradle` and the canonical `RELEASE_NOTES.md`.
- Ships `TV_HARDWARE_TEST_CHECKLIST.md` with CI artifacts for a consistent physical-TV test loop.
- Retains the complete v0.8.26 performance/stability/navigation/visual pass.

## Android package

- Application ID: `tv.swoop.player`
- versionName: `0.8.27`
- versionCode: `827`
- minSdk: `23`
- targetSdk / compileSdk: `36`
- Java: `17`
- AndroidX Media3 / ExoPlayer: `1.11.0`
- AndroidX WebKit: `1.15.0`

## APK build path

The authoritative APK build path is `.github/workflows/android-tv-apk.yml`.

The workflow publishes:

- `Swoop-TV-v0.8.27-Google-TV-Test.apk`
- stable compatibility asset `Swoop-TV-v0.8.1-Google-TV-Test.apk`
- `swoop-tv-latest.json`
- `swoop-tv-starmeter.json`

The stable APK asset preserves the existing **Downloader code 3682231** test path.

## Runtime verification

Before packaging v0.8.27, run:

```bash
find app/src/main/assets -name '*.js' -print0 | xargs -0 -n1 node --check
node tests/card-runtime-smoke.mjs
node tests/tv-ui-runtime-smoke.mjs
python -m json.tool app/src/main/assets/starmeter.json >/dev/null
python -m json.tool swoop-tv-starmeter.json >/dev/null
```

See `ANDROID_TV_CERTIFICATION.md` for the physical-TV checklist and `TV_HARDWARE_RUNNING_FIXES.md` for the running hardware-verification ledger.
