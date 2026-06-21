# Inspect traffic

1. `yanshuf_status` — confirm certTrusted and whether capturing is on.
2. If not capturing and traffic is needed: `yanshuf_toggle_capture`.
3. User triggers traffic in their app/browser (system proxy must route through Yanshuf).
4. `yanshuf_search_captures` with optional `query`, `url`, `host`, `method`, or `status`.
5. `yanshuf_get_capture` for the chosen ID.
6. When done: `yanshuf_clear_session`.

Use `yanshuf_wait_for_capture` instead of polling search when waiting for new traffic.
