# CI quality gates

- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs `pnpm typecheck`, `pnpm lint`, and `pnpm test` on pull requests and pushes to `main`.
- [`.github/workflows/release-desktop.yml`](../../.github/workflows/release-desktop.yml) runs quality gates, then builds, signs, notarizes, and publishes macOS desktop artifacts (`arm64` and `x64`) from a `v*` tag.

See [Release checklist](./release.md) for Apple signing secrets, the tag workflow, and in-app update requirements.
