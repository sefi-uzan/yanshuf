# Keeping Yanshuf up to date

Installed apps check for updates in the background and from **Settings → General → Check for updates**.

## What to expect

1. Yanshuf compares your installed version against the latest [GitHub Release](https://github.com/sefi-uzan/yanshuf/releases).
2. When a newer version is available, the update downloads in the background.
3. A toast appears with **Restart & update** when the download finishes.
4. Click **Restart & update** to quit and relaunch into the new version.

If you are already on the latest version, **Check for updates** shows a success toast.

## First-time install vs updates

- Download the `.dmg` from GitHub Releases for a fresh install or recovery.
- After that, in-app updates handle subsequent versions automatically.

Official releases are signed and notarized, so Gatekeeper should accept them without extra steps.
