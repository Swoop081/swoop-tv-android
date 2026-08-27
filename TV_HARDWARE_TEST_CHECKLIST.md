# Swoop TV v0.8.30 — Google TV Hardware Test Checklist

Current test build: **v0.8.30 / versionCode 830**

Enable Hardware Test Mode by focusing the Settings cog and pressing **OK five times within four seconds**. Select the numbered test before reproducing it, then choose **Save Diagnostics**.

## Critical navigation / stability

- **NAV-001 — Top 100 Movies 1 → 100:** hold/tap Right through the entire ranked rail. It must reach #100, never stall around #25–27, and never drop into another row.
- **NAV-002 — Top 100 TV Shows 1 → 100:** same test for TV.
- **NAV-003 — visual column:** from the middle of a Movies/TV rail, press Down/Up. Focus should land on the nearest poster directly below/above.
- **PERF-001 — rapid remote:** repeatedly press Up/Down/Left/Right. Input must remain responsive and queued navigation must not jump unpredictably.
- **STAB-001 — mixed-screen stability:** browse Home, My SwoopTV, Live TV, Guide, STARmeter, Movies, TV Shows and details for five minutes. Renderer-reset count must not increase.

## Personal / profile

- **PROFILE-001:** launch to Who’s Watching. First profile is already focused; OK enters immediately. Avatar/profile area is large and readable.
- **MYSWOOP-001:** My SwoopTV is directly after Home and shows Continue Watching, saved movies/shows, Favourite Channels and Recently Watched when populated. Home no longer shows Continue Watching/My List.

## Live TV / Guide

- **LIVE-001:** Recent Channels and every Browse Live TV/category channel tile have identical card size and spacing. Fast horizontal focus updates name/logo immediately; preview changes only after focus settles and never flashes white.
- **GUIDE-001:** left category sidebar remains unchanged. Right pane shows a Live TV/date/current-time banner above All Channels and the two-hour EPG. Cached EPG should remain visible while refreshing.

## STARmeter

- **STAR-001:** enter STARmeter, browse at least #1 → #30. Large centred circular portraits remain stable. Visible people resolve provider titles via the local index; no row remains “Finding titles…” indefinitely. Up from #1 reaches the STARmeter header/nav and Android Back always exits.
- Rapidly leave STARmeter while matching is active; late work must be cancelled and must not reappear over the destination page.

## Details / route lifecycle

- **DETAIL-001:** open a TV series, choose seasons, focus every episode, verify thumbnail/air date/runtime/synopsis, and navigate all the way back to the hero/Back control.
- **ROUTE-001:** Movie → Cast → Person → Home → Live TV. The old person page must never reappear.

## Diagnostics

After reproducing a failure, save the JSON and upload it with the phone video. Diagnostic exports are written to the app Documents directory with a filename beginning:

`Swoop-TV-v0.8.30-Diagnostics-`
