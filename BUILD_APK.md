# Swoop TV v0.8.27 — Google TV test build

## GitHub Actions

1. Commit/push this source tree to the Swoop TV repository.
2. Open **Actions → Android TV APK**.
3. Run the workflow or let the configured trigger run it.
4. The workflow builds the debug/test APK using the project Gradle wrapper/toolchain.
5. Download `Swoop-TV-v0.8.27-Google-TV-Test.apk` from the workflow/release assets.

The workflow also overwrites the stable compatibility asset:

`Swoop-TV-v0.8.1-Google-TV-Test.apk`

That stable path preserves **Downloader code 3682231**. The installed application reports **0.8.27 / versionCode 827**.

The workflow additionally generates version/APK naming and release metadata from `app/build.gradle` + `RELEASE_NOTES.md`, publishes `swoop-tv-latest.json` for non-blocking update checks, `swoop-tv-starmeter.json` for STARmeter, and includes the numbered hardware-test checklist in its artifact.

## Local build

A normal local build requires Java 17, Android SDK 36 and the Gradle/Android toolchain expected by the project. If those are installed, use the project Gradle wrapper and build the app debug APK in the normal Android `app/build/outputs/apk` location.
