# Swoop TV v0.8.33 — Google TV Route Top + Pre-Login STARmeter Stability

Current Android/Google TV source baseline.

## v0.8.33 highlights

- Fixes the physical-TV top-scroll trap across top-level routes. Returning focus to the active top navigation tab now restores the document to its true top position, including My SwoopTV and STARmeter.
- Starts full STARmeter Top 100 preparation on the Who’s Watching screen before profile login.
- Matches all 100 STARmeter people to the restored provider catalogue in one indexed worker batch rather than person-by-person as focus reaches them.
- STARmeter does not expose partially assembled person rows on Google TV; if preparation is still finishing it shows one deliberate whole-page preparation state, then renders the completed 100-person surface.
- STARmeter row height/safety spacing is increased so enlarged poster rails and focused-card scaling cannot overlap the next person.
- Prewarms the Top 100 portraits plus representative filmography artwork before/while login completes.
- Retains all v0.8.32 Top 100 artwork/hero hydration, Live preview, Guide-logo and branded-launch work.

## Android package

- applicationId: `tv.swoop.player`
- versionName: `0.8.33`
- versionCode: `833`
- minSdk: 23
- target/compile SDK: 36
- Java: 17
- Media3 / ExoPlayer: 1.11.0
- AndroidX WebKit: 1.15.0

## Warm-start seed

GitHub Actions refreshes `seed-cache.json` immediately before APK compilation. Provider credentials, provider-specific catalogue, profiles, personal history and live EPG remain device-local and are never baked into the generic APK.

## Hardware diagnostics

Open **Settings**, focus the Settings cog and press **OK five times within four seconds** to enable Hardware Test Mode. Select the numbered test, reproduce the issue, then choose **Save Diagnostics**.

See `TV_HARDWARE_TEST_CHECKLIST.md` for the v0.8.33 physical-TV gates.

## APK build

The included GitHub Actions workflow installs Android SDK 36 + Gradle 9.5.0, refreshes the full warm-start seed, runs verification, builds the test APK and automatically overwrites/validates the stable Downloader asset used by code **3682231** after every successful `main` build.
