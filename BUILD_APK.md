# Swoop TV v0.8.28 — Google TV test build

The authoritative APK build path is `.github/workflows/android-tv-apk.yml`.

The workflow now performs these steps in order:

1. Set up JDK 17 / Android SDK 36 / Gradle 9.5.0.
2. Refresh the provider-neutral whole-app install seed with `scripts/refresh-seed-cache.mjs`.
3. Generate v0.8.28 release/update metadata from `app/build.gradle` and `RELEASE_NOTES.md`.
4. Run JavaScript syntax, card runtime, Google TV UI and seed-cache integrity checks.
5. Build `:app:assembleDebug`.
6. Publish `Swoop-TV-v0.8.28-Google-TV-Test.apk` and overwrite the stable `Swoop-TV-v0.8.1-Google-TV-Test.apk` asset.

The stable release path preserves **Downloader code 3682231**. The installed application reports **0.8.28 / versionCode 828**.
