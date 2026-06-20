import type { CaptureEntry, CaptureEntrySummary } from '../../shared/types';
import { bodyPreview, headersToRecord, parseUrlParts } from '../../shared/utils';

export class CaptureStore {
  private entries: CaptureEntry[] = [];
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  setMaxSize(size: number): void {
    this.maxSize = size;
    while (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  add(entry: CaptureEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }

  list(): CaptureEntrySummary[] {
    return this.entries.map((e) => ({
      id: e.id,
      startedAt: e.startedAt,
      durationMs: e.durationMs,
      method: e.method,
      url: e.url,
      host: e.host,
      path: e.path,
      status: e.status,
      tls: e.tls,
      protocol: e.protocol,
      matchedRuleId: e.matchedRuleId,
      fromComposer: e.fromComposer,
      requestBodySize: e.requestBodySize,
      responseBodySize: e.responseBodySize,
    }));
  }

  get(id: string): CaptureEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  markFromComposer(id: string): boolean {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return false;
    entry.fromComposer = true;
    return true;
  }

  clear(): void {
    this.entries = [];
  }

  get count(): number {
    return this.entries.length;
  }
}

export interface PendingCapture {
  id: string;
  startedAt: number;
  method: string;
  url: string;
  host: string;
  path: string;
  tls: boolean;
  protocol: 'http1' | 'http2' | 'connect';
  requestHeaders: Record<string, string>;
  requestChunks: Buffer[];
  matchedRuleId?: string;
  fromComposer?: boolean;
}

export function buildCaptureEntry(
  pending: PendingCapture,
  status: number,
  responseHeaders: Record<string, string>,
  responseBody: Buffer,
  maxBodySize: number,
): CaptureEntry {
  const requestBody = Buffer.concat(pending.requestChunks);
  const reqBodyRef = bodyPreview(requestBody.subarray(0, maxBodySize));
  const resBodyRef = bodyPreview(responseBody.subarray(0, maxBodySize));
  const durationMs = Date.now() - pending.startedAt;

  return {
    id: pending.id,
    startedAt: pending.startedAt,
    durationMs,
    method: pending.method,
    url: pending.url,
    host: pending.host,
    path: pending.path,
    status,
    tls: pending.tls,
    protocol: pending.protocol,
    matchedRuleId: pending.matchedRuleId,
    fromComposer: pending.fromComposer,
    requestBodySize: requestBody.length,
    responseBodySize: responseBody.length,
    client: {
      method: pending.method,
      url: pending.url,
      headers: pending.requestHeaders,
      body: reqBodyRef,
    },
    server: {
      url: pending.url,
      headers: responseHeaders,
      body: resBodyRef,
    },
  };
}

export function extractRequestInfo(
  method: string,
  url: string,
  headers: Record<string, string | string[] | undefined>,
  isSSL: boolean,
): { host: string; path: string; fullUrl: string } {
  const normalizedHeaders = headersToRecord(headers);
  const hostHeader = normalizedHeaders.host ?? normalizedHeaders.Host ?? '';
  const parts = parseUrlParts(url, hostHeader);
  const fullUrl = url.startsWith('http') ? url : `${isSSL ? 'https' : 'http'}://${hostHeader}${url}`;
  return { host: parts.host || hostHeader, path: parts.path, fullUrl };
}
