# HTTP/2 MITM Notes

Yanshuf v1 uses `http-mitm-proxy`, which terminates TLS and forwards traffic over **HTTP/1.1** internally after decryption.

## Observed behavior

When Chrome connects through the proxy:

1. Chrome sends `CONNECT host:443`.
2. Yanshuf performs TLS MITM with a dynamically generated leaf certificate signed by the local root CA.
3. After decryption, request metadata records `CaptureEntry.meta.protocol` as `http1` or `http2` based on the Node HTTP version when available.
4. Upstream forwarding uses HTTP/1.1 semantics inside the MITM library.

## Impact

- **Chrome and most browsers continue to work** — they fall back to HTTP/1.1 for many connections after MITM termination.
- **HTTP/2-specific features** (multiplexing, server push) are not preserved inside the proxy pipeline in v1.
- **WebSockets and SSE** are out of scope for v1.

## v1.1 follow-up

To support native HTTP/2 MITM:

- Evaluate `@httptoolkit/http-mock-server` or a custom `node:http2` bridge after TLS termination.
- Record ALPN negotiation in capture metadata for debugging.
- Add integration tests against `https://nghttp2.org/httpbin/get`.

## Manual spike

1. Start Yanshuf and enable system proxy.
2. Visit `https://google.com` in Chrome.
3. Confirm entries appear in the session list with decrypted URLs.
4. Inspect `protocol` in capture metadata — expect `http1` for most sites with the current library.
