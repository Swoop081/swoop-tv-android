# Swoop TV Android — Running Fixes & Hardware Verification

## Current build under test

**v0.8.39 — Profile Preparation + Player Experience Pass**

## Implemented — needs physical-TV verification

- [ ] **PROFILE-PREP-001:** Who’s Watching shows a simple visible progress bar while startup preparation runs; no technical STARmeter status copy is required.
- [ ] **PROFILE-FOCUS-001:** profile selection focus is drawn only around the avatar, with no large white rectangle around the whole profile tile.
- [ ] **HOME-TAIL-001:** the final Home rail has a clear ~210 px blank tail beneath it and no longer stops flush against the bottom of the TV.
- [ ] **PLAYER-001:** native VOD/episode playback has premium TV controls with visible buffering, rewind/fast-forward, subtitle selection and an Audio/Playback settings path.
- [ ] **PLAYER-AUDIO-001:** sources exposing multiple audio tracks can switch tracks through the Media3 settings UI.
- [ ] **PLAYER-SUB-001:** embedded subtitles are selectable and provider/sideloaded subtitle URLs are attached when present.

- [ ] **PACK-001:** first provider connection performs one deliberate Performance Pack optimisation pass and caches priority artwork without breaking provider setup.
- [ ] **PACK-002:** subsequent launches restore the durable catalogue/artwork/metadata cache before network refresh work and feel materially faster.
- [ ] **PACK-003:** unchanged provider refresh reports a zero/small delta and does not repeat a full artwork pass.
- [ ] **PACK-004:** provider additions/removals only trigger changed-item cache work; unchanged catalogue chunks are retained.
- [ ] **PACK-005:** installing a newer APK over v0.8.37 preserves Performance Pack/IndexedDB/Cache Storage state.
- [ ] **STAR-RETAIN-001:** STARmeter matches survive restart and rank movement for up to 90 days; only new people need first-time provider matching.
- [ ] **STAR-HOLD-001:** holding/long-pressing a directional D-pad key freezes STARmeter hydration until release and never produces duplicate/ghost rows.
- [ ] **STAR-PAINT-001:** rapid Up/Down STARmeter navigation paints each person exactly once; no duplicated rank, portrait, name or library metadata trails remain.
- [ ] **STAR-PATCH-001:** async STARmeter matching only patches inactive library columns after focus settles; no full-page rerender or focused-row mutation occurs.
- [ ] **STAR-STARTUP-001:** STARmeter can no longer stop at 28% with “batch match did not complete”; profile selection remains immediate and STARmeter opens to a usable 100-person surface even while background matching continues.
- [ ] **STAR-BATCH-001:** pre-login provider matching progresses in small batches, preserves completed people if a later batch is slow, and automatically retries unfinished work.
- [ ] **TOP-001:** after scrolling any top-level route deep down, returning focus to the active fixed top navigation tab restores the document to its true original top (`scrollY = 0`).
- [ ] **MYSWOOP-TOP:** My SwoopTV bottom → first rail → Up restores the full My SwoopTV heading/description, not just the first Simpsons/Continue Watching cards.
- [ ] **STAR-PRELOAD:** Who’s Watching begins preparing all 100 STARmeter people before login; STARmeter opens from completed provider-match data rather than focus-driven loading.
- [ ] **STAR-GEOMETRY:** STARmeter person rows never paint/stack into the next person while posters are loading or focused.
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
