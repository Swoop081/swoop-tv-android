# Swoop TV v0.8.2 — Google TV Density + Safe-Area Test

Android TV / Google TV hardware-test branch built from the Swoop TV v0.7.45 product baseline.

## v0.8.2 focus

- Fixes the first-device feedback that the Google TV UI was oversized and controls/options could sit off-screen.
- Uses a 1440px logical TV viewport together with Android WebView wide-viewport + overview fitting.
- Removes the v0.8.1 108% TV font enlargement.
- Reduces top navigation, hero, content rails, settings cards, dialogs, provider management, title details, Guide and focus growth.
- Keeps remote focus clearly visible without enlarging the focused card enough to hide adjacent options.
- Preserves v0.7.45 playlist expiry, production copy cleanup and true empty-library behaviour.
- Preserves native Media3 playback, D-pad navigation, Android Back and HTTP IPTV compatibility.

## Downloader test channel

The GitHub Actions workflow continues to replace the existing stable test asset at:

`google-tv-test-v0.8.1 / Swoop-TV-v0.8.1-Google-TV-Test.apk`

This intentionally preserves the URL already shortened as **Downloader code 3682231**, while the installed Android app reports version **0.8.2 (802)**. The workflow also publishes a correctly versioned `Swoop-TV-v0.8.2-Google-TV-Test.apk` asset for archive/reference.

The bundled signing key is test-only. Never use it for a production release.
