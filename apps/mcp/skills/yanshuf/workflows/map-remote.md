# Map Remote

Route matching requests to a different host while preserving path and query.

1. `yanshuf_status` — pre-flight.
2. `yanshuf_list_map_remote_rules` — note existing rules; disable unrelated ones via `yanshuf_save_map_remote_rule` with `enabled: false` if needed.
3. Create rule:
   - From capture: `yanshuf_search_captures` → `yanshuf_save_map_remote_rule(captureId=..., host=..., urlRegex=... overrides optional)`
   - From scratch: `yanshuf_save_map_remote_rule(urlRegex, host, port?, protocol?)`
4. Ensure capture is on: `yanshuf_toggle_capture` if needed.
5. Trigger the API call in the target app.
6. `yanshuf_search_captures(url=...)` — check `matchedMapRemoteRuleId` and `mappedToUrl` on the summary.
7. `yanshuf_get_capture` for full upstream response if needed.
8. When done: `yanshuf_cleanup_session`.
