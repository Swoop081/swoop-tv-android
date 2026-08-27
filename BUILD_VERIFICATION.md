# Swoop TV v0.8.25 Build Verification

## Static/runtime gates

- [ ] Every JavaScript file under `app/src/main/assets` passes `node --check`.
- [ ] `tests/card-runtime-smoke.mjs` passes.
- [ ] `tests/tv-ui-runtime-smoke.mjs` passes.
- [ ] `app/src/main/assets/starmeter.json` parses and contains exactly 100 unique ranks 1–100.
- [ ] Root `swoop-tv-starmeter.json` matches the bundled manifest.
- [ ] Android markers are aligned to `versionName 0.8.25` / `versionCode 825`.
- [ ] MainActivity User-Agent/version bridge reports `0.8.25`.
- [ ] GitHub Actions publishes the versioned APK, stable Downloader APK, latest-version manifest and STARmeter manifest.
- [ ] Source ZIP integrity test passes and SHA-256 is recorded.

## v0.8.25 regression contracts

- [ ] Right from Top 100 Movies item 24 reaches item 25 in the same row; it cannot jump to Top 100 TV Shows.
- [ ] Home Top 100 can continue through rank 100 when 100 genuine matches exist.
- [ ] Movies/TV Shows category rails can continue beyond 25 and beyond 100 through subsequent 100-item data batches.
- [ ] Moving Down from a middle-screen poster chooses the visually nearest card in the row below.
- [ ] STARmeter appears after Guide and before Movies and progressively hydrates provider-available title rails.
- [ ] People Search consults the STARmeter hot cache first.
- [ ] Home hero uses the approved enlarged bounded TV height and all poster rails use consistent safe-left inset.
- [ ] Live TV hero renders info left / preview centre / contained logo right; Browse Live TV cards use the larger TV sizing.
- [ ] Episode cards never show fake `0:00` and do not show generic “Play this episode from your connected provider” copy.
- [ ] Guide logo scaling does not alter Guide column/row geometry.
- [ ] IMDb rating badges use the reduced corner treatment.
- [ ] v0.8.24 What’s New still traps focus and background scroll correctly.
