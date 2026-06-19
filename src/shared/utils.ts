import type { BodyRef } from './types';

export function headersToRecord(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    result[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return result;
}

export function substituteVariables(
  input: string,
  variables: Record<string, string>,
): string {
  return input.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmed = key.trim();
    return variables[trimmed] ?? `{{${trimmed}}}`;
  });
}

export function substituteObjectVariables<T extends Record<string, string>>(
  obj: T,
  variables: Record<string, string>,
): T {
  const result = { ...obj } as T;
  for (const key of Object.keys(result)) {
    result[key] = substituteVariables(result[key], variables) as T[Extract<keyof T, string>];
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

export function bodyPreview(data: Buffer, maxLength = 512): BodyRef {
  const size = data.length;
  if (size === 0) return { size };
  const slice = data.subarray(0, maxLength);
  const text = slice.toString('utf8');
  const isBinary = /[\x00-\x08\x0E-\x1F]/.test(text);
  if (isBinary) {
    return {
      size,
      encoding: 'base64',
      preview: data.subarray(0, Math.min(256, size)).toString('base64'),
    };
  }
  return {
    size,
    encoding: 'utf8',
    preview: text + (size > maxLength ? '…' : ''),
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
