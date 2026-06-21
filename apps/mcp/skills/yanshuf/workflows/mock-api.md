# Mock an API

1. `yanshuf_status` — pre-flight.
2. `yanshuf_list_mock_rules` — note existing rules; disable unrelated ones via `yanshuf_save_mock_rule` with `enabled: false` if needed.
3. Create rule:
   - From capture: `yanshuf_search_captures` → `yanshuf_save_mock_rule(captureId=..., name=..., urlRegex=... overrides optional)`
   - From scratch: `yanshuf_save_mock_rule(urlRegex, status, headers, body)`
4. Ensure capture is on: `yanshuf_toggle_capture` if needed.
5. Trigger the API call in the target app.
6. `yanshuf_search_captures(url=...)` — check `matchedRuleId` on the summary confirms the mock fired.
7. `yanshuf_get_capture` for response details if needed.
8. When done: `yanshuf_clear_session`.
