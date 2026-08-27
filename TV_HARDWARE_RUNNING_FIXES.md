# Swoop TV Android — Running Fixes & Hardware Verification

## Current build under test

**v0.8.27 — Google TV Hardware Test Workflow**

## Open

- [ ] Physical-TV verification of the v0.8.27 diagnostic workflow.
- [ ] Re-test the Top 100 Movies/TV 25–26 boundary using NAV-001/NAV-002 with exported diagnostics if it still fails.
- [ ] Re-test rapid D-pad performance and long-session renderer stability using PERF-001/STAB-001.

## Implemented — needs TV verification

- [ ] Five-press Settings shortcut toggles hidden Hardware Test Mode.
- [ ] Non-focusable HW TEST overlay reports page, focus row/index, DOM/card/image counts, pending jobs, key count and renderer-reset count without altering navigation.
- [ ] Numbered NAV/PERF/LIVE/STAR/STAB test sessions are selectable from Settings.
- [ ] Save Diagnostics writes a timestamped JSON session file on Android TV.
- [ ] D-pad/focus/route/activation/long-task/error events are captured in a bounded rolling log only while test mode is active.
- [ ] Native diagnostics include Java heap, preview/player state, WebView dimensions, renderer-loss metadata and native key counts.
- [ ] GitHub Actions derives version/APK naming/update manifest/release summary automatically from build.gradle + RELEASE_NOTES.md.
- [ ] Every v0.8.26 performance/navigation/visual fix remains intact.

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
