# Swoop TV v0.8.33 Verification Results

- JavaScript syntax: **PASS** — app/runtime modules and catalogue index worker parse successfully.
- Card runtime smoke: **PASS**.
- Google TV UI runtime smoke: **PASS**, including v0.8.33 route-top and pre-login STARmeter regression guards.
- STARmeter batch worker functional smoke: **PASS** — seeded people are matched correctly to movie/TV catalogue entries in one `person-match-batch` request.
- Route-top contract: **PASS** — active top-navigation focus uses a multi-frame `scrollY = 0` restoration path and first-row Up can explicitly return to the current route tab.
- STARmeter pre-login contract: **PASS** — preparation starts from Android bootstrap while Who’s Watching is visible and profile selection awaits an in-flight preparation attempt before entering the app.
- STARmeter full-surface contract: **PASS** — Android uses a whole-page preparation state until the complete batch is ready, preventing mixed loaded/loading rows from becoming focusable.
- STARmeter geometry contract: **PASS** — permanent rows are increased to 430px with extra inter-row safety space.
- Warm-start seed: **PASS** — schema remains valid, sourceVersion 0.8.33, 100 STARmeter people retained.
- Build/update metadata: **PASS** — 0.8.33 / versionCode 833.

Binary APK compilation remains the GitHub Actions gate because the source packaging runtime does not include Android SDK 36/Gradle.
