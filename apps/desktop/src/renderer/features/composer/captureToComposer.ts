import type { CaptureEntry, ComposerRequest } from '@yanshuf/shared';

export function captureToComposerRequest(entry: CaptureEntry): ComposerRequest {
  return {
    method: entry.client.method ?? 'GET',
    url: entry.client.url,
    headers: entry.client.headers,
    body: entry.client.body?.preview ?? '',
  };
}
