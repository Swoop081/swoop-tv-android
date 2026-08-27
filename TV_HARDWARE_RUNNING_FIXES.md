# Swoop TV Android — Running Fixes & Hardware Verification

## Current build under test

**v0.8.25 — Google TV STARmeter + Navigation + Metadata Polish**

## Open

No known post-v0.8.25 issue is marked open until physical-TV verification begins.

## Implemented — needs TV verification

- [ ] Long rails no longer escape vertically at ~24/25; 100-item batching/prefetch works across Home, Movies, TV Shows and Live TV.
- [ ] Up/Down preserves on-screen horizontal position between rows.
- [ ] Rapid D-pad vertical input is stable.
- [ ] Home hero uses the larger approved frame and consistent rail safe inset.
- [ ] STARmeter Top 100 people page, provider-title rails and People Search hot-cache path work on hardware.
- [ ] Live TV hero is left info / centre preview / right brand; Browse Live TV tiles are larger.
- [ ] Episode air date/synopsis/runtime enrichment is fast and correct; fake `0:00` is gone.
- [ ] Guide logos are larger without layout movement.
- [ ] IMDb badge is smaller/tighter to the corner.
- [ ] All v0.8.24 What’s New modal focus behaviour remains correct.

## Verified / closed before v0.8.25

- [x] v0.8.18 profile-selection → Home runtime crash.
- [x] Top 100 rank-number clipping/safe inset presentation.
- [x] `100 available` labels removed.
- [x] Visible duplicate Home title filtering.
- [x] Google TV poster dark-gradient/haze removal.
- [x] v0.8.20 blank-Home-row regression repaired in v0.8.21.
- [x] Live TV right-side branding expansion in v0.8.22.
- [x] v0.8.23 What’s New background-focus/frozen-screen regression repaired in v0.8.24.

Items move to **Verified / closed** only after confirmation on physical Google TV hardware.
