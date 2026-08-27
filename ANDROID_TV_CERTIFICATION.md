# Swoop TV v0.8.37 — Google TV hardware test checklist

## v0.8.37 diagnostic workflow

Before reproducing a hardware issue, enable **Hardware Test Mode** by focusing the Settings cog and pressing OK five times within four seconds. Select the matching NAV/PERF/LIVE/STAR/STAB test ID, reproduce the problem, photograph/video the HUD, then use **Settings → Hardware Test Mode → Save Diagnostics**. See `TV_HARDWARE_TEST_CHECKLIST.md` for the numbered procedure.

## v0.8.37 Performance Pack certification

- [ ] Fresh provider setup completes its one-time local optimisation and priority artwork warm.
- [ ] Warm relaunch uses saved catalogue/artwork immediately and does not present a cold-loading feel for already prepared surfaces.
- [ ] Unchanged provider refresh does not repeat full metadata/artwork work.
- [ ] Incremental provider changes only warm changed/new artwork.
- [ ] STARmeter retained people survive rank movement and restart; new entrants hydrate independently.
- [ ] Holding Down through 30+ STARmeter rows causes no ghost/duplicate painting and deferred hydration resumes only after release.

## Highest-priority navigation checks

- [ ] On Home Top 100 Movies, hold/tap Right past ranks 20–30. **24 → 25 must remain in Top 100 Movies.**
- [ ] Continue through ranks 80–100 with no vertical escape, blank-card wall or focus loss.
- [ ] On Movies New Releases, browse beyond 25 and beyond 100. The next 100-item data batch should already be available before the boundary.
- [ ] Repeat the same test on TV Shows and long Live TV rails.
- [ ] Focus a poster around the middle of a Movies row and press Down. Focus should land on the poster visually/directly underneath in the next row, not at the row end.
- [ ] Press Up/Down rapidly. Intended moves should not be dropped and focus should not jump unpredictably.

## Home

- [ ] Persistent top navigation remains visible.
- [ ] Home hero is roughly the newly approved larger frame (about double the previous v0.8.24 compact hero), but remains bounded below the navigation.
- [ ] Hero artwork stays clipped/contained within the masthead.
- [ ] Continue Watching and other poster rails use the same safe-left inset as Top 100.
- [ ] Continue Watching long-press OK opens More Options and Remove works.
- [ ] IMDb badges are smaller, corner-tight and legible without covering too much artwork.

## STARmeter / People

- [ ] STARmeter tab order is Home / Live TV / Guide / STARmeter / Movies / TV Shows / My List.
- [ ] STARmeter provider matching is already completed from the pre-login Who’s Watching preparation pass; opening STARmeter must not progressively assemble person rails.
- [ ] Selecting a person opens their person page immediately while any remaining catalogue hydration continues in the background.
- [ ] Search for a person currently in STARmeter and confirm the result/person route feels near-instant compared with an uncached person.
- [ ] STARmeter failure/retry does not trap focus or break navigation.

## Live TV

- [ ] Featured channel information and Watch Live actions are on the left.
- [ ] Muted preview appears in the centre only after focus settles; rapid channel navigation should not continuously restart previews.
- [ ] Full contained channel logo/branding appears on the right without cropping.
- [ ] Browse Live TV provider/category cards are approximately Recent Channels size and readable from TV distance.
- [ ] Recent Channels remain clean logo-first cards without duplicate text clutter.
- [ ] Long Live TV rails continue beyond the former 20–25 item limit.

## TV Guide

- [ ] Current approved Guide layout/geometry is unchanged.
- [ ] Category sidebar remains wide/crisp and EPG horizon remains roughly two hours.
- [ ] Channel/show logos are visibly larger inside the same existing logo cells and remain fully contained.
- [ ] Category ↔ EPG D-pad transitions are deterministic.
- [ ] Guide automatically loads additional channels near the end of the current batch.

## Series / episodes

- [ ] Season/detail route opens immediately.
- [ ] Episode rows show original air date and real synopsis where available.
- [ ] Runtime shows a real value where available; unresolved runtime is omitted rather than displaying `0:00`.
- [ ] Generic “Play this episode from your connected provider” placeholder copy is absent.
- [ ] Enriched episode metadata appears progressively without freezing D-pad input.
- [ ] Reopening the same series uses cached episode metadata and is faster.

## Update / modal regression

- [ ] After installing v0.8.27, What’s New opens once after profile selection with **Got it** focused.
- [ ] D-pad cannot move/scroll Home behind the modal.
- [ ] Got it, X and Android Back dismiss correctly.
- [ ] Settings can reopen What’s New.
- [ ] Update check remains non-blocking and can surface a later version when one exists.


## v0.8.27 performance/stability stress checks

- [ ] Switch repeatedly between Home, Live TV, STARmeter, Movies and TV Shows for at least 10 minutes. There must be no progressive slowdown, multi-second black frame, renderer reset or unexpected return to Who’s watching.
- [ ] On STARmeter, only a small visible people window hydrates at once. Scrolling should not trigger a whole-page rebuild, layout jump or focus loss as filmographies arrive.
- [ ] STARmeter ranks/portraits are large and cast-style circular; title rails use large cards and remain stable while background matches resolve.
- [ ] On Live TV, scroll through multiple category sections. Off-screen category DOM must not accumulate into a placeholder storm or make D-pad response degrade.
- [ ] Search is reachable by Left/Right from Providers in the persistent header and opening Search immediately focuses the input.
- [ ] Home featured art does not crop faces/heads and the old arrow/progress control is replaced by a small non-focusable 10-dot indicator.
- [ ] Movies and TV Shows use the same approved Home hero geometry and art-containment rules.

## Playback / stability

- [ ] Live preview never interferes with full Watch Live playback.
- [ ] Native Media3 Live/VOD playback, pause/resume, seek and Back behaviour still work.
- [ ] Provider/cache launch remains responsive after restart and after installing over v0.8.24.
- [ ] A long browse session does not progressively slow down or crash.
