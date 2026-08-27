# Swoop TV Android — Running Fixes & Hardware Verification

## Current build under test

**v0.8.32 — Google TV STARmeter Matching + Guide Banner Hotfix**

## Implemented — needs physical-TV verification

- [ ] **NAV-001:** Top 100 Movies browses continuously from #1 through #100 with no stop at #25–27.
- [ ] **NAV-002:** Top 100 TV Shows browses continuously from #1 through #100.
- [ ] **NAV-003:** Up/Down preserves the visual poster column between rails.
- [ ] **MYSWOOP-001:** My SwoopTV appears directly after Home and contains Continue Watching, saved titles, Favourite Channels and Recently Watched; Home no longer contains Continue Watching/My List.
- [ ] Home keeps the approved hero size and presents a fuller 3–4-line featured synopsis.
- [ ] **LIVE-001:** Every Browse Live TV/category tile has the exact same usable size/spacing as Recent Channels; logo updates immediately and preview follows after focus settles.
- [ ] **GUIDE-001:** approved left category sidebar is unchanged; Guide opens at the true top with a clearly visible LIVE TV / TV Guide date/time banner above All Channels + the two-hour EPG.
- [ ] **STAR-001:** STARmeter resolves real provider-available titles using the full durable library, expanded ID/title/year matching, and can browse #1–#100 without trapping focus.
- [ ] STARmeter transient matching failures retry automatically, then become a stable clean state rather than trapping focus.
- [ ] **PROFILE-001:** Who’s Watching opens with first profile focused and large animal avatars.
- [ ] **DETAIL-001:** seasons/episodes/cast/detail pages remain reachable in both directions and preserve episode metadata/artwork.
- [ ] **ROUTE-001:** stale person/detail views cannot reappear over another primary tab.
- [ ] **PERF-001 / STAB-001:** mixed-screen navigation remains responsive without WebView renderer resets.
- [ ] v0.8.28 warm-start seed cache and v0.8.27 diagnostic/export workflow remain intact.

## Verified / closed from earlier builds

- [x] v0.8.18 profile-selection → Home runtime crash.
- [x] Top 100 rank-number clipping/safe inset presentation.
- [x] `100 available` labels removed.
- [x] Visible duplicate Home title filtering.
- [x] Google TV poster dark-gradient/haze removal.
- [x] v0.8.20 blank-Home-row regression repaired in v0.8.21.
- [x] Live TV right-side branding expansion in v0.8.22.
- [x] v0.8.23 What’s New background-focus/frozen-screen regression repaired in v0.8.24.

Items move to **Verified / closed** only after confirmation on physical Google TV hardware.
