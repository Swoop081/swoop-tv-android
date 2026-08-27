# Swoop TV v0.8.25 — Google TV STARmeter + Navigation + Metadata Polish

Swoop TV is a content-neutral IPTV player. This source package is the current Google TV / Android TV hardware-test branch.

## v0.8.25 highlights

- Adds **STARmeter** between Guide and Movies. The bundled manifest contains the current 100-name IMDb STARmeter / Trending People ordering captured for this build; each person progressively resolves into movies and TV shows that are actually available in the connected Swoop TV library.
- Uses STARmeter people as a hot/prewarmed People Search cache so currently popular people can open substantially faster.
- Reworks Google TV rail navigation so Right/Left remains owned by the current rail and cannot spatially escape into another row at a lazy-render boundary.
- Large Home, Movies, TV Shows and Live TV rails load catalogue data in **100-item batches**, render lightweight chunks, prefetch the next batch before the boundary, and prewarm upcoming artwork.
- Up/Down now chooses the nearest card by on-screen X position, so moving down from the middle of one row lands on the card visually underneath rather than the end of the next row.
- Enlarges the Home hero while keeping it bounded beneath the persistent navigation and applies the approved rail safe-left inset consistently.
- Rebalances Live TV hero composition: channel information/actions on the left, delayed muted preview in the centre, contained channel branding on the right; Browse Live TV tiles are enlarged.
- Episode rows now prefer real original air date, synopsis and runtime. Invalid `0:00` runtimes and generic connected-provider placeholder copy are removed; enrichment is asynchronous and cached.
- Enlarges Guide channel/show logos inside their existing cells without changing Guide geometry.
- Makes IMDb poster-rating badges smaller and tighter to the corner.
- Retains v0.8.24 modal focus trapping, v0.8.23 adaptive scaling/update/changelog work, and all cumulative native Media3 playback/cache/provider fixes.

## Android package

- Application ID: `tv.swoop.player`
- versionName: `0.8.25`
- versionCode: `825`
- minSdk: `23`
- targetSdk / compileSdk: `36`
- Java: `17`
- AndroidX Media3 / ExoPlayer: `1.11.0`
- AndroidX WebKit: `1.15.0`

## APK build path

The authoritative APK build path is `.github/workflows/android-tv-apk.yml`.

The workflow publishes:

- `Swoop-TV-v0.8.25-Google-TV-Test.apk`
- stable compatibility asset `Swoop-TV-v0.8.1-Google-TV-Test.apk`
- `swoop-tv-latest.json`
- `swoop-tv-starmeter.json`

The stable APK asset preserves the existing **Downloader code 3682231** test path.

## Runtime verification

Before packaging v0.8.25, run:

```bash
find app/src/main/assets -name '*.js' -print0 | xargs -0 -n1 node --check
node tests/card-runtime-smoke.mjs
node tests/tv-ui-runtime-smoke.mjs
python -m json.tool app/src/main/assets/starmeter.json >/dev/null
python -m json.tool swoop-tv-starmeter.json >/dev/null
```

See `ANDROID_TV_CERTIFICATION.md` for the physical-TV checklist and `TV_HARDWARE_RUNNING_FIXES.md` for the running hardware-verification ledger.
