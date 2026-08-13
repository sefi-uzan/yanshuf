---
name: yanshuf
description: >-
  Debug HTTP/HTTPS traffic with Yanshuf via MCP. Use when inspecting captures,
  mocking APIs, rewriting traffic, map remote routing, breakpoints, or replaying
  requests through the Yanshuf proxy.
---

# Yanshuf HTTP Debugging

Yanshuf is a local macOS proxy debugger. Use the MCP tools prefixed with `yanshuf_` — never call Yanshuf's local HTTP API directly (the tools hold the auth token, and direct calls bypass session cleanup).

## Mandatory sequence

1. **`yanshuf_status`** — always call first.
2. If `certTrusted` is false → stop and ask the user to complete certificate setup in the Yanshuf app (Settings → Certificate).
3. If capture is needed → **`yanshuf_toggle_capture`** (returns state after toggle; never toggle blind).
4. Do work (search, get, send, rules, breakpoints).
5. When the user says done → **`yanshuf_cleanup_session`** (atomically clears captures and disables all rules).

## Rules

Mock, intercept (rewrite/breakpoint), and Map Remote rules share three tools: `yanshuf_list_rules`, `yanshuf_save_rule`, `yanshuf_delete_rule`, each taking `ruleType: "mock" | "intercept" | "map-remote"`. Every rule takes `url` plus an optional `matchMode`:

| `matchMode` | Meaning |
|-------------|---------|
| `prefix` (default) | Host must be equal; the path must start with the given path. `www.cursor.com/dashboard` matches `/dashboard/usage?tab=all`. A host-only `url` matches every path on that host. |
| `exact` | The whole URL must match, query string included. |
| `regex` | Unanchored regular expression tested against the full URL. Use `^`/`$` to anchor. |

For `prefix` and `exact` the scheme is optional and a trailing slash is ignored, so a URL pasted from a capture works as-is with no escaping.

## Patterns

- **Inspect latest traffic**: `yanshuf_status` → `yanshuf_search_captures` → `yanshuf_get_capture(id)`
- **Replay a request**: `yanshuf_search_captures` → `yanshuf_send_request(captureId)` → `yanshuf_wait_for_capture(url=...)`
- **Mock an API**: `yanshuf_list_rules(mock)` → disable unrelated rules → `yanshuf_save_rule(ruleType=mock, ...)` → trigger traffic → `yanshuf_search_captures` → verify `matchedRuleId` on the summary
- **Map Remote**: `yanshuf_save_rule(ruleType=map-remote, url, host)` → trigger traffic → verify `mappedToUrl` on the summary
- **Breakpoint**: `yanshuf_save_rule(ruleType=intercept, mode=breakpoint, phase=...)` → `yanshuf_wait_for_breakpoint` → `yanshuf_get_capture` → `yanshuf_resolve_breakpoint(action=continue|abort)`

## Anti-patterns

- Do not call the local HTTP API with curl or fetch — always use the MCP tools.
- Do not toggle capture without checking `yanshuf_status` first.
- Do not guess capture IDs — search first.
- Do not enable unrelated mock/intercept rules during a focused task.
- Do not poll `yanshuf_search_captures` in a loop — use `yanshuf_wait_for_capture`.
- Mock rule bodies must be inline JSON/text (no file paths).

## Troubleshooting

If tools error with "Yanshuf is not running": the Yanshuf desktop app must be launched first — ask the user to open it, then retry the tool. For MCP connection issues (server not listed in the client), the user should re-run the integration wizard in Yanshuf Settings → Integrations.
