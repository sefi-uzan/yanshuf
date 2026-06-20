import type { BodyRef } from './types';

export function headersToRecord(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    result[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return result;
}

export function parseUrlParts(url: string, host?: string): { host: string; path: string } {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${host ?? 'localhost'}${url}`);
    return { host: parsed.host, path: `${parsed.pathname}${parsed.search}` };
  } catch {
    return { host: host ?? '', path: url };
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Base64 previews aren't human-readable, so we never retain more than this. */
const BINARY_PREVIEW_CAP = 256 * 1024;

/**
 * Build a body preview. `data` is the retained bytes (already capped upstream),
 * `maxLength` how many to surface, and `totalSize` the true on-the-wire size.
 */
export function bodyPreview(data: Buffer, maxLength = 512, totalSize?: number): BodyRef {
  const size = totalSize ?? data.length;
  if (data.length === 0) return { size };
  const slice = data.subarray(0, maxLength);
  // Only sniff the leading window for control chars; scanning megabytes is wasteful.
  const head = slice.subarray(0, Math.min(slice.length, 4096)).toString('utf8');
  // eslint-disable-next-line no-control-regex
  const isBinary = /[\x00-\x08\x0E-\x1F]/.test(head);
  if (isBinary) {
    return {
      size,
      encoding: 'base64',
      preview: data.subarray(0, Math.min(BINARY_PREVIEW_CAP, data.length)).toString('base64'),
    };
  }
  return {
    size,
    encoding: 'utf8',
    preview: slice.toString('utf8') + (size > slice.length ? '…' : ''),
  };
}

export function detectContentLanguage(content: string, contentType?: string): string {
  if (contentType?.includes('json')) return 'json';
  if (contentType?.includes('xml') || contentType?.includes('html')) return 'xml';
  if (contentType?.includes('javascript')) return 'javascript';
  try {
    JSON.parse(content);
    return 'json';
  } catch {
    return 'text';
  }
}
