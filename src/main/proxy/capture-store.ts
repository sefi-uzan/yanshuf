import type { CaptureEntry, CaptureEntrySummary, InterceptPhase } from '../../shared/types';
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

  upsert(entry: CaptureEntry): void {
    const index = this.entries.findIndex((existing) => existing.id === entry.id);
    if (index >= 0) {
      this.entries[index] = entry;
      return;
    }
    this.add(entry);
  }

  patch(id: string, patch: Partial<CaptureEntry>): CaptureEntry | undefined {
    const entry = this.entries.find((existing) => existing.id === id);
    if (!entry) return undefined;
    if ('awaitingBreakpoint' in patch && patch.awaitingBreakpoint === undefined) {
      delete entry.awaitingBreakpoint;
    }
    const { awaitingBreakpoint: _ignored, ...rest } = patch;
    Object.assign(entry, rest);
    return entry;
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
      awaitingBreakpoint: e.awaitingBreakpoint,
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

/** A body accumulator that may retain fewer bytes than it saw (see CappedBuffer). */
export interface BodySource {
  concat(): Buffer;
  total: number;
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
  requestBody: BodySource;
  matchedRuleId?: string;
  fromComposer?: boolean;
}

export function buildCaptureEntry(
  pending: PendingCapture,
  status: number,
  responseHeaders: Record<string, string>,
  responseBody: BodySource,
  maxBodySize: number,
): CaptureEntry {
  const requestBytes = pending.requestBody.concat();
  const responseBytes = responseBody.concat();
  const reqBodyRef = bodyPreview(requestBytes, maxBodySize, pending.requestBody.total);
  const resBodyRef = bodyPreview(responseBytes, maxBodySize, responseBody.total);
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
    requestBodySize: pending.requestBody.total,
    responseBodySize: responseBody.total,
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

export function buildBreakpointCaptureEntry(
  pending: PendingCapture,
  snapshot: {
    breakpointId: string;
    phase: InterceptPhase;
    ruleName: string;
    responseStatus?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
  },
  maxBodySize: number,
): CaptureEntry {
  const requestBytes = pending.requestBody.concat();
  const reqBodyRef = bodyPreview(requestBytes, maxBodySize, pending.requestBody.total);

  let status = 0;
  let responseBodySize = 0;
  let serverHeaders: Record<string, string> = {};
  let serverBodyRef = bodyPreview(Buffer.alloc(0), maxBodySize, 0);

  if (snapshot.phase === 'response') {
    status = snapshot.responseStatus ?? 0;
    serverHeaders = snapshot.responseHeaders ?? {};
    const responseBody = snapshot.responseBody ?? '';
    responseBodySize = Buffer.byteLength(responseBody, 'utf8');
    serverBodyRef = responseBody
      ? bodyPreview(Buffer.from(responseBody, 'utf8'), maxBodySize, responseBodySize)
      : bodyPreview(Buffer.alloc(0), maxBodySize, 0);
  }

  return {
    id: pending.id,
    startedAt: pending.startedAt,
    durationMs: Date.now() - pending.startedAt,
    method: pending.method,
    url: pending.url,
    host: pending.host,
    path: pending.path,
    status,
    tls: pending.tls,
    protocol: pending.protocol,
    matchedRuleId: pending.matchedRuleId,
    fromComposer: pending.fromComposer,
    requestBodySize: pending.requestBody.total,
    responseBodySize,
    awaitingBreakpoint: {
      breakpointId: snapshot.breakpointId,
      phase: snapshot.phase,
      ruleName: snapshot.ruleName,
    },
    client: {
      method: pending.method,
      url: pending.url,
      headers: pending.requestHeaders,
      body: reqBodyRef,
    },
    server: {
      url: pending.url,
      headers: serverHeaders,
      body: serverBodyRef,
    },
  };
}
