import type { AutoResponderRule, CaptureEntry } from './types';

function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding',
]);

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function captureToAutoResponderRule(
  entry: CaptureEntry,
  order: number,
  id?: string,
): AutoResponderRule {
  const responseHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(entry.server.headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  }

  const bodyContent = entry.server.body?.preview ?? entry.server.body?.content ?? '';

  return {
    id: id ?? newId(),
    name: entry.host,
    enabled: true,
    order,
    match: {
      urlRegex: escapeRegex(entry.url),
    },
    response: {
      status: entry.status || 200,
      headers: responseHeaders,
      body: bodyContent ? { type: 'inline', content: bodyContent } : undefined,
      delayMs: 0,
    },
  };
}
