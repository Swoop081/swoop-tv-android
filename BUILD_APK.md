# Swoop TV v0.8.5 — Google TV test build

This Android TV shell embeds the Swoop TV v0.7.45 product build and packages it as `tv.swoop.player`.

## GitHub Actions

1. Replace the existing Google TV test repository contents with this project.
2. Open **Actions → Build Swoop TV Google TV APK**.
3. Leave **Publish/update the stable Google TV test APK used by Downloader code 3682231** enabled.
4. Run the workflow.
5. The workflow builds `Swoop-TV-v0.8.5-Google-TV-Test.apk` and also overwrites:

   `https://github.com/OWNER/REPO/releases/download/google-tv-test-v0.8.1/Swoop-TV-v0.8.1-Google-TV-Test.apk`

Because that compatibility path is unchanged, **Downloader code 3682231** continues to work. The installed APK reports **Swoop TV 0.8.5 / versionCode 805**.

## Update on Google TV

1. Publish the workflow build.
2. Open **Downloader** on Google TV.
3. Enter **3682231**.
4. Install and choose **Update**.

The app ID and test signing identity are unchanged, so providers and test data remain in place.

## Local Android build

Requirements: JDK 17, Android SDK 36, Build Tools 36.0.0 and Gradle 9.5.0.

```bash
gradle :app:assembleDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`.
