# Swoop TV v0.8.1 — Google TV Test

Google TV / Android TV hardware-test branch built from **Swoop TV v0.7.45 — Production Polish + Playlist Expiry**.

## Included
- Existing Swoop TV HTML/CSS/JavaScript interface embedded in a native Android TV shell.
- Application ID `tv.swoop.player`.
- Android TV / Google TV launcher declarations and 320×180 TV banner.
- Landscape immersive mode.
- 10-foot focus treatment and spatial D-pad navigation.
- Android Back integration with Swoop TV routes and overlays.
- Native Media3/ExoPlayer playback for Live TV, movies and episodes.
- Remote pause/resume, seek and live URL switching.
- Direct native Xtream/M3U/XMLTV fetching, including plain HTTP IPTV endpoints.
- Secure WebView app-assets origin for the embedded ES-module UI.
- WebView renderer recovery by Activity recreation.
- v0.7.45 playlist expiry, production-copy cleanup and true empty-library behaviour.

## Test-build status

This branch is intended for physical Google TV testing. The debug APK should not be treated as a production-distribution build. Complete `ANDROID_TV_CERTIFICATION.md` on real hardware before promoting the TV branch.

See `BUILD_APK.md` for GitHub Actions, local build and Downloader installation instructions.

## Test signing

The Google TV test branch uses an intentionally non-secret, test-only signing key so repeated v0.8.x hardware builds can update the installed app without wiping its data. Production releases must use a separate private signing key.
