# Swoop TV v0.8.5 — Google TV hardware test checklist

## Launch refresh / ready-Home gate
- [ ] Profile picker responds immediately after cold launch.
- [ ] Selecting a profile switches to the **Updating your TV library** screen immediately; Home is never briefly exposed first.
- [ ] The launch screen shows a visible percentage, moving progress bar, current stage and provider status throughout preparation.
- [ ] Every enabled Xtream/M3U URL provider with saved credentials is checked during the launch gate.
- [ ] A temporarily unavailable provider keeps the last successful saved content rather than replacing it with an empty library.
- [ ] Large provider downloads do not make the progress animation appear frozen for the full network-request duration.
- [ ] Top 100 Movies is prepared before lower-priority discovery/provider Home rows.
- [ ] Top 100 TV Shows is prepared before lower-priority discovery/provider Home rows.
- [ ] Recently Added Movies / TV Shows do not appear on Home before the Top 100 priority rows have finished preparation.
- [ ] Critical first-screen artwork is ready before Home is revealed, or uses the finished title fallback rather than an unfinished placeholder.
- [ ] Home is not revealed until launch preparation reaches 100%.
- [ ] Home enters at scroll position 0.
- [ ] D-pad responds immediately on the first frame after Home appears; there is no 30-second post-launch dead period.
- [ ] Rapid D-pad navigation remains responsive after Home appears while optional background work continues.
- [ ] No Home row appears as a skeleton, spinner, blank loading rail or anonymous colour tile.
- [ ] Relaunching the app repeats the launch refresh/preparation gate before exposing the library.

## Remote / navigation
- [ ] Swoop TV appears in the Google TV Apps list with its TV banner.
- [ ] App opens full-screen in landscape using only the remote.
- [ ] D-pad Left / Right follows horizontal rows naturally.
- [ ] D-pad Up / Down moves between visible rows and controls naturally.
- [ ] Focus is always obvious from normal TV viewing distance.
- [ ] Android Back closes overlays/details/player before leaving the app.
- [ ] Search opens the Google TV keyboard and returns focus correctly.
- [ ] Person → title → Back returns correctly without a black screen.

## Empty state and providers
- [ ] Fresh install contains no dummy channels, movies or TV shows.
- [ ] Library remains empty until a real Xtream or M3U provider is added.
- [ ] Xtream provider can be added using the remote and on-screen keyboard.
- [ ] M3U URL can be imported.
- [ ] Plain HTTP provider endpoints work.
- [ ] Playlist/provider expiry appears in provider details where supplied.
- [ ] Provider survives app restart.

## Playback
- [ ] HLS live channel plays in the native Media3 player.
- [ ] Direct Xtream/MPEG-TS stream plays when supported by the device/provider.
- [ ] Movie playback starts and returns to the title page.
- [ ] Episode playback starts and returns to the series page.
- [ ] Play/pause works with the Google TV remote.
- [ ] ±10-second seek works for seekable VOD.
- [ ] Back from VOD preserves Continue Watching progress.
- [ ] Live channel switching works.
- [ ] Stream failure returns to a usable Swoop TV screen.

## Stability and display
- [ ] 1080p output is legible at normal TV distance.
- [ ] 4K output scales correctly.
- [ ] No controls are clipped by screen edges/overscan.
- [ ] Android Home → Swoop TV resumes to a usable screen.
- [ ] Sleep/wake returns to a usable screen.
- [ ] A long browse session does not progressively slow down or crash.
