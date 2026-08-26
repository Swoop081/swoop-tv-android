# Swoop TV v0.8.17 — Google TV hardware test checklist

## v0.8.17 launch freshness / deterministic Select

- [ ] On Who’s Watching, focus a profile and press physical OK once; the app must leave the screen immediately.
- [ ] DPAD Center / Enter / Numpad Enter / controller A activate the focused web control exactly once with no duplicate click.
- [ ] With a valid saved library, a cold launch opens Home immediately and does not show the long provider-refresh gate.
- [ ] After Home is responsive, Swoop TV performs its launch provider/account freshness check without interrupting D-pad navigation.
- [ ] A provider older than 24 hours can refresh in the background while the previous working library remains usable.
- [ ] A fresh provider is not fully downloaded again just because the app was opened.
- [ ] Launch version checking can surface a newer Google TV test build in Settings and displays Downloader code 3682231.


## Provider completion blocker

- [ ] Add an Xtream provider and let the import reach 100%; the setup overlay must close automatically and Home must open.
- [ ] At 100%, the progress panel must no longer remain indefinitely on **Your library is ready**.
- [ ] If automatic handoff is interrupted, **Open Swoop TV** must be visible and pressing OK must enter Home.
- [ ] After import, Home opens at the top and the remote responds immediately.
- [ ] The newly added provider is still present after app restart.

## Landscape-first UI

- [ ] Provider setup fits comfortably in 16:9 with primary fields/actions visible without a tall mobile-form scroll.
- [ ] Settings, Search, Live TV, Guide, Movies, TV Shows, My List, details, people/cast, profiles and dialogs use TV-first wide layouts.
- [ ] No major route requires unnecessary vertical scrolling just to reach its primary action.

## Remote OK / Select hotfix

- [ ] Focus a profile on Who’s Watching and press the physical remote OK/Select button; Home or preparation must open immediately.
- [ ] Verify DPAD_CENTER/Enter also activates ordinary focused buttons throughout the WebView.
- [ ] Verify native Media3 playback controls still respond normally and are not double-triggered.

## Cache-first launch / one-time preparation
- [ ] A normal cold launch with a valid saved library does **not** show the long provider-refresh screen.
- [ ] Selecting a profile opens the saved Home immediately and the D-pad responds on the first frame.
- [ ] Normal app restarts do not download the Xtream/M3U playlist again.
- [ ] Installing a newer test APK over the existing app preserves the saved library and does not force a provider re-download.
- [ ] Providers → Refresh and Refresh All still perform an explicit network refresh and update the saved library.
- [ ] A first install / missing or invalid saved library uses the progress screen and performs the one-time provider download.
- [ ] The one-time preparation screen shows a real percentage, moving progress bar and stage text.
- [ ] The preparation-screen Swoop TV logo has no rectangular black image background.
- [ ] The full durable catalogue restores locally after Home is interactive without jumping or redrawing the current Home frame.
- [ ] Cached EPG data is restored on later launches; opening Guide does not discard the previous successful programme cache simply because the app process restarted.
- [ ] A temporarily unavailable provider never wipes a previously successful library.

## Compact Home hero
- [ ] Home hero occupies roughly the upper 40–44% of the usable TV viewport rather than most of the screen.
- [ ] At least the first Home row is substantially visible below the hero on a 1080p television without scrolling.
- [ ] Hero poster/rotation art remains readable but does not dominate the right half of the television.
- [ ] Play / More Info and hero metadata remain fully on-screen with no overscan clipping.

## TV Guide / EPG
- [ ] The initial/explicit full refresh prepares TV Guide data and saves it durably.
- [ ] Later normal launches restore the saved EPG cache without re-running the full provider/guide download.
- [ ] Xtream and M3U/XMLTV providers both reuse saved programme data when it is still valid.
- [ ] Large/gzipped XMLTV feeds do not freeze the startup progress animation or remote input.
- [ ] Entering Guide after startup shows programme titles immediately with no blank/loading rows.
- [ ] Live player Now / Next and mini-guide can reuse the launch-prepared EPG cache.
- [ ] Providers without usable XMLTV data still retain per-channel Xtream EPG fallback where available.


## Header safe area / Home rail alignment
- [ ] Swoop TV logo, Home/Live TV/Guide/Movies/TV Shows/My List navigation, provider button, settings and profile controls are fully visible with no top-edge clipping.
- [ ] Continue Watching and every other poster Home row use the same **smaller compact** poster width and 2:3 ratio as Top 100.
- [ ] Horizontal gaps are visibly larger than v0.8.11 so posters have clear breathing room.
- [ ] Top 100 movie/show title fallback text is not drawn underneath the rank numeral.
- [ ] Top 100 rank numbers straddle the lower-left poster edge with a substantial portion outside the poster.
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
