# Releasing Yanshuf Desktop

Yanshuf publishes signed, notarized macOS DMGs and ZIPs to [GitHub Releases](https://github.com/sefi-uzan/yanshuf/releases). DMGs are for first-time install; ZIPs power in-app updates. The running app checks for newer versions in the background and from **Settings → General → Check for updates**.

Both the `.app` and the `.dmg` are notarized and stapled. Gatekeeper assesses the disk image a user downloads, not only the app inside it, so notarizing just the app is not enough.

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

The **Release Desktop** workflow then, for `arm64` and `x64` in turn, builds the app, signs and notarizes the `.app`, builds and signs the DMG, notarizes and staples the DMG, verifies all of it with `codesign`/`stapler`/`spctl`, and uploads it to a **draft** release. Once both architectures succeed, a final job flips the draft to published and marks it as latest.

The draft stage matters: the in-app updater reads GitHub's `/releases/latest`, which excludes drafts. Nothing reaches users until every architecture is attached and verified. If a build fails, the draft simply stays hidden and can be deleted.

Expect the whole run to take a while — there are four notarization submissions, and each can take anywhere from a few minutes to half an hour.

Installed apps pick up the new version on the next background check (hourly) or when the user clicks **Check for updates**.

## CI

- **CI** (`.github/workflows/ci.yml`) — typecheck, lint, and unit tests on PRs and pushes to `main`.
- **Release Desktop** (`.github/workflows/release-desktop.yml`) — runs on `v*` tags only.

## Update behavior

- Background check runs every hour in packaged builds.
- When a newer semver is on GitHub Releases, the app downloads the signed ZIP in the background.
- When the download finishes, a toast appears with **Restart & update**. Clicking it quits and relaunches into the new version.
- **Check for updates** in Settings triggers the same flow immediately and shows whether you are up to date, downloading, ready to restart, or hit an error.
- DMGs remain available on GitHub for manual first-time installs or recovery.
- Existing installs that only open the release page need one manual DMG upgrade to a build that includes in-app updates and a release that includes ZIP assets. After that, updates stay in-app.

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
