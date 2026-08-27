# Swoop TV v0.8.28 — Google TV Whole-App Warm-Start Seed Cache

Current Android/Google TV source baseline.

## v0.8.28 highlights

- Bundles `app/src/main/assets/seed-cache.json` as a provider-neutral install-time warm cache.
- GitHub Actions refreshes the seed immediately before building the APK.
- Seed covers current discovery inputs, STARmeter Top 100 people, pre-resolved person identities/filmography where available, popular title metadata and optional episode metadata.
- Top 100 can match the bundled discovery snapshot to the user's provider library immediately, then refresh newer ranking inputs in the background.
- STARmeter and People Search use the bundled people cache before remote person lookups.
- Popular title metadata can resolve from bundled TMDb/IMDb/title-year records before hitting the metadata service.
- Provider-specific/private data is never seeded: credentials, provider catalogue, profiles, My List, Continue Watching, watch history and live EPG remain local/dynamic.
- Retains v0.8.27 Hardware Test Mode and all v0.8.26 performance/navigation/stability work.

## Android package

- applicationId: `tv.swoop.player`
- versionName: `0.8.28`
- versionCode: `828`
- minSdk: 23
- target/compile SDK: 36
- Media3 / ExoPlayer: 1.11.0
- AndroidX WebKit: 1.15.0

## Seed-cache build flow

`node scripts/refresh-seed-cache.mjs` refreshes provider-neutral discovery/metadata and writes both:

- `app/src/main/assets/seed-cache.json` — bundled into the APK.
- `swoop-tv-seed-cache.json` — release/debug copy.

The refresh script is fault tolerant. If a network source is unavailable it preserves the last good bundled section rather than producing an empty APK cache.

For an intentionally offline source-package verification run:

`SWOOP_SEED_OFFLINE=1 node scripts/refresh-seed-cache.mjs`

## APK build

The included GitHub Actions workflow installs Android SDK 36 + Gradle 9.5.0, refreshes the seed, runs runtime checks, builds the debug-signed TV APK, publishes the versioned asset and overwrites the stable Downloader asset used by code **3682231**.
