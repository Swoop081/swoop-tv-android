# Swoop TV v0.8.2 — Google TV test build

This Android TV shell embeds the Swoop TV v0.7.45 product build and packages it as `tv.swoop.player` for Google TV / Android TV hardware testing.

## GitHub Actions — recommended test build

1. Put this project at the root of the same GitHub repository used for the first Google TV test.
2. Open **Actions** → **Build Swoop TV Google TV APK**.
3. Leave **Publish/update the stable Google TV test APK used by Downloader code 3682231** enabled.
4. Choose **Run workflow**.
5. The workflow builds the real v0.8.2 APK and also copies it to the existing stable compatibility filename.
6. The existing release path remains:

   `https://github.com/OWNER/REPO/releases/download/google-tv-test-v0.8.1/Swoop-TV-v0.8.1-Google-TV-Test.apk`

That path is intentionally unchanged so **Downloader code 3682231** continues to fetch the newest test build. The APK installed from it reports **Swoop TV 0.8.2 / versionCode 802**.

The workflow also publishes `Swoop-TV-v0.8.2-Google-TV-Test.apk` beside the compatibility alias for clean version tracking.

A private repository can still build the APK, but Downloader cannot use a private release asset without GitHub authentication.

## Update on Google TV

1. Push/replace the project files in the GitHub repository.
2. Run the Android TV workflow with publishing enabled.
3. On Google TV open **Downloader**.
4. Enter **3682231**.
5. Install the downloaded APK and choose **Update** when Android prompts.

The app ID and test signing identity are unchanged, so test data/providers should remain in place.

## Local Android build

Requirements:
- JDK 17
- Android SDK Platform 36
- Android SDK Build Tools 36.0.0
- Gradle 9.5.0

From the project root:

```bash
gradle :app:assembleDebug
```

Output:

```text
app/build/outputs/apk/debug/app-debug.apk
```
