# Breakpoint debugging

1. `yanshuf_status` — pre-flight; capture must be on.
2. `yanshuf_save_intercept_rule(mode=breakpoint, phase=request|response, urlRegex)`
3. `yanshuf_wait_for_breakpoint` — blocks until traffic hits the breakpoint.
4. `yanshuf_list_pending_breakpoints` or `yanshuf_get_capture(captureId)` — inspect paused traffic.
5. Edit and resume:
   - `yanshuf_continue_breakpoint(id, headers?, body?, status?)` — apply edits and forward
   - `yanshuf_abort_breakpoint(id)` — cancel (502 to client)
6. Verify outcome via `yanshuf_search_captures` / `yanshuf_get_capture`.
7. When done: `yanshuf_clear_session`.
