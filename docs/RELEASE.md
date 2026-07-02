# Releasing Yanshuf Desktop

Yanshuf publishes signed, notarized macOS DMGs to [GitHub Releases](https://github.com/sefi-uzan/yanshuf/releases). The running app checks for newer versions in the background and from **Settings → General → Check for updates**.

## One-time setup: Apple Developer

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. In Xcode → **Settings → Accounts** → **Manage Certificates**, create a **Developer ID Application** certificate.
3. Export the certificate from Keychain Access as a `.p12` file (remember the export password).
4. Create an [app-specific password](https://appleid.apple.com) for notarization.
5. Note your **Team ID** from [developer.apple.com → Membership](https://developer.apple.com/account).

## GitHub Actions secrets

Add these under **Repository → Settings → Secrets and variables → Actions**:

| Secret | Description | How to get it |
|--------|-------------|---------------|
| `MACOS_CERTIFICATE` | Base64-encoded `.p12` file | `base64 -i Certificates.p12 \| pbcopy` |
| `MACOS_CERTIFICATE_PASSWORD` | Password used when exporting `.p12` | Set during Keychain export |
| `APPLE_SIGNING_IDENTITY` | Exact certificate name | e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Apple ID email for notarization | Your Apple ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password | [appleid.apple.com](https://appleid.apple.com) |
| `APPLE_TEAM_ID` | 10-character team ID | developer.apple.com → Membership |

Optional:

| Secret | Description |
|--------|-------------|
| `KEYCHAIN_PASSWORD` | Ephemeral CI keychain password (defaults to a built-in value if omitted) |

`GITHUB_TOKEN` is provided automatically. The release workflow grants `contents: write` so Forge can create the GitHub Release.

## Local signed build (optional)

Export the same env vars in your shell, then:

```bash
pnpm --filter @yanshuf/desktop make
```

Unsigned local builds still work when signing env vars are not set.

## Release checklist

1. Bump `version` in [`apps/desktop/package.json`](../apps/desktop/package.json).
2. Merge to `main`.
3. Tag and push:

   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. The **Release Desktop** workflow builds, signs, notarizes, and uploads the DMG.
5. Installed apps detect the new version on the next background check (hourly) or when the user clicks **Check for updates**.

## CI

- **CI** (`.github/workflows/ci.yml`) — typecheck, lint, and unit tests on PRs and pushes to `main`.
- **Release Desktop** (`.github/workflows/release-desktop.yml`) — runs on `v*` tags only.

## Update behavior

- Background check runs every hour in packaged builds.
- When a newer semver is on GitHub Releases, the app shows a toast with a **Download** action that opens the release page.
- Users download the DMG and replace the app in `/Applications` manually.
- Signed + notarized builds open normally after download (no `xattr` workaround).
