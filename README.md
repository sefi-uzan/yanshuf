# Yanshuf

Yanshuf is a macOS Electron application that sits between your computer and the network, intercepting HTTP and HTTPS traffic so you can inspect, modify, and replay it.

## Features

### Network Proxy

Route your system or application traffic through Yanshuf to capture every request and response in real time. Browse headers, bodies, status codes, and timing in a three-pane inspector.

### SSL Decryption

Inspect encrypted HTTPS traffic with native SSL/TLS decryption. Yanshuf generates a **Yanshuf Root CA** on first app launch. Install and trust it in your macOS login keychain to decrypt TLS connections.

1. Follow the **setup guide** on first launch (or open **Settings → Certificate** later).
2. Click **Install Certificate**.
3. Click **Open Keychain Access**, select the **login** keychain, then set **Yanshuf Root CA** to **Always Trust**.

Capture and system proxy are blocked until the certificate is trusted.

### Auto Responder

Define ordered regex rules that return custom responses (inline body, local file, or delayed reply) when matching requests are seen.

### Composer

Build HTTP requests, import/export cURL, save collections, and use `{{variable}}` environment substitution.

## Development

### Prerequisites

- Node.js 20+
- macOS (system proxy integration is macOS-only)

### Setup

```bash
npm install
npm start
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run Electron in development mode |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run make` | Build a distributable (.dmg on macOS) |

### Project structure

```
src/
├── main/          # Electron main process (proxy, IPC, storage)
├── preload/       # contextBridge API
├── renderer/      # React + shadcn/ui
└── shared/        # Shared types and utilities
```

## Packaging & code signing

Build a local `.dmg`:

```bash
npm run make
```

For distribution outside your machine:

1. Enroll in the Apple Developer Program.
2. Create a Developer ID Application certificate.
3. Sign the app: `codesign --force --deep --sign "Developer ID Application: …" out/Yanshuf-darwin-*/Yanshuf.app`
4. Notarize with `xcrun notarytool submit` and staple the ticket.

Set `packagerConfig.osxSign` and `osxNotarize` in `forge.config.ts` once credentials are available.

## HTTP/2

See [docs/HTTP2.md](docs/HTTP2.md) for MITM protocol limitations and the v1.1 plan.

## License

MIT — see [LICENSE](LICENSE).
