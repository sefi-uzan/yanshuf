# Security and trust

Yanshuf is a **local** network debugging tool. It behaves like other MITM proxies (Charles, mitmproxy, Proxyman): to inspect HTTPS, you install a root certificate that Yanshuf controls on your Mac.

Read this before installing the certificate or routing production traffic through Yanshuf.

## What Yanshuf can do on your Mac

When capture is enabled, Yanshuf can:

- Route selected system or app traffic through a local proxy on `127.0.0.1`
- Terminate TLS and decrypt HTTPS for traffic that passes through the proxy
- Read, display, modify, and replay request and response data in the app
- Expose a local MCP API (for AI tool integration) on `127.0.0.1`, protected by a token stored in your user data directory

Yanshuf does **not** upload captured traffic to Yanshuf servers. There is no built-in analytics or telemetry.

## The root certificate

On first launch, Yanshuf generates a **Yanshuf Root CA** in your local app data. When you choose **Install & Trust Certificate**, macOS adds it to your login keychain as a trusted root.

That means:

- Any HTTPS connection routed through Yanshuf can be decrypted and inspected by the app on **your** machine
- You should only trust certificates from builds you intentionally installed
- Do not install the certificate on shared or untrusted machines
- Turn capture off and remove the certificate when you are done debugging

### Remove the certificate

1. Open Yanshuf → **Settings → Certificate**
2. Use **Remove certificate** / **Reset** if available, or
3. Open **Keychain Access** → **login** → **Certificates**, find **Yanshuf Root CA**, and delete it

Also disable the system proxy under **System Settings → Network → … → Proxies** if Yanshuf is not running.

## Verify you have an official build

Install Yanshuf from [GitHub Releases](https://github.com/sefi-uzan/yanshuf/releases), not from unverified third-party mirrors.

Official releases are:

- Signed with a Developer ID certificate
- Notarized by Apple
- Published from this repository's release workflow

Gatekeeper should open them without `xattr` workarounds. If macOS warns about an unidentified developer, do not proceed — download the release again from GitHub.

In-app updates download from the same GitHub release feed and apply only after you click **Restart & update**.

## Data storage

Captured sessions, rules, certificates, and settings are stored locally in Yanshuf's application data on your Mac. Export or copy features share data only when **you** use them.

The MCP integration writes a local auth token so editor tools on your machine can talk to the running app. That API listens on localhost only.

## Updates and network access

Packaged Yanshuf checks for updates via [update.electronjs.org](https://update.electronjs.org), which reads public GitHub release metadata for this repository. No capture data is sent as part of update checks.

## Reporting security issues

See [SECURITY.md](../../SECURITY.md) in the repository root for how to report vulnerabilities privately.
