# Swoop TV Android — Running Fixes & Hardware Verification

## Current baseline
**v0.8.26 — Google TV Performance + Stability + Hardware Polish**

## Implemented — needs TV verification
- [ ] Top 100 Movies can move continuously beyond the previous item 26 stop and through every available ranked result.
- [ ] Top 100 TV Shows can move continuously beyond the previous item 25 stop and through every available ranked result.
- [ ] Movies/TV Shows large rails fetch the next 100-item batch without a dead key press or vertical escape.
- [ ] Down from a poster lands on the poster visually underneath in the next row rather than the row end.
- [ ] Home hero artwork is fully visible without cutting off faces/heads; carousel is a small 10-dot indicator only.
- [ ] Movies and TV Shows hero sizing/framing matches the approved Home hero.
- [ ] Search is reachable from the persistent top header and receives focus immediately when opened.
- [ ] Live TV preview is narrower/lower; channel logo is smaller/centred; Browse Live TV tiles match Recent Channels size.
- [ ] Focusing Live TV channel tiles updates hero logo immediately and muted preview after focus settles.
- [ ] STARmeter uses large circular person portraits, prominent ranks and large title rails with only a small visible hydration window.
- [ ] Rapid navigation through STARmeter/Live TV no longer produces prolonged layout churn, placeholder storms or multi-second freezes.
- [ ] Repeated tab switching/large list browsing does not trigger a black screen/WebView renderer reset back to profiles.

## Carry-forward verification
All unresolved v0.8.25/v0.8.24 hardware items remain subject to physical-TV verification unless superseded above.

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
