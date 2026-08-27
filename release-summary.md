Swoop TV Google TV hardware-test channel — current v0.8.36.

- Adds a persistent Performance Pack so installer seed data, provider fingerprints, metadata knowledge and artwork cache state survive normal launches and APK upgrades.
- Provider refreshes calculate catalogue deltas and prioritise only added/changed titles instead of repeating expensive preparation for unchanged content.
- STARmeter person/library matches persist for 90 days independently of rank, so rank movement does not trigger rematching; new/stale people are handled incrementally.
- Freezes STARmeter asynchronous DOM hydration throughout a held/long-pressed D-pad direction and resumes only after key release plus scroll settle.

Test-only signing identity; not a production release.
