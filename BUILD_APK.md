# Swoop TV v0.8.33 — Google TV test build

The included GitHub Actions workflow is the authoritative APK build path.

1. Install JDK 17, Android SDK 36 and Gradle 9.5.0.
2. Refresh the packaged provider-neutral warm-start seed.
3. Generate v0.8.33 release/update metadata from `app/build.gradle` and `RELEASE_NOTES.md`.
4. Run JavaScript syntax and runtime regression checks.
5. Build `:app:assembleDebug`.
6. Publish `Swoop-TV-v0.8.33-Google-TV-Test.apk` and overwrite/verify the stable `Swoop-TV-v0.8.1-Google-TV-Test.apk` asset.

The stable release path preserves **Downloader code 3682231**. A successful `main` build automatically refreshes that Downloader asset. The installed application reports **0.8.33 / versionCode 833**.
