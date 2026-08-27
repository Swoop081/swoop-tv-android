# Swoop TV v0.8.32 Verification Results

- JavaScript syntax: **PASS** — `app.js` and the catalogue index worker parse successfully.
- Card runtime smoke: **PASS**.
- Google TV UI runtime smoke: **PASS**, including new v0.8.32 regression guards.
- STARmeter fixed-surface contract: **PASS** — all 100 ranked people are mounted with fixed-height TV row geometry.
- STARmeter hydration contract: **PASS** — bounded 3-way concurrency, priority queueing and 18-person look-ahead are present.
- STARmeter filmography layout contract: **PASS** — bounded larger horizontal title cards replace the tiny full-credit strip.
- Home/Top 100 directional artwork contract: **PASS** — focus promotes a 24–32-card window instead of relying only on viewport lazy loading.
- Hero artwork contract: **PASS** — prewarming uses `w1280` backdrops; old hero content remains until replacement visuals are ready/timeout; title text remains until a title logo is ready.
- Android entry prewarm contract: **PASS** — Home artwork can warm while the profile UI remains displayed, with destination prewarming for Live/Guide/STARmeter.
- Live preview contract: **PASS** — web preview chrome remains visually absent until native Media3 preview activation; native preview itself remains hidden until `Player.STATE_READY`.
- Guide presentation contract: **PASS** — channel logos are scaled within their existing cells; Guide geometry remains unchanged.
- Android cold-launch contract: **PASS** — theme + runtime overlay use the Swoop TV launch logo and the overlay fades after WebView page completion.
- Warm-start seed: **PASS** — schema remains valid, sourceVersion 0.8.32, 100 STARmeter people retained.
- Build/update metadata: **PASS** — 0.8.32 / versionCode 832.
- Direct source parent SHA-256 recorded for the uploaded v0.8.31 baseline.

Binary APK compile was **not available in this packaging runtime**: there is no Gradle executable/wrapper JAR and no Android SDK configured. The included GitHub Actions workflow remains the authoritative APK compile gate.
