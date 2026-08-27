# Swoop TV v0.8.29 Verification Results

Verified in the packaging runtime on 27 August 2026.

- JavaScript syntax: **PASS** — every JavaScript module under `app/src/main/assets` passes `node --check`.
- Card runtime smoke: **PASS** — `card runtime smoke passed`.
- Google TV UI/runtime smoke: **PASS** — `Google TV UI runtime smoke passed`.
- v0.8.29 regression guards: **PASS** — 100-item Home completion path, five eager Home rows, stale detail/person teardown, first-profile focus, STARmeter single-flight hydration, Guide diagnostic states, ready-only native preview visibility, explicit detail/episode focus routing, full-bleed hero framing and enlarged profile/episode treatments are present.
- Install seed schema: **PASS** — schema 2, sourceVersion 0.8.29, 100 unique STARmeter people.
- Release seed JSON: **PASS** — root and Android-asset copies parse successfully.
- Bundled/release STARmeter manifests: **PASS** — 100 unique contiguous ranks and matching release copy.
- Latest-version/build metadata JSON: **PASS** — v0.8.29 / versionCode 829.
- GitHub Actions YAML: **PASS**.
- Android version alignment: **PASS** — Gradle 0.8.29 / 829, app UI marker 0.8.29, native JavaScript bridge/diagnostic version 0.8.29 and Android User-Agent 0.8.29.
- Service-worker shell cache: **PASS** — `swoop-tv-v0829-shell`.

## Seed snapshot note

This packaging runtime has no outbound metadata access. `SWOOP_SEED_OFFLINE=1 node scripts/refresh-seed-cache.mjs` therefore produced a valid provider-neutral fallback seed containing the complete 100-name STARmeter ranking but no freshly network-enriched person identities/filmographies/discovery/title metadata. This is expected.

The included GitHub Actions workflow runs `scripts/refresh-seed-cache.mjs` **before Gradle assembles the APK**. On the connected CI runner it can enrich current discovery data, STARmeter identities/portraits/selected filmographies and popular title metadata, validates that snapshot, and then packages that exact asset into the APK. A failed endpoint preserves usable fallback/previous data rather than blocking startup.

No IPTV credentials, provider catalogue, profiles, My List, Continue Watching/watch history or live EPG are bundled in the install seed.

## APK compilation

A binary APK is **not** compiled in this packaging runtime because Gradle 9.5.0 and Android SDK 36 are not installed here. The included GitHub Actions workflow remains the authoritative APK build/compile gate and publishes both the versioned v0.8.29 APK and the stable Downloader-code-3682231 APK asset.
