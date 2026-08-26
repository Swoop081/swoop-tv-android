# Swoop TV v0.8.22 — Google TV hardware test checklist

## v0.8.22 Live TV brand-fill regression checks

- [ ] Open Live TV with FOX Footy (or another channel with a transparent logo) as the lead channel and confirm its logo occupies most of the unused right-side masthead area rather than appearing as a small badge.
- [ ] Confirm the enlarged logo remains aspect-correct, centred and fully recognisable with no horizontal/vertical stretching.
- [ ] Confirm the right-side dark shade is minimal over the logo while channel name/description/buttons remain readable on the left.
- [ ] Confirm the live-stream count remains readable in its small lower-right translucent overlay without creating a separate empty column.
- [ ] Repeat with several differently shaped channel logos and on a short-height TV viewport; no logo should escape the hero safe area or overlap the fixed top navigation.

## v0.8.21 Home rows / compact hero regression checks

- [ ] Cold-launch Home with no Continue Watching and confirm real content rails still appear even if both Top 100 feeds are refreshing.
- [ ] Confirm Top 100 Movies / TV Shows can show pending placeholders briefly without replacing the rest of Home with the Customize Home callout.
- [ ] Confirm the Home hero is visibly shorter than v0.8.20 while its title/logo, metadata and Play / More Info controls remain fully below the fixed navigation.
- [ ] While a Top 100 placeholder is pending, verify Up/Down skips the placeholder and moves only between rails containing cards.
- [ ] Simulate/reproduce a failed or empty Top 100 refresh and confirm the last good ranking remains visible.

- [ ] Cold-launch Home and confirm the entire hero title/logo, metadata, description and Play / More Info controls are visible beneath the fixed navigation.
- [ ] From the first Top 100 card press Up, then move Up/Down around the hero/top navigation; Home must return to scroll position 0 and never hide the hero title/logo above the viewport.
- [ ] Confirm Top 100 Movies / TV Shows look like current hot/trending titles rather than a rating-sorted provider catalogue.
- [ ] Install v0.8.22 over v0.8.21 and confirm the old cached Top 100 ranking refreshes automatically in the background after Home becomes interactive.
- [ ] Hold Right across at least 20 cards and move Up/Down between the first three Home rows; focus should track immediately without the sluggish pauses seen in v0.8.19.
- [ ] Continue Down beyond the third mounted row and confirm later rows mount smoothly without a large one-time stall.
- [ ] While focused inside a ranked row, allow a background discovery refresh to complete; the focused row must not be replaced underneath the active cursor.
- [ ] Top 100 rank numerals remain fully visible with the safe left inset and no collision with the next row.
- [ ] `100 available` remains absent; duplicate visible title/year entries remain de-duplicated; loaded posters remain free of the black lower haze.
- [ ] Movies and TV Shows page heroes remain compact and the Live TV right-side logo remains fully visible.

## v0.8.19 Home rails / navigation / Live logo (regression reference)

- [ ] Verify the v0.8.19 ranked-number safe inset, duplicate-title filtering, poster-haze removal and Live TV logo treatment remain intact.
- [ ] Verify v0.8.21 no longer reproduces the v0.8.19 Home hero clipping or sluggish Home navigation.

## v0.8.18 profile → Home runtime blocker

- [ ] Launch with an existing profile and cached library.
- [ ] Focus the profile card and press the physical OK/Select button once.
- [ ] Confirm the Who’s Watching screen disappears immediately.
- [ ] Confirm Home renders without a JavaScript exception and remote input is responsive immediately.
- [ ] Repeat after a cold process restart and after installing v0.8.22 over v0.8.21.


## v0.8.18 launch freshness / deterministic Select

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
- [ ] Home hero occupies roughly the upper quarter of the usable TV viewport rather than 40–44% of the screen.
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
- [ ] Top 100 Movies can contain 100 ranked unique titles when the library supports it, but the `100 available` helper text is hidden.
- [ ] Top 100 TV Shows can contain 100 ranked unique titles when the library supports it, but the `100 available` helper text is hidden.
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
