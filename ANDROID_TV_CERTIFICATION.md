# Swoop TV v0.8.11 — Google TV hardware test checklist

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


## Compact Home hero
- [ ] Home hero occupies roughly the upper 40–44% of the usable TV viewport rather than most of the screen.
- [ ] At least the first Home row is substantially visible below the hero on a 1080p television without scrolling.
- [ ] Hero poster/rotation art remains readable but does not dominate the right half of the television.
- [ ] Play / More Info and hero metadata remain fully on-screen with no overscan clipping.

## TV Guide / EPG
- [ ] Startup refresh shows a dedicated **TV Guide** stage before Home is revealed.
- [ ] Xtream XMLTV programme data is prepared during startup rather than waiting for the Guide page to open.
- [ ] M3U providers with an XMLTV URL are prepared during the same startup stage.
- [ ] Large/gzipped XMLTV feeds do not freeze the startup progress animation or remote input.
- [ ] Entering Guide after startup shows programme titles immediately with no blank/loading rows.
- [ ] Live player Now / Next and mini-guide can reuse the launch-prepared EPG cache.
- [ ] Providers without usable XMLTV data still retain per-channel Xtream EPG fallback where available.


## Header safe area / Home rail alignment
- [ ] Swoop TV logo, Home/Live TV/Guide/Movies/TV Shows/My List navigation, provider button, settings and profile controls are fully visible with no top-edge clipping.
- [ ] Continue Watching and every other poster Home row use the same poster width, 2:3 ratio, gap and baseline as Top 100.
- [ ] Top 100 rank numbers overlay the poster without shifting the poster itself out of alignment with other rows.
- [ ] Top 100 Movies reports 100 available when the library contains at least 100 movies.
- [ ] Top 100 TV Shows reports 100 available when the library contains at least 100 shows.
- [ ] D-pad Right can traverse beyond item 20; additional cards appear seamlessly in 20-item chunks without a pause or full-page rerender.
- [ ] Reaching ranks 80–100 remains responsive and rank numbers are correct.

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
