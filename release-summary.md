Swoop TV Google TV hardware-test channel — current v0.8.43.

- Fixes the physical Google TV failure shown in IMG_1155.mp4 where Allow Update Installs displayed a toast but did not open Android settings.
- The updater now tries the package-specific Install unknown apps screen first, then the generic unknown-source screen, Android Security settings and finally Swoop TV app-details settings so vendor-specific Google TV firmware has a usable path.
- A manual update waiting for install-source permission is now remembered. After permission is granted and Swoop TV resumes, the pending update continues automatically.
- Automatic-update permission return is also repaired; the updater no longer remains stuck in permission_required after access has been granted.
- Keeps the verified SHA-256/application-ID/version checks and in-place tv.swoop.player update model from v0.8.42.
- Keeps Downloader code 3682231 as the stable bootstrap/fallback installer.
- Android versionName is 0.8.43 and versionCode is 843.

Test-only signing identity; not a production release.
