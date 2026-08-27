# Swoop TV v0.8.30 Build Verification

- [x] `app/build.gradle` is `versionName 0.8.30` / `versionCode 830`.
- [x] Android bridge/User-Agent and diagnostic filenames report v0.8.30.
- [x] `ANDROID_CURRENT_VERSION` reports 0.8.30.
- [x] Service-worker shell cache is bumped to v0830.
- [x] Install seed schema remains valid and `sourceVersion` is 0.8.30.
- [x] Full 100-person STARmeter manifests remain valid.
- [x] My SwoopTV is primary navigation after Home and legacy My List routes resolve into it.
- [x] Android Top 100 ranked Home rows mount the full 100 focus targets.
- [x] STARmeter provider filmography matching uses the worker availability index and bounded/cancellable hydration.
- [x] Live TV Browse/category cards share the Recent Channels footprint.
- [x] Guide contains the dedicated Live TV/date/time banner above All Channels/EPG.
- [x] JavaScript syntax checks pass.
- [x] Card runtime smoke passes.
- [x] Google TV UI runtime smoke passes.
- [x] Build/update/seed/STARmeter JSON validates.
- [x] GitHub Actions YAML parses.
- [ ] Binary APK compile is performed by GitHub Actions because Android SDK 36 / Gradle are unavailable in this packaging runtime.
