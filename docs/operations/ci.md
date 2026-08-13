# CI quality gates

- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs `pnpm run audit`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` on pull requests and pushes to `main`.
- [`.github/workflows/release-desktop.yml`](../../.github/workflows/release-desktop.yml) runs the same quality gates, then builds, signs, notarizes, and publishes macOS desktop artifacts (`arm64` and `x64`) from a `v*` tag.
- [`.github/dependabot.yml`](../../.github/dependabot.yml) opens weekly PRs for npm and GitHub Actions updates.

`pnpm run audit` runs `pnpm audit --prod --audit-level=high`, so production dependencies with high or critical advisories fail CI. Use `pnpm run audit` (not bare `pnpm audit`) so the root script is used. Transitive pins live in [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) under `overrides`.

See [Release checklist](./release.md) for Apple signing secrets, the tag workflow, and in-app update requirements.
