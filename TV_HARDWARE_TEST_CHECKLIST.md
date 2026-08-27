# Swoop TV Google TV — Hardware Test Checklist

Current test build: **v0.8.29 / versionCode 829**

## Turn on Hardware Test Mode

1. Open **Settings** from the persistent top bar.
2. With the Settings cog focused, press **OK five times within four seconds**.
3. A small **HW TEST** diagnostics overlay appears.
4. Select the numbered test before reproducing an issue.
5. After the reproduction, choose **Save Diagnostics**.

The overlay is intentionally non-focusable and does not participate in D-pad geometry.

## Critical physical-TV checks

### NAV-001 — Top 100 Movies 1 → 100
- Home → Top 100 Movies.
- Move Right continuously from rank 1 through rank 100.
- **Pass:** the rail never stops around 25–27, never jumps vertically, and reaches rank 100 when the provider library has at least 100 unique movies.

### NAV-002 — Top 100 TV Shows 1 → 100
- Repeat NAV-001 on Top 100 TV Shows.
- **Pass:** the current row owns focus through rank 100.

### NAV-003 — Vertical visual-column preservation
- Movies: focus a poster around the middle of a row.
- Press Down, then Up.
- **Pass:** focus lands on the visually nearest poster below/above rather than a row end.

### PROFILE-001 — Who's Watching default focus
- Cold-launch the app to **Who's Watching?**.
- Do not press a direction key; press OK.
- **Pass:** the first profile is already focused and opens immediately. Avatar/profile presentation is large and TV-readable.

### LIVE-001 — Live TV category + preview stress
- Browse at least five Live TV category rows and 20+ channels in several rows.
- **Pass:** Recent Channels remains unchanged; Browse Live TV/category cards stay large; channel identity/logo updates immediately; muted preview follows after focus settles; no blank/white preview surface is shown before Media3 is ready; DOM/navigation stays responsive.

### STAR-001 — STARmeter #1 → #30 stability
- Open STARmeter and browse from #1 through at least #30.
- **Pass:** large circular portraits/ranks remain aligned; nearby people hydrate progressively; title rails resolve without indefinite skeletons; one failed person cannot stall the page; no crash/freeze/renderer loss occurs.

### DETAIL-001 — TV series season + episode focus path
- Open a multi-season show such as Ted Lasso.
- Navigate hero/actions → Season selector → each episode → Cast, then reverse with Up.
- **Pass:** seasons are left-aligned; every episode is individually focusable/playable; thumbnail/air date/runtime/synopsis populate when available; Up can return all the way to the show hero/Back control.

### ROUTE-001 — Stale person route teardown
- Movie → Cast → Person.
- Leave the person screen, return Home, then select Live TV.
- **Pass:** the old person page is destroyed and never resurfaces over another primary tab; no force-stop is required.

### GUIDE-001 — Cached EPG + focus diagnostics
- Open Guide after it has previously loaded EPG.
- Move through category sidebar, channels and programme cells.
- **Pass:** cached programme data paints before refresh; the screen is not temporarily replaced by mass “No programme information”; HW TEST shows `guide:categories`, `guide:channels` or `guide:program:*` rather than `focus none`.

### PERF-001 — Rapid D-pad stress
- Browse Home / Movies / Live TV for 30 seconds using fast Up/Down/Left/Right input.
- **Pass:** keys remain responsive; queued vertical intent is preserved; background metadata/image work does not move focus or rebuild the active page.

### STAB-001 — Five-minute mixed-screen stability
- Alternate Home → Live TV → Guide → STARmeter → Movies → TV Shows → Search → detail/person pages for five minutes.
- **Pass:** no multi-second black screen, unexpected Who's Watching reset, stale overlay resurrection or WebView renderer reset.

## Home content check

Confirm Home order includes:
1. Featured Hero
2. Continue Watching (when applicable)
3. Top 100 Movies
4. Top 100 TV Shows
5. Recently Added Movies
6. Recently Added TV Shows

Hero artwork should fill the available width without black side bars, while keeping important faces safely framed.

## Export diagnostics

While Hardware Test Mode is active, go to **Settings → Hardware Test Mode → Save Diagnostics**.

The app writes a timestamped JSON file to the app's external Documents directory, typically:

`/storage/emulated/0/Android/data/tv.swoop.player/files/Documents/Swoop-TV-v0.8.29-Diagnostics-YYYYMMDD-HHMMSS.json`

Send the diagnostic JSON together with the phone video whenever possible.
