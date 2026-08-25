# Swoop TV v0.8.3 — Google TV Startup Responsiveness

Android TV / Google TV hardware-test branch built from the Swoop TV v0.7.45 product baseline.

## v0.8.3 focus

- Stops Android TV from auto-refreshing the entire IPTV provider before the app becomes usable. Provider refresh is now user-initiated on Google TV.
- Makes profile selection transition immediately into Home instead of leaving the profile screen apparently frozen while a large saved library restores.
- Restores the saved library behind a lightweight, navigable Home loading state.
- Forces a profile-entered Home session to start at the top instead of inheriting a stale browser scroll position.
- Adds a large-library TV fast path so Home does not synchronously build full movie/live source-stack indexes before accepting remote input.
- Limits Home rails to TV-sized initial card sets and only mounts three rows eagerly, reducing DOM/focus geometry work on each D-pad press.
- Disables automatic Home discovery refresh during the large-library TV fast path so remote navigation cannot be blocked by full-catalog matching work immediately after launch.
- Changes TV focus scrolling from smooth animation to immediate movement for snappier D-pad response.
- Preserves the v0.8.2 density/safe-area pass, v0.7.45 playlist expiry/no-demo cleanup, Android Back, HTTP IPTV support and Media3 playback.

## Downloader test channel

The GitHub Actions workflow still replaces the stable test asset at:

`google-tv-test-v0.8.1 / Swoop-TV-v0.8.1-Google-TV-Test.apk`

That keeps **Downloader code 3682231** valid. The installed app reports **0.8.3 (803)**, and the workflow also publishes `Swoop-TV-v0.8.3-Google-TV-Test.apk` for version tracking.

The bundled signing key is test-only. Never use it for production.
