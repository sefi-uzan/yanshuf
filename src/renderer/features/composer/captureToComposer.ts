import type { CaptureEntry, ComposerRequest } from '../../../shared/types';

export function captureToComposerRequest(entry: CaptureEntry): ComposerRequest {
  return {
    method: entry.client.method ?? 'GET',
    url: entry.client.url,
    headers: entry.client.headers,
    body: entry.client.body?.preview ?? '',
    name: entry.host,
  };
}
