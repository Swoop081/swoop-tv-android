# Swoop TV v0.8.33 — Google TV Hardware Test Checklist

Current test build: **v0.8.33 / versionCode 833**

Enable Hardware Test Mode by focusing the Settings cog and pressing **OK five times within four seconds**. Select the numbered test before reproducing it, then choose **Save Diagnostics**.

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

`Swoop-TV-v0.8.33-Diagnostics-`
