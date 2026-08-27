# Swoop TV v0.8.27 Verification Results

Verified in the packaging runtime on 27 August 2026.

- JavaScript syntax: **PASS** — every JS module under app/src/main/assets.
- Card runtime smoke: **PASS** — card runtime smoke passed
- Google TV UI/runtime smoke: **PASS** — Google TV UI runtime smoke passed
- Build metadata generation: **PASS** — Generated build metadata for v0.8.27 (827)
- Bundled STARmeter JSON: **PASS**.
- Release STARmeter JSON: **PASS**.
- Generated latest-version manifest JSON: **PASS**.
- GitHub Actions YAML: **PASS** — GitHub Actions YAML parse passed
- Android version alignment: **0.8.27 / 827**.

A local APK binary is not produced in this runtime because Gradle/Android SDK are not installed. The included GitHub Actions workflow remains the authoritative APK build path.
