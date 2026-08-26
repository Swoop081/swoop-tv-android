# Swoop TV v0.8.4 — Google TV hardware test checklist

## Responsiveness / complete-frame gate
- [ ] Profile picker responds immediately after launch.
- [ ] Selecting a profile never produces a visible loading page or half-built Home.
- [ ] Home enters at scroll position 0.
- [ ] D-pad remains responsive continuously while the full catalogue restores in the background.
- [ ] No Home row appears as a skeleton, spinner, blank loading rail or anonymous colour tile.
- [ ] Initial Home rows are complete when shown; additional rows only appear after they are prepared.
- [ ] Repeated rapid D-pad navigation does not hitch while background indexing is active.
- [ ] Opening Movies / TV Shows / Live TV does not freeze while movie source stacking is still being prepared.
- [ ] Focusing a movie/series prewarms details without changing the visible screen.
- [ ] Selecting a movie/series never opens a visibly half-loaded detail route.
- [ ] Relaunching Swoop TV does not trigger a full provider refresh automatically.
- [ ] Search remains responsive while typing against a 30,000+ item library and shows no search spinner/blank loading card.
- [ ] Opening a cast/person result keeps the previous complete screen usable until the finished filmography route is ready.
- [ ] TV Guide never exposes programme-data loading placeholders; guide data may populate only from completed background results.
- [ ] Background catalogue worker transfer/indexing does not cause a late multi-second D-pad hitch after Home has already opened.

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
