# Swoop TV v0.8.32 — Google TV test build

The included GitHub Actions workflow is the authoritative APK build path.

1. Install JDK 17, Android SDK 36 and Gradle 9.5.0.
2. Refresh the packaged provider-neutral warm-start seed.
3. Generate v0.8.32 release/update metadata from `app/build.gradle` and `RELEASE_NOTES.md`.
4. Run JavaScript syntax and runtime regression checks.
5. Build `:app:assembleDebug`.
6. Publish `Swoop-TV-v0.8.32-Google-TV-Test.apk` and overwrite the stable `Swoop-TV-v0.8.1-Google-TV-Test.apk` asset.

The stable release path preserves **Downloader code 3682231**. The installed application reports **0.8.32 / versionCode 832**.
