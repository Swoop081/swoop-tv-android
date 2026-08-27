# Swoop TV v0.8.31 Verification Results

- JavaScript syntax: **PASS** — all bundled JS modules parse successfully.
- Card runtime smoke: **PASS**.
- Google TV UI runtime smoke: **PASS**.
- STARmeter indexed matching: **PASS** — synthetic provider catalogue test matches IPTV-prefixed movie names, exact/near-year aliases, leading-article variants and TV-series credits without scanning the entire catalogue per credit.
- STARmeter durable-catalogue guard: **PASS** — Android person matching will not treat the small cached Home snapshot as the complete provider library.
- STARmeter warm-start seed contract: **PASS** — GitHub seed generation defaults to all 100 people and keeps original title/name credit aliases.
- STARmeter portrait prefetch contract: **PASS** — identity hydration looks eight people ahead and background identity prewarming remains active while STARmeter is open.
- Guide entry/banner contract: **PASS** — primary Guide entry resets to the true top and the explicit LIVE TV / TV Guide / date/current-time banner precedes All Channels + the two-hour EPG.
- Warm-start seed: **PASS** — schema valid, sourceVersion 0.8.31, 100 unique STARmeter people.
- Build/update metadata: **PASS** — 0.8.31 / versionCode 831.
- GitHub Actions YAML: **PASS**.

A binary APK is **not** compiled in this packaging runtime because Android SDK 36 / Gradle 9.5.0 are not installed here. The included GitHub Actions workflow remains the authoritative APK compile gate and publishes both the versioned v0.8.31 APK and the stable Downloader-code-3682231 APK asset.
