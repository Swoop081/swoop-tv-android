# Swoop TV Google TV — Hardware Test Checklist

Current test build: **v0.8.27 / versionCode 827**

## Turn on Hardware Test Mode

1. Open **Settings** from the persistent top bar.
2. With the Settings cog focused, press **OK five times within four seconds**.
3. A small **HW TEST** diagnostics overlay appears at the lower-left.
4. The Settings page now exposes Hardware Test Mode controls, numbered tests and **Save Diagnostics**.
5. Repeat the five-press Settings shortcut, or choose **Exit Test Mode**, to disable it.

The overlay is intentionally non-focusable and does not participate in D-pad geometry.

## Numbered physical-TV checks

### NAV-001 — Top 100 Movies 1 → 100
- Enter Home → Top 100 Movies.
- Hold/tap Right continuously from rank 1 through rank 100.
- Pass: the current rail owns focus throughout; no stop at ~25/26 and no vertical escape.
- On failure: stop pressing, photograph the HW TEST overlay, then Save Diagnostics.

### NAV-002 — Top 100 TV Shows 1 → 100
- Repeat NAV-001 on Top 100 TV Shows.
- Pass: focus reaches all available ranks through 100 without changing row.

### NAV-003 — Vertical column preservation
- On Movies, focus a poster near the middle of the visible row.
- Press Down once, then Up once.
- Pass: Down lands on the visually nearest poster beneath the original; Up returns to the corresponding visual column.

### PERF-001 — Rapid D-pad stress
- Browse Home/Movies for 30 seconds using rapid Up/Down/Left/Right presses.
- Pass: input remains responsive, row movement registers, and focus never enters a stale/loading placeholder.
- Watch the overlay for growing pending counts, long-task symptoms, or a renderer reset.

### LIVE-001 — Live TV category + preview stress
- Enter Live TV and browse through at least five category rows.
- Move across 20+ channels in multiple rows.
- Pass: logo updates immediately, muted preview follows after focus settles, and navigation remains responsive without mass blank tiles.

### STAR-001 — STARmeter progressive hydration
- Open STARmeter.
- Browse at least ten people and several title rails.
- Pass: person shells/portraits appear quickly, only nearby people hydrate, page geometry stays stable, and D-pad input remains responsive.

### STAB-001 — Five-minute mixed-screen stability
- For five minutes alternate Home → Live TV → Guide → STARmeter → Movies → TV Shows → Search and back.
- Pass: no multi-second black screen, no unexpected Who's Watching reset, no WebView renderer reset, and memory/DOM counts remain bounded.

## Export diagnostics

While Hardware Test Mode is active, go to **Settings → Hardware Test Mode → Save Diagnostics**.

The app writes a timestamped JSON file to the app's external Documents directory, typically:

`/storage/emulated/0/Android/data/tv.swoop.player/files/Documents/Swoop-TV-v0.8.27-Diagnostics-YYYYMMDD-HHMMSS.json`

The file contains the current screen/focus state, rail index, scroll/DOM counts, pending jobs, JavaScript heap information when available, native Java heap metrics, Media3 playback/preview state, WebView renderer-reset information, native key counters and the rolling hardware event log.

## Fast feedback format

Use this short format with a photo/video and diagnostic file when available:

`v0.8.27 · NAV-001 · stops at movie #26`

or

`v0.8.27 · PERF-001 · Up/Down starts missing after ~20 seconds`

That gives the source build, exact regression test and symptom without needing a long written explanation.
