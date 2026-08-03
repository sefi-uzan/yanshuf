import type { CaptureEntry, CaptureEntrySummary, InterceptPhase } from '@yanshuf/shared';
import { bodyPreview, headersToRecord, parseUrlParts } from '@yanshuf/shared';
import { contentEncodingOf, decodeBody } from './content-encoding';
import type { SessionThrottle } from './throttle';

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
      matchedMapRemoteRuleId: e.matchedMapRemoteRuleId,
      mappedToUrl: e.mappedToUrl,
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
  matchedMapRemoteRuleId?: string;
  mappedToUrl?: string;
  fromComposer?: boolean;
  throttlePassthrough?: boolean;
  sessionThrottle?: SessionThrottle;
}

/**
 * Bodies are captured exactly as they travelled the wire, so a compressed one
 * has to be inflated before it can be previewed. When retention truncated the
 * body it only decodes partially, and the wire size stays the honest number.
 */
function decodeForDisplay(
  source: BodySource,
  headers: Record<string, string>,
): { bytes: Buffer; size: number } {
  const bytes = source.concat();
  const decoded = decodeBody(bytes, contentEncodingOf(headers));
  if (!decoded) return { bytes, size: source.total };
  const truncated = bytes.length < source.total;
  return { bytes: decoded, size: truncated ? source.total : decoded.length };
}

export function buildFailedCaptureEntry(
  pending: PendingCapture,
  status: number,
  errorMessage: string,
  maxBodySize: number,
): CaptureEntry {
  const request = decodeForDisplay(pending.requestBody, pending.requestHeaders);
  const reqBodyRef = bodyPreview(request.bytes, maxBodySize, request.size);
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
    matchedMapRemoteRuleId: pending.matchedMapRemoteRuleId,
    mappedToUrl: pending.mappedToUrl,
    fromComposer: pending.fromComposer,
    requestBodySize: request.size,
    responseBodySize: 0,
    client: {
      method: pending.method,
      url: pending.url,
      headers: pending.requestHeaders,
      body: reqBodyRef,
    },
    server: {
      url: pending.mappedToUrl ?? pending.url,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: { size: 0, preview: errorMessage },
    },
  };
}

export function buildCaptureEntry(
  pending: PendingCapture,
  status: number,
  responseHeaders: Record<string, string>,
  responseBody: BodySource,
  maxBodySize: number,
): CaptureEntry {
  const request = decodeForDisplay(pending.requestBody, pending.requestHeaders);
  const response = decodeForDisplay(responseBody, responseHeaders);
  const reqBodyRef = bodyPreview(request.bytes, maxBodySize, request.size);
  const resBodyRef = bodyPreview(response.bytes, maxBodySize, response.size);
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
    matchedMapRemoteRuleId: pending.matchedMapRemoteRuleId,
    mappedToUrl: pending.mappedToUrl,
    fromComposer: pending.fromComposer,
    requestBodySize: request.size,
    responseBodySize: response.size,
    client: {
      method: pending.method,
      url: pending.url,
      headers: pending.requestHeaders,
      body: reqBodyRef,
    },
    server: {
      url: pending.mappedToUrl ?? pending.url,
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
  const request = decodeForDisplay(pending.requestBody, pending.requestHeaders);
  const reqBodyRef = bodyPreview(request.bytes, maxBodySize, request.size);

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
    matchedMapRemoteRuleId: pending.matchedMapRemoteRuleId,
    mappedToUrl: pending.mappedToUrl,
    fromComposer: pending.fromComposer,
    requestBodySize: request.size,
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
