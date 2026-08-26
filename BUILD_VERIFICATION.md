# Swoop TV v0.8.23 Build Verification

## Automated checks completed in the packaging environment

- All JavaScript modules under `app/src/main/assets/` pass `node --check`.
- `tests/card-runtime-smoke.mjs` passes.
- `tests/tv-ui-runtime-smoke.mjs` passes and covers the v0.8.23 navigation, 100-item rail, long-press, Live preview, Guide, actor-route and update/changelog contracts.
- Source/CSS delimiter counts are balanced as an additional packaging sanity check.
- Android version markers are aligned to `versionName 0.8.23` / `versionCode 823`.

## APK compilation

This packaging environment does not contain Gradle 9.5.0 or Android SDK 36, so an APK binary is not compiled locally here. The included GitHub Actions workflow installs the required Android SDK/JDK/Gradle toolchain, runs both smoke tests, builds the test APK, publishes the stable Downloader APK and uploads `swoop-tv-latest.json`.
