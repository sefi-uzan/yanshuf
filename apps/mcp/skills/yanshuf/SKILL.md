---
name: yanshuf
description: >-
  Debug HTTP/HTTPS traffic with Yanshuf via MCP. Use when inspecting captures,
  mocking APIs, rewriting traffic, map remote routing, breakpoints, or replaying requests through
  the Yanshuf proxy. Invoke with /yanshuf.
disable-model-invocation: true
---

# Yanshuf HTTP Debugging

Yanshuf is a local macOS proxy debugger. Use MCP tools prefixed with `yanshuf_`.

## Mandatory sequence

1. **`yanshuf_status`** — always call first.
2. If `certTrusted` is false → stop and ask the user to complete certificate setup in the Yanshuf app (Settings → Certificate).
3. If capture is needed → **`yanshuf_toggle_capture`** (returns state after toggle; never toggle blind).
4. Do work (search, get, send, rules, breakpoints).
5. When the user says done → **`yanshuf_cleanup_session`**.

## Core tools

| Tool | When |
|------|------|
| `yanshuf_status` | Pre-flight; check capturing, port, entryCount, certTrusted, throttle |
| `yanshuf_toggle_capture` | Start/stop capture (system proxy + MITM together) |
| `yanshuf_set_throttle` | Enable/disable global network throttling or apply a preset |
| `yanshuf_cleanup_session` | Clear captures and disable all rules when done |
| `yanshuf_search_captures` | Find captures (max 100, latest first) — use before get |
| `yanshuf_get_capture` | Full request/response for one ID |
| `yanshuf_wait_for_capture` | Block until new traffic (after send or user action) |
| `yanshuf_send_request` | Send HTTP request; optional `captureId` to replay |
| `yanshuf_list_mock_rules` / `yanshuf_save_mock_rule` / `yanshuf_delete_mock_rule` | Mock responses |
| `yanshuf_list_intercept_rules` / `yanshuf_save_intercept_rule` / `yanshuf_delete_intercept_rule` | Rewrite or breakpoint rules |
| `yanshuf_list_map_remote_rules` / `yanshuf_save_map_remote_rule` / `yanshuf_delete_map_remote_rule` | Forward matching requests to another host |
| `yanshuf_list_pending_breakpoints` / `yanshuf_continue_breakpoint` / `yanshuf_abort_breakpoint` | Breakpoint control |
| `yanshuf_wait_for_breakpoint` | Block until breakpoint hit |

## Workflows

Detailed recipes: read files in this skill folder when needed.

- [Inspect traffic](workflows/inspect-traffic.md)
- [Mock an API](workflows/mock-api.md)
- [Rewrite traffic](workflows/rewrite-traffic.md)
- [Map Remote routing](workflows/map-remote.md)
- [Breakpoint debugging](workflows/breakpoint-debug.md)

## Patterns

### Inspect latest traffic

```
yanshuf_status → yanshuf_search_captures (no filters) → yanshuf_get_capture(id)
```

### Replay a request

```
yanshuf_search_captures → yanshuf_send_request(captureId) → yanshuf_wait_for_capture(url=...)
```

### Mock an API

```
yanshuf_list_mock_rules → disable unrelated rules → yanshuf_save_mock_rule → trigger traffic → yanshuf_search_captures → verify matchedRuleId on summary
```

### Map Remote

```
yanshuf_list_map_remote_rules → yanshuf_save_map_remote_rule(urlRegex, host) → trigger traffic → yanshuf_search_captures → verify mappedToUrl on summary
```

### Breakpoint

```
yanshuf_save_intercept_rule(mode=breakpoint) → yanshuf_wait_for_breakpoint → yanshuf_get_capture → yanshuf_continue_breakpoint or yanshuf_abort_breakpoint
```

## Anti-patterns

- Do not toggle capture without checking `yanshuf_status` first.
- Do not guess capture IDs — search first.
- Do not enable unrelated mock/intercept rules during a focused task.
- Do not poll `yanshuf_search_captures` in a tight loop — use `yanshuf_wait_for_capture`.
- Mock rule bodies must be inline JSON/text (no file paths).

## Cleanup

- Call `yanshuf_cleanup_session` when the user confirms debugging is done. This atomically clears captures and disables all mock, intercept, and map-remote rules.
- A sessionEnd hook runs the same cleanup when the chat closes (installed via Yanshuf Integrations).

## Troubleshooting MCP connection

If MCP tools are unavailable in Cursor/Claude Code:

1. **Yanshuf app must be running** — the MCP server talks to the local HTTP API inside the app.
2. **Check MCP server manually** — run the configured command from `~/.cursor/mcp.json`:
   ```bash
   node /path/to/apps/mcp/dist/index.js
   ```
   It should stay running (no immediate crash). A warning on stderr is OK if the app was closed; tools fail until the app starts.
3. **Restart the AI client** after changing MCP config or rebuilding `apps/mcp`.
4. **Cursor:** Settings → MCP → `yanshuf` should show green/connected. If red, click for stderr logs.
5. **Re-run integration wizard** in Yanshuf Settings → Integrations if paths are stale after moving the repo.

Do **not** curl the local API directly — always use MCP tools (`yanshuf_status`, `yanshuf_search_captures`, etc.).
