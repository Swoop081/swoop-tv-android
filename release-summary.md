Swoop TV Google TV hardware-test channel — current v0.8.33.

- Fixes the physical-TV route scroll trap shown on My SwoopTV and STARmeter: returning Up to the active top navigation tab now restores the underlying page to its canonical scrollY = 0, including a follow-up animation-frame reset for Android WebView.
- Adds an explicit first-row Up escape for top-level pages without a focusable hero action, so My SwoopTV can return from its first rail to the full original header composition instead of remaining partially scrolled.
- Rebuilds STARmeter preparation around one provider-index batch match for the complete Top 100. Matching starts while the Who’s Watching/profile screen is still visible rather than waiting for STARmeter entry or focus movement.
- Uses the packaged Top 100 identities and filmography credits plus the restored durable provider catalogue to populate all 100 provider-available filmographies before STARmeter becomes focusable; STARmeter no longer assembles person rows one-by-one as the remote reaches them.
- Keeps a deliberate whole-page preparation state if the pre-login batch has not completed, instead of exposing mixed “Finding titles…” rows that reflow while the user is navigating.
- Expands STARmeter’s permanent row geometry and vertical safety gap so enlarged poster rails and focused-card scaling cannot paint into the next person’s row.
- Prewarms all Top 100 portraits plus a round-robin set of representative filmography artwork during the profile screen/background preparation window.
- Fixes the Android native diagnostic versionCode marker while advancing Android versionName to 0.8.33 and versionCode to 833.

Test-only signing identity; not a production release.
