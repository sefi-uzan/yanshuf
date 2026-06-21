# Rewrite live traffic

1. `yanshuf_status` — pre-flight.
2. `yanshuf_list_intercept_rules` — disable unrelated rules.
3. Create rewrite rule:
   - `yanshuf_save_intercept_rule(mode=rewrite, phase=request|response, urlRegex, headers?, body?, status?)`
   - Or bootstrap: `yanshuf_save_intercept_rule(captureId=..., mode=rewrite, phase=...)`
4. Trigger traffic; verify with `yanshuf_search_captures` and `yanshuf_get_capture`.
5. When done: `yanshuf_cleanup_session`.
