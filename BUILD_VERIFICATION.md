# Swoop TV v0.8.29 Build Verification

## Version alignment
- [ ] `app/build.gradle` is `versionName 0.8.29` / `versionCode 829`.
- [ ] `ANDROID_CURRENT_VERSION` and Android bridge/User-Agent markers report 0.8.29.
- [ ] Diagnostic export filenames identify v0.8.29.

## Whole-app seed contracts
- [ ] `app/src/main/assets/seed-cache.json` parses and has schema >= 2.
- [ ] Seed sourceVersion is `0.8.29`.
- [ ] Seed contains exactly 100 ranked STARmeter people.
- [ ] Runtime imports `src/seedCache.js`.
- [ ] Discovery uses bundled seed before a blocking network refresh.
- [ ] STARmeter/People Search use seeded people identities/credits when available.
- [ ] Title metadata checks bundled TMDb/IMDb/title-year metadata before network.
- [ ] Episode metadata uses seed when present and otherwise hydrates asynchronously.
- [ ] No provider credentials, provider-specific catalogue, personal viewing/profile data or live EPG are written into the seed.
- [ ] CI refreshes the install seed before APK compilation and publishes the release copy.

## Regression gates
- [ ] All asset JavaScript passes `node --check`.
- [ ] `tests/card-runtime-smoke.mjs` passes.
- [ ] `tests/tv-ui-runtime-smoke.mjs` passes.
- [ ] STARmeter and seed JSON manifests validate.
- [ ] GitHub Actions YAML parses.
