# Swoop TV v0.8.37 Verification Results

- JavaScript syntax: **PASS** — every JavaScript asset parses successfully.
- Card runtime smoke: **PASS**.
- Google TV UI runtime smoke: **PASS**, including v0.8.37 Performance Pack, incremental provider delta, retained STARmeter and held-D-pad regression guards.
- Provider delta functional smoke: **PASS** — initial additions, unchanged reordered input, changed artwork, new records and removed records produce the expected delta; provider fingerprint is order-independent.
- Durable catalogue incremental-write contract: **PASS** — schema 3 records chunk hashes and only writes chunks whose fingerprint changed.
- Artwork cache contract: **PASS** — `swoop-tv-artwork-v1` is persistent and excluded from shell-cache eviction; cross-origin images use a cache-first service-worker path.
- STARmeter retention contract: **PASS** — retained person/library rows are restored before first-time matching; 90-day retention and provider-fingerprint revalidation are wired.
- Held-D-pad contract: **PASS** — repeated keydown marks STARmeter mutation-blocked and keyup schedules deferred patch recovery only after settle.
- Route-top/stable-row/fail-open STARmeter regressions: **PASS**.
- Warm-start seed: **PASS** — schema valid, local sourceVersion 0.8.37 and 100 STARmeter people retained.
- Android XML resources: **PASS**.
- Build/update metadata generation: **PASS** — v0.8.37 / versionCode 837 metadata generated from the canonical release-note section.

Binary APK compilation remains the GitHub Actions gate because this local packaging runtime does not include Android SDK 36/Gradle.
