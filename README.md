# Swoop TV v0.8.4 — Google TV Instant UI

Android TV / Google TV hardware-test branch built from the Swoop TV v0.7.45 product baseline.

## v0.8.4 performance contract

Swoop TV on Google TV now treats interaction as higher priority than catalogue/background work:

- The visible screen must remain responsive to D-pad input while background work is running.
- Unfinished Home rows are kept off-screen rather than shown as loading skeletons or blank rails.
- A compact cached Home snapshot is saved for repeat launches so Home can open from already prepared data while the full catalogue restores silently.
- Older installs without a v0.8.4 snapshot can build a fast multi-chunk preview from durable storage behind the profile picker, then replace it internally with the full library without forcing a visible rerender.
- Full-catalogue indexing is prepared in a persistent Web Worker instead of monopolising the WebView UI thread. The catalogue is handed to that worker in small idle-time chunks rather than one large structured-clone operation.
- Movie source stacking is returned from the worker in bounded chunks, preventing one large result handoff from causing a late navigation hitch.
- Large-library Search and People/filmography matching can use the prepared worker index, keeping expensive matching away from remote input and rendering.
- People routes on Google TV are complete-frame transitions: the current finished screen stays visible while the person/filmography result is prepared, then Swoop TV swaps to the finished route in one step.
- TV Guide data for likely channels is opportunistically prewarmed after Home settles. Missing EPG data never appears as a spinner/placeholder row on Google TV.
- Google TV poster cards always retain a readable title fallback, so slow artwork decoding cannot leave anonymous colour tiles on screen.
- Home initially paints a small set of complete rows. Remaining rows are built during idle time, artwork is prewarmed off-screen, and ready rows are appended below the current viewport.
- Movie/series detail data is prewarmed when a card receives focus. On selection, the current complete screen stays visible until the detail payload is ready rather than opening a half-built detail page.
- Heavy automatic discovery/metadata warmups remain off the immediate TV interaction path.
- The v0.8.3 startup fixes remain: no automatic provider refresh at launch, Home starts at the top, and D-pad navigation uses immediate scrolling.

## Android package

- Application ID: `tv.swoop.player`
- versionName: `0.8.4`
- versionCode: `804`
- minSdk: 23
- target/compile SDK: 36
- Media3 / ExoPlayer: 1.11.0

## Downloader test channel

The GitHub Actions workflow continues to overwrite the stable test asset:

`google-tv-test-v0.8.1 / Swoop-TV-v0.8.1-Google-TV-Test.apk`

That preserves **Downloader code 3682231**. The installed app reports **0.8.4 (804)**. The workflow also publishes `Swoop-TV-v0.8.4-Google-TV-Test.apk` for version tracking.

The bundled signing key is test-only and must never be used for production.
