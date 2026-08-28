## v0.8.50 first-run onboarding checks

- ONBOARD-ENTER-001: Type each provider field and press keyboard Enter with the remote. Intermediate fields must advance without Back; final fields must submit Connect.
- ONBOARD-AVATAR-001: Press OK on an avatar. Use this avatar / Continue must enable immediately and be reachable with Down/OK.
- ONBOARD-ART-001: New selectable avatars use the sharp original production-resolution set; low-resolution secondary portraits are not offered.
- ONBOARD-STATE-001: Updating over a connected provider with no completed profile resumes avatar selection without deleting the provider.

## v0.8.41 focused hardware checks

- **TOP100-RESTORE-001:** Home shows populated Top 100 Movies and Top 100 TV Shows from Snoak trending sources after a fresh install/update; no empty pinned rows.
- **HOME-CLEAN-001:** Home rail headers do not show Explore-all buttons.
- **STAR-RAIL-001:** On a STARmeter person with more than eight provider matches, hold/right-browse past card 8 and confirm additional cards append smoothly.
- **MYSWOOP-HERO-001:** My SwoopTV hero height/crop matches Home exactly.
- **PLAYER-PREMIUM-001:** Native player exposes Audio & Speed, Subtitles and Fit/Fill; multi-audio files show Media3 audio track choices and subtitle tracks remain selectable.

# Swoop TV v0.8.37 — Google TV Hardware Test Checklist

Current test build: **v0.8.37 / versionCode 837**

Enable Hardware Test Mode by focusing the Settings cog and pressing **OK five times within four seconds**. Select the numbered test before reproducing it, then choose **Save Diagnostics**.


## v0.8.37 Performance Pack / incremental-cache gates

- **PACK-001 — first optimisation:** after connecting a fresh provider, allow the one-time **Optimising Swoop TV** step to finish. Confirm the provider setup does not return to Settings until the local snapshot and priority artwork pass have completed or safely failed-open.
- **PACK-002 — warm restart:** fully exit and reopen Swoop TV. Existing provider data/Home should restore from durable local state before any provider network refresh; previously warmed artwork should appear without a fresh all-placeholder sweep.
- **PACK-003 — unchanged refresh:** refresh the same provider without changing its library. Performance status should report approximately `0 added · 0 changed · 0 removed`; the app must not perform another full artwork warm.
- **PACK-004 — small delta:** after the provider adds/removes a small number of titles, refresh again. Only the changed/new artwork set should be warmed and the rest of the library should remain immediately available.
- **PACK-005 — retained update:** install the next APK over v0.8.37 without uninstalling. Provider snapshots, metadata/artwork cache and STARmeter retained rows must survive the APK update.
- **STAR-RETAIN-001:** reopen STARmeter after a restart. Existing Top 100 people should populate from the Performance Pack immediately. Rank movement must not trigger a full person rematch; genuinely new entrants may hydrate in the background.
- **STAR-HOLD-001:** press and hold Down from #1 through at least #30. While the key repeats, no rank/name/portrait/title DOM should repaint underneath the scroll. Release Down, wait briefly, and verify deferred title hydration resumes with no ghost/duplicate rows.


### STAR-PAINT-001 — no duplicated/ghost rows
1. Enter STARmeter immediately after profile selection.
2. Hold/tap Down quickly from #1 through at least #20, then reverse direction.
3. Verify every rank, portrait and name is painted exactly once and no previous row remains ghosted above/below the focused row.
4. Pause on several rows while provider titles finish matching; the focused person identity must remain visually stable.

### STAR-PATCH-001 — stable async hydration
1. Enter STARmeter before all background matching is complete.
2. Move focus continuously while rows hydrate.
3. Verify provider-title rails can fill in only after focus settles, without jumping the page, duplicating identities or losing focus.
## Critical navigation / stability

- **NAV-001 — Top 100 Movies 1 → 100:** hold/tap Right through the entire ranked rail. It must reach #100, never stall around #25–27, and never drop into another row.
- **NAV-002 — Top 100 TV Shows 1 → 100:** same test for TV.
- **NAV-003 — visual column:** from the middle of a Movies/TV rail, press Down/Up. Focus should land on the nearest poster directly below/above.
- **PERF-001 — rapid remote:** repeatedly press Up/Down/Left/Right. Input must remain responsive and queued navigation must not jump unpredictably.
- **STAB-001 — mixed-screen stability:** browse Home, My SwoopTV, Live TV, Guide, STARmeter, Movies, TV Shows and details for five minutes. Renderer-reset count must not increase.

## Personal / profile

- **PROFILE-001:** launch to Who’s Watching. First profile is already focused; OK enters immediately. Avatar/profile area is large and readable.
- **MYSWOOP-001:** My SwoopTV is directly after Home and shows Continue Watching, saved movies/shows, Favourite Channels and Recently Watched when populated. Navigate to the bottom, then Up to the first rail and Up again: the full My SwoopTV header must return exactly to the original top position.

## Live TV / Guide

- **LIVE-001:** Recent Channels and every Browse Live TV/category channel tile have identical card size and spacing. Fast horizontal focus updates name/logo immediately; preview changes only after focus settles and never flashes white.
- **GUIDE-001:** left category sidebar remains unchanged. Right pane shows a Live TV/date/current-time banner above All Channels and the two-hour EPG. Cached EPG should remain visible while refreshing.

## STARmeter

- **STAR-001:** before profile login, Who’s Watching should report STARmeter preparation/ready state. After login, enter STARmeter and browse #1 → #30: all provider title counts/rails should already be resolved, rows must not overlap, and no person-level “Finding titles…” rail should appear. Up from #1 must restore the true STARmeter page top/header/nav.

- **STAR-002 — fast scroll:** hold/tap Down rapidly from #1 toward #100. The page must never become blank, rows must not overlap/collapse/reflow, and the already-prepared filmography rails must remain stable. Then return Up to #1 and confirm the full STARmeter hero/header is restored.
- **ART-001 — Top 100 artwork:** hold Right through #1 → #100. Focus must remain responsive and poster placeholders should be prefetched far enough ahead that the visible focused window does not become an all-placeholder strip.
- **HERO-001 — atomic hero:** rapid Top 100 focus changes must never clear the current hero into an empty black backdrop; previous artwork/title remains until the new hero is ready.
- Rapidly leave STARmeter while matching is active; late work must be cancelled and must not reappear over the destination page.

## Details / route lifecycle

- **DETAIL-001:** open a TV series, choose seasons, focus every episode, verify thumbnail/air date/runtime/synopsis, and navigate all the way back to the hero/Back control.
- **ROUTE-001:** Movie → Cast → Person → Home → Live TV. The old person page must never reappear.

## Diagnostics

After reproducing a failure, save the JSON and upload it with the phone video. Diagnostic exports are written to the app Documents directory with a filename beginning:

`Swoop-TV-v0.8.37-Diagnostics-`

- [ ] **LIVE-NOW-001:** On Live TV, the left channel logo has exactly one current EPG programme title beneath it; changing channel focus updates the title, and the title changes at the programme boundary without opening the full Guide.
