# Yanshuf

Yanshuf is an open-source macOS desktop app for intercepting HTTP and HTTPS traffic. Route your system or app traffic through it to inspect, modify, replay, and automate requests in real time.

## Why I built this?

I am usually a Windows user and have used Fiddler Classic for years, its a powerful tool, way more powerful than this, but its outdated.
I tried some other free alternatives when I moved to Mac, like Charles and HTTP-Toolkit. I even considered paying for Fiddler Everywhere or whatever they call it.
I then decided to build this, its tailored for my own personal needs but I assume it might help someone with the same needs.
Oh and let's not forget, you can literally interact with it from your favorite AI agent.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](#install)

## Install

Pre-built releases are published on [GitHub Releases](https://github.com/sefi-uzan/yanshuf/releases).

### Requirements

- macOS 13 or later
- Apple Silicon (arm64) or Intel (x64)

### First-time install

1. Download the `.dmg` for your Mac's architecture from the latest release.
2. Open the DMG and drag **Yanshuf** to `/Applications`.
3. Launch Yanshuf. On first run, follow the setup guide to install and trust the **Yanshuf Root CA** so HTTPS traffic can be decrypted.
4. Enable capture when you're ready to inspect traffic.

Read [Security and trust](docs/user/security-and-trust.md) before installing the certificate — Yanshuf decrypts HTTPS traffic routed through it, and all capture data stays on your Mac.

Official releases are signed and notarized, so Gatekeeper should accept them without extra steps.

### Updates

Installed apps check for updates in the background and from **Settings → General → Check for updates**. When a newer version is available, Yanshuf downloads it and prompts you to **Restart & update**. See [Keeping Yanshuf up to date](docs/user/updates.md) for details.

## Features

### Network proxy

Route system or application traffic through Yanshuf and browse headers, bodies, status codes, and timing in a three-pane inspector.

### SSL decryption

Yanshuf generates a local root CA on first launch. Install it from the setup guide or **Settings → Certificate** to decrypt HTTPS. Capture and the system proxy stay disabled until the certificate is trusted.

### Auto Responder

Define ordered regex rules that return custom responses (inline body, local file, or delayed reply) when matching requests are seen.

### Composer

Build HTTP requests, import/export cURL, and keep a send history of recent requests.

### MCP integration

Connect Yanshuf to AI coding tools (Cursor, Claude Code, and similar) via the bundled MCP server. Use **Settings → AI Integration** to install the server and skills into your editor.

## Development

This repository is a **pnpm + Turborepo** monorepo.

### Prerequisites

- Node.js 24+ (matches CI)
- pnpm 10+ (`corepack enable` or `npm install -g pnpm`)
- macOS (system proxy integration is macOS-only)

### Getting started

```bash
git clone https://github.com/sefi-uzan/yanshuf.git
cd yanshuf
pnpm install
pnpm start
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm start` | Run the Electron desktop app in development |
| `pnpm --filter @yanshuf/web dev` | Run the marketing site locally (port 3000) |
| `pnpm --filter @yanshuf/web build` | Build the marketing site for production |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run Playwright E2E tests (desktop) |
| `pnpm run audit` | Fail on high/critical production advisories |
| `pnpm make` | Build a local `.dmg` (desktop) |

Run a task for a single package:

```bash
pnpm --filter @yanshuf/desktop start
pnpm --filter @yanshuf/web dev
pnpm --filter @yanshuf/mcp build
pnpm --filter @yanshuf/shared test
```

### Project structure

```
apps/
├── desktop/     # @yanshuf/desktop — Electron app
├── mcp/         # @yanshuf/mcp — MCP server for AI tool integration
└── web/         # @yanshuf/web — marketing site (Next.js)

packages/
├── shared/      # @yanshuf/shared — types, IPC, utilities
├── ui/            # @yanshuf/ui — shared UI components
├── typescript-config/
├── eslint-config/
└── tailwind-config/
```

Desktop app layout:

```
apps/desktop/src/
├── main/          # Electron main process (proxy, IPC, storage)
├── preload/       # contextBridge API
└── renderer/      # React UI
```

## Building locally

```bash
pnpm make
```

The `.dmg` is written to `apps/desktop/out/make/`.

Local builds are **unsigned**. macOS Gatekeeper may block them on your machine or others'. After copying to `/Applications`, open once via **Right-click → Open**, or clear the quarantine attribute:

```bash
xattr -cr /Applications/Yanshuf.app
```

> Yanshuf changes your macOS system proxy while capturing. If the app is force-quit or crashes, reopen it (it restores the proxy on launch) or turn the proxy off under **System Settings → Network → … → Proxies**.

## Forking

You're welcome to fork Yanshuf and ship your own build. Update repository identifiers, bundle ID, and branding, then follow the [release checklist](docs/operations/release.md) to configure signing and publish from your fork.

## Contributing

Contributions are welcome — bug reports, feature ideas, and pull requests.

Before opening a PR:

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm run audit`.
2. Keep changes focused; match existing code style.
3. Describe what changed and why in the PR.

For larger changes, open an issue first so we can align on approach.

## Documentation

See [docs](docs) for user guides, architecture notes, and maintainer operations.

- [Keeping Yanshuf up to date](docs/user/updates.md)
- [Security and trust](docs/user/security-and-trust.md)
- [Protocol limitations](docs/architecture/limitations.md)
- [Operations](docs/operations/ci.md)

## License

[MIT](LICENSE) — Copyright (c) 2026 Yanshuf
