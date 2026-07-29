# Release checklist

Maintainer guide for signed macOS desktop releases and in-app updates.

## What the workflow does

- Workflow: [`.github/workflows/release-desktop.yml`](../../.github/workflows/release-desktop.yml)
- Trigger: push a tag matching `v*` (for example `v1.0.1`)
- Builds `arm64` and `x64` sequentially, signs and notarizes each `.app`, produces a DMG and ZIP per architecture, verifies with `codesign` / `stapler` / `spctl`, and uploads artifacts to a **draft** GitHub Release
- A final job publishes the draft once every architecture succeeds

Yanshuf publishes signed, notarized macOS DMGs and ZIPs to [GitHub Releases](https://github.com/sefi-uzan/yanshuf/releases). DMGs are for first-time install; ZIPs power in-app updates.

Both the `.app` and the `.dmg` are notarized and stapled. Gatekeeper assesses the disk image a user downloads, not only the app inside it, so notarizing just the app is not enough.

The draft stage matters: the in-app updater reads GitHub's `/releases/latest`, which excludes drafts. Nothing reaches users until every architecture is attached and verified. If a build fails, the draft stays hidden and can be deleted.

Expect the whole run to take a while — there are four notarization submissions, and each can take anywhere from a few minutes to half an hour.

## Desktop auto-update notes

- Runtime updater: Electron `autoUpdater` via [update.electronjs.org](https://update.electronjs.org) in [`apps/desktop/src/main/updater.ts`](../../apps/desktop/src/main/updater.ts)
- Feed repo: `GITHUB_REPO` in that file (forks must change this)
- Update UX: background checks in packaged builds; download in the background; toast with **Restart & update** when ready
- Required release assets: signed `.dmg` (install) and `.zip` (Squirrel.Mac update payload) per architecture

### Testing update checks

Override the background interval when launching a packaged build:

```bash
/Applications/Yanshuf.app/Contents/MacOS/Yanshuf --update-check-interval=30
```

Or:

```bash
open -a Yanshuf --args --update-check-interval=30
```

Invalid or missing values fall back to the default one-hour interval. Settings **Check for updates** is still the fastest one-shot test.

## One-time setup: Apple Developer

A paid **Apple Developer Program** membership ($99/year) is required. There is no free path to a Developer ID certificate or to notarization. An Individual enrollment is sufficient; organizations additionally need a D-U-N-S number. Your Apple ID must have two-factor authentication enabled. Approval is usually same-day but can take a few days if Apple asks for identity verification.

### 1. Create the certificate

You need exactly one certificate type: **Developer ID Application**. (Developer ID Installer is only for `.pkg` installers.)

Easiest route is Xcode → **Settings → Accounts** → add your Apple ID → **Manage Certificates** → `+` → **Developer ID Application**.

Developer ID certificates are capped at 5 per team, so back up the exported `.p12` rather than regenerating.

### 2. Read the exact identity name

```bash
security find-identity -v -p codesigning
```

Copy the full name, e.g. `Developer ID Application: Your Name (AB12CD34EF)`. This exact string is `APPLE_SIGNING_IDENTITY` — it must match character for character.

### 3. Export the certificate

In Keychain Access, open **login → My Certificates** (not "Certificates" — only My Certificates carries the private key), right-click the Developer ID Application entry → **Export** → save as `.p12` with a strong password, then:

```bash
base64 -i Certificates.p12 | pbcopy
```

### 4. Create a notarization password

At [appleid.apple.com](https://appleid.apple.com) → **Sign-In and Security → App-Specific Passwords**, generate one labelled `notarytool`. Note that app-specific passwords stop working if you change your Apple ID password.

### 5. Note your Team ID

The 10-character ID is at [developer.apple.com/account](https://developer.apple.com/account) → Membership details.

## GitHub Actions secrets

Add these under **Repository → Settings → Secrets and variables → Actions**:

- `MACOS_CERTIFICATE` — base64-encoded `.p12` from step 3
- `MACOS_CERTIFICATE_PASSWORD` — the password you set during the Keychain export
- `APPLE_SIGNING_IDENTITY` — the exact identity name from step 2
- `APPLE_ID` — the Apple ID email used for notarization
- `APPLE_APP_SPECIFIC_PASSWORD` — the app-specific password from step 4
- `APPLE_TEAM_ID` — the Team ID from step 5

Optionally, `KEYCHAIN_PASSWORD` sets the password of the ephemeral CI keychain; it falls back to a built-in value when omitted.

`GITHUB_TOKEN` is provided automatically, and the workflow grants it `contents: write` so Forge can create the release.

## Verify locally before tagging

Signing problems are far easier to diagnose on your own machine than in CI. Export the same variables and build:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (AB12CD34EF)"
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="AB12CD34EF"
pnpm --filter @yanshuf/desktop run make
```

Then check the result:

```bash
APP="apps/desktop/out/Yanshuf-darwin-arm64/Yanshuf.app"
DMG=$(find apps/desktop/out/make -name '*.dmg' -print -quit)

codesign --verify --deep --strict --verbose=2 "$APP"
xcrun stapler validate "$APP"
spctl --assess --type exec -vv "$APP"
xcrun stapler validate "$DMG"
spctl --assess --type open --context context:primary-signature -vv "$DMG"
```

Both `spctl` checks should report `accepted` with `source=Notarized Developer ID`. If notarization is rejected, `xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"` gives the per-file reason.

Unsigned local builds still work when the signing variables are not set; the DMG signing and notarization steps are skipped.

## Cutting a release

The version comes from the tag, so no manual version bump is needed:

```bash
git tag v1.0.1
git push origin v1.0.1
```

## Forking

Before publishing releases or enabling in-app updates from a fork, update project-specific identifiers:

| What | Where |
|------|--------|
| GitHub repo for releases | [`apps/desktop/forge.config.ts`](../../apps/desktop/forge.config.ts) — `publishers` config |
| In-app update feed | [`apps/desktop/src/main/updater.ts`](../../apps/desktop/src/main/updater.ts) — `GITHUB_REPO` |
| App bundle ID | [`apps/desktop/forge.config.ts`](../../apps/desktop/forge.config.ts) — `appBundleId` |
| App name, icon, author | [`apps/desktop/package.json`](../../apps/desktop/package.json), [`apps/desktop/assets/`](../../apps/desktop/assets/) |

If you ship a public fork with meaningful changes, use a distinct app name and bundle ID so it can coexist with upstream Yanshuf on the same Mac.

## Ongoing release checklist

1. Ensure `main` is green in CI.
2. Create release tag: `vX.Y.Z`.
3. Push tag.
4. Verify the workflow builds, signs, and publishes both architectures.
5. Smoke-test the downloaded DMG and in-app update from the previous release when possible.
