# Swoop TV v0.8.28 Verification Results

Verified in the packaging runtime on 27 August 2026.

- JavaScript syntax: **PASS** — every JavaScript module under `app/src/main/assets`.
- Card runtime smoke: **PASS** — `card runtime smoke passed`.
- Google TV UI/runtime smoke: **PASS** — `Google TV UI runtime smoke passed`.
- Install seed helper smoke: **PASS** — people search/person lookup succeeds and strict title matching rejects a false title.
- Install seed schema: **PASS** — schema 2, sourceVersion 0.8.28, full 100-person STARmeter list.
- Release seed schema: **PASS** — root and Android asset seed JSON both parse successfully.
- Bundled/release STARmeter JSON: **PASS**.
- Generated latest-version manifest JSON: **PASS**.
- Build metadata generation: **PASS** — v0.8.28 / versionCode 828.
- GitHub Actions YAML: **PASS**.
- Android version alignment: **PASS** — application versionName 0.8.28 / versionCode 828 and native User-Agent/diagnostics version markers match.

## Seed snapshot note

The local packaging runtime has no outbound metadata access, so the source ZIP contains a valid provider-neutral fallback seed with the full 100-name STARmeter list but no freshly network-enriched discovery, person identity/filmography, or popular-title metadata rows. This is expected.

The included GitHub Actions workflow runs `scripts/refresh-seed-cache.mjs` **before Gradle assembles the APK**. On the connected CI runner it refreshes current provider-neutral discovery data, STARmeter identities/portraits/selected filmographies, and popular title metadata, writes the refreshed `app/src/main/assets/seed-cache.json`, validates it, and then packages that exact snapshot into the APK. If a refresh endpoint is temporarily unavailable, the last valid seed remains usable rather than failing the build or producing an empty app.

No IPTV credentials, provider catalogue, profiles, My List, Continue Watching/watch history, or live EPG data are included in the seed.

A local APK binary is not produced in this runtime because Gradle/Android SDK 36 are not installed. The included GitHub Actions workflow remains the authoritative APK build path.
