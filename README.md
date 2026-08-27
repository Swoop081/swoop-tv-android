# Swoop TV v0.8.26 — Google TV Performance + Stability + Hardware Polish

Swoop TV is a content-neutral IPTV player. This source package is the current Google TV / Android TV hardware-test branch.

## v0.8.26 highlights

- Fixes asynchronous long-rail boundaries so Right keeps moving through Top 100 and large Movies/TV Shows rows while the next 100-item batch loads.
- Advances the Top 100 ranking schema and improves IPTV title-match recall while keeping the rankings driven by current external trending signals.
- Virtualises STARmeter and Live TV background work to keep D-pad input responsive and reduce WebView memory pressure.
- Redesigns STARmeter with large circular cast-style portraits, prominent ranks and larger provider-available title rails.
- Stops Android from retaining heavy Live TV / STARmeter / Movies / TV Shows DOM trees after leaving those tabs.
- Makes Home featured artwork fully fit its frame and replaces the oversized carousel control with a tiny non-focusable 10-dot indicator.
- Gives Movies and TV Shows the same approved TV hero height/framing as Home.
- Refines Live TV preview/logo proportions and restores all Browse Live TV category tiles to the Recent Channels physical size.
- Makes Search / Providers / Settings / Profile deterministic in the persistent header and focuses Search input immediately when opened.
- Retains the episode metadata, Guide logo, Continue Watching long-press and modal-focus work from v0.8.25/v0.8.24.

## Android package

- Application ID: `tv.swoop.player`
- versionName: `0.8.26`
- versionCode: `826`
- minSdk: `23`
- targetSdk / compileSdk: `36`
- Java: `17`
- AndroidX Media3 / ExoPlayer: `1.11.0`
- AndroidX WebKit: `1.15.0`

## APK build path

The authoritative APK build path is `.github/workflows/android-tv-apk.yml`.

The workflow publishes:

- `Swoop-TV-v0.8.26-Google-TV-Test.apk`
- stable compatibility asset `Swoop-TV-v0.8.1-Google-TV-Test.apk`
- `swoop-tv-latest.json`
- `swoop-tv-starmeter.json`

The stable APK asset preserves the existing **Downloader code 3682231** test path.

## Runtime verification

Before packaging v0.8.26, run:

```bash
find app/src/main/assets -name '*.js' -print0 | xargs -0 -n1 node --check
node tests/card-runtime-smoke.mjs
node tests/tv-ui-runtime-smoke.mjs
python -m json.tool app/src/main/assets/starmeter.json >/dev/null
python -m json.tool swoop-tv-starmeter.json >/dev/null
```

See `ANDROID_TV_CERTIFICATION.md` for the physical-TV checklist and `TV_HARDWARE_RUNNING_FIXES.md` for the running hardware-verification ledger.
