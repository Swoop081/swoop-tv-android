# Swoop TV Android — Running Fixes & Hardware Verification

## Current build under test

**v0.8.29 — Google TV Hardware Consolidation + Stability Pass**

## Implemented — needs physical-TV verification

- [ ] Home Top 100 Movies can browse 1 → 100 without stopping around 25–27.
- [ ] Home Top 100 TV Shows can browse 1 → 100 without stopping around 25–27.
- [ ] Home adds provider Recently Added Movies + Recently Added TV Shows beneath Top 100.
- [ ] Home / Movies / TV Shows hero artwork fills the frame without black side bars while protecting faces with top-biased framing.
- [ ] Vertical D-pad movement preserves the visual X/column between poster rows.
- [ ] Who's Watching is substantially larger and first profile owns focus immediately.
- [ ] Live TV category cards use TV-readable sizing; preview remains hidden until Media3 is ready; Live DOM work remains bounded.
- [ ] STARmeter uses large circular portraits/prominent ranks and single-flight progressive catalogue hydration without stalling around #20.
- [ ] Movie/person detail actions/cast/back/bottom spacing and richer metadata are TV-friendly.
- [ ] Series seasons are left-aligned; episode cards are reachable and show thumbnail/air date/runtime/synopsis where available.
- [ ] Up navigation can return from episodes/person results to the top/Back control without trapping focus.
- [ ] Primary tabs destroy stale detail/person overlays so an old actor page cannot reappear over Live TV/Home.
- [ ] Guide restores durable EPG cache before refresh and HW TEST reports Guide focus state rather than `focus none`.
- [ ] v0.8.28 warm-start seed and v0.8.27 diagnostic/export workflow remain intact.

## Critical regression gates

- [ ] NAV-001
- [ ] NAV-002
- [ ] NAV-003
- [ ] PROFILE-001
- [ ] LIVE-001
- [ ] STAR-001
- [ ] DETAIL-001
- [ ] ROUTE-001
- [ ] GUIDE-001
- [ ] PERF-001
- [ ] STAB-001

## Verified / closed from earlier builds

- [x] v0.8.18 profile-selection → Home runtime crash.
- [x] Top 100 rank-number clipping/safe inset presentation.
- [x] `100 available` labels removed.
- [x] Visible duplicate Home title filtering.
- [x] Google TV poster dark-gradient/haze removal.
- [x] v0.8.20 blank-Home-row regression repaired in v0.8.21.
- [x] Live TV right-side branding expansion in v0.8.22.
- [x] v0.8.23 What's New background-focus/frozen-screen regression repaired in v0.8.24.

Items move to **Verified / closed** only after confirmation on physical Google TV hardware.
