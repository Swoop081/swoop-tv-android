Swoop TV Google TV hardware-test channel — current v0.8.31.

- Fixes STARmeter false 0 titles results by expanding the one-time provider availability index to use TMDb/IMDb IDs, IPTV-cleaned title aliases, ±1-year matching and a bounded same-bucket fuzzy fallback without rescanning the whole provider library for every actor.
- Prevents STARmeter from treating the small cached Android Home snapshot as the full provider catalogue; person matching waits for the durable provider library before building its availability index when necessary.
- Makes the availability worker usable with smaller provider libraries as well as very large ones.
- GitHub seed generation now preloads filmography credits for the full STARmeter Top 100 by default and preserves original-title/original-name aliases for stronger local matching.
- Prewarms STARmeter actor identities/portraits substantially farther ahead of the visible scroll position to reduce initial-letter portrait fallbacks.
- Forces Guide tab entry to the true top of the page and makes the requested LIVE TV / TV Guide / date / current-time banner visually explicit above All Channels and the two-hour EPG.
- Retains the complete v0.8.30 My SwoopTV, Top 100, Live TV, profile/detail, warm-start seed and Hardware Test Mode work.
- Android versionName is 0.8.31 and versionCode is 831.

Test-only signing identity; not a production release.
