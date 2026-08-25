# Swoop TV v0.8.1 — Google TV test build

This Android TV shell embeds the Swoop TV v0.7.45 product build and packages it as `tv.swoop.player` for Google TV / Android TV hardware testing.

## GitHub Actions — recommended test build

1. Put this project at the root of a GitHub repository.
2. Open **Actions** → **Build Swoop TV Google TV APK**.
3. Leave **Publish/update the v0.8.1 Google TV test release for Downloader** enabled.
4. Choose **Run workflow**.
5. The workflow builds `Swoop-TV-v0.8.1-Google-TV-Test.apk`, stores it as an Actions artifact, and publishes it to the prerelease tag `google-tv-test-v0.8.1`.
6. For a **public repository**, the workflow summary prints the direct Downloader URL. It has this form:

   `https://github.com/OWNER/REPO/releases/download/google-tv-test-v0.8.1/Swoop-TV-v0.8.1-Google-TV-Test.apk`

A private repository can still build the APK, but Downloader cannot use the private release URL without GitHub authentication; use the downloaded APK from the Actions artifact and host it at an accessible HTTPS URL instead.

The workflow installs Android SDK 36 / Build Tools 36.0.0, JDK 17 and Gradle 9.5.0, then creates a test-signed APK suitable for hardware testing. The repository contains a **test-only** signing key so v0.8.x test APKs keep the same signing identity and can install over earlier test builds while preserving app data. Never use this key for a production release.

## Install with Downloader on Google TV

For the simplest living-room test flow, host `Swoop-TV-v0.8.1-Google-TV-Test.apk` at a direct HTTPS download URL you control, then:

1. Install **Downloader** on Google TV.
2. Allow Downloader to **Install unknown apps** in Google TV settings.
3. Enter the direct APK URL in Downloader.
4. Download the APK and choose **Install**.
5. Launch **Swoop TV** from the Google TV Apps screen.

Later v0.8.x test builds use the same `tv.swoop.player` application ID and the included test-only signing identity, so Android can install them over the previous test build and preserve app data. A production release must use a separate permanent private release key; do not reuse the test key.

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
