import { EventEmitter } from 'node:events';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import type { ServerResponse } from 'node:http';
import { Proxy } from 'http-mitm-proxy';
import { v4 as uuidv4 } from 'uuid';
import type { AutoResponderEngine } from '../auto-responder/engine';
import type { BreakpointManager } from '../intercept/breakpoint-manager';
import type { MapRemoteEngine } from '../map-remote/engine';
import {
  installBodyReplacer,
  InterceptEngine,
  mergeHeaderRecord,
} from '../intercept/engine';
import {
  buildCaptureEntry,
  buildBreakpointCaptureEntry,
  buildFailedCaptureEntry,
  CaptureStore,
  extractRequestInfo,
  type PendingCapture,
} from './capture-store';
import { headersToRecord ,
  isComposerCaptureHeader,
  stripComposerCaptureHeader,
} from '@yanshuf/shared';
import type { InterceptRule } from '@yanshuf/shared';
import { installProxyConsoleFilter, isBenignProxyError, isExpectedUpstreamError, formatUpstreamError, uninstallProxyConsoleFilter } from './console-filter';
import type { ThrottleController } from './throttle';

type ProxyContext = Parameters<Parameters<Proxy['onRequest']>[0]>[0];

type ThrottleCallback = (error?: Error | null, chunk?: Buffer) => void;

export interface ProxyServerOptions {
  port: number;
  host: string;
  sslCaDir: string;
  maxBodySize: number;
  captureStore: CaptureStore;
  autoResponder: AutoResponderEngine;
  interceptEngine: InterceptEngine;
  mapRemoteEngine: MapRemoteEngine;
  breakpointManager: BreakpointManager;
  shouldCapture?: (url: string, host: string) => boolean;
  throttle?: ThrottleController;
}

/** Discard pending captures whose connections never completed after this long. */
const PENDING_SWEEP_INTERVAL_MS = 30_000;
const PENDING_MAX_AGE_MS = 5 * 60_000;

export class ProxyPortInUseError extends Error {
  port: number;

  constructor(port: number) {
    super(`Port ${port} is already in use`);
    this.name = 'ProxyPortInUseError';
    this.port = port;
  }
}

/** Resolve true when nothing is listening on host:port (so we can bind it). */
function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', (err: NodeJS.ErrnoException) => {
      tester.close();
      resolve(err.code !== 'EADDRINUSE' && err.code !== 'EACCES');
    });
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, host);
  });
}

/** Accumulate body chunks but stop retaining once we exceed the cap, to bound memory. */
class CappedBuffer {
  private chunks: Buffer[] = [];
  private retained = 0;
  total = 0;

  constructor(private readonly cap: number) {}

  push(chunk: Buffer): void {
    this.total += chunk.length;
    if (this.retained >= this.cap) return;
    const remaining = this.cap - this.retained;
    this.chunks.push(chunk.length > remaining ? chunk.subarray(0, remaining) : chunk);
    this.retained += Math.min(chunk.length, remaining);
  }

  concat(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

function getFullUrl(ctx: ProxyContext): string {
  const req = ctx.clientToProxyRequest;
  const method = req.method ?? 'GET';
  const url = req.url ?? '/';
  return extractRequestInfo(method, url, req.headers, ctx.isSSL).fullUrl;
}

function applyRequestRewrite(ctx: ProxyContext, rule: InterceptRule): void {
  const req = ctx.clientToProxyRequest;
  if (rule.request?.headers) {
    mergeHeaderRecord(req.headers, rule.request.headers);
  }
  if (rule.request?.body !== undefined && rule.request.body !== '') {
    installBodyReplacer((handler) => ctx.onRequestData(handler), rule.request.body);
  }
}

function applyResponseRewrite(ctx: ProxyContext, rule: InterceptRule): void {
  const res = ctx.serverToProxyResponse;
  if (!res) return;
  if (rule.response?.status !== undefined) {
    res.statusCode = rule.response.status;
  }
  if (rule.response?.headers) {
    mergeHeaderRecord(res.headers, rule.response.headers);
  }
  if (rule.response?.body !== undefined && rule.response.body !== '') {
    installBodyReplacer((handler) => ctx.onResponseData(handler), rule.response.body);
  }
}

function applyMapRemote(ctx: ProxyContext, mappedUrl: string): void {
  const parsed = new URL(mappedUrl);
  const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
  const port = parsed.port ? Number(parsed.port) : defaultPort;
  const hostHeader = parsed.port ? `${parsed.hostname}:${port}` : parsed.hostname;

  mergeHeaderRecord(ctx.clientToProxyRequest.headers, { host: hostHeader });

  const opts = ctx.proxyToServerRequestOptions;
  if (opts) {
    opts.host = parsed.hostname;
    opts.port = port;
    opts.path = `${parsed.pathname}${parsed.search}`;
    opts.headers.host = hostHeader;
    if (parsed.protocol === 'http:') {
      ctx.isSSL = false;
      opts.agent = http.globalAgent;
    } else if (parsed.protocol === 'https:') {
      ctx.isSSL = true;
      opts.agent = https.globalAgent;
    }
  }
}

export class ProxyServer extends EventEmitter {
  private proxy: Proxy | null = null;
  private options: ProxyServerOptions;
  private pending = new Map<string, PendingCapture>();
  private running = false;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: ProxyServerOptions) {
    super();
    this.options = options;
  }

  isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    return this.options.port;
  }

  async start(): Promise<void> {
    if (this.running) return;

    if (!(await isPortAvailable(this.options.port, this.options.host))) {
      throw new ProxyPortInUseError(this.options.port);
    }

    return new Promise((resolve, reject) => {
      installProxyConsoleFilter();
      const proxy = new Proxy();
      this.proxy = proxy;

      proxy.onError((ctx, err, kind) => {
        const id = ctx ? (ctx as { yanshufId?: string }).yanshufId : undefined;
        if (err && isBenignProxyError(err, kind)) {
          if (id) this.pending.delete(id);
          return;
        }

        if (id && err) {
          this.finalizeFailedCapture(id, err);
        } else if (id) {
          this.pending.delete(id);
        }

        if (err && this.running) {
          const message = isExpectedUpstreamError(err) ? formatUpstreamError(err) : err instanceof Error ? err.message : String(err);
          this.emit('notify', message);
          if (!isExpectedUpstreamError(err)) {
            console.error('[proxy]', err);
          }
        }
      });

      proxy.use(Proxy.gunzip);

      proxy.onResponse((ctx, callback) => {
        const fullUrl = getFullUrl(ctx);
        const rewriteRule = this.options.interceptEngine.findRewrite(fullUrl, 'response');
        if (rewriteRule) {
          applyResponseRewrite(ctx, rewriteRule);
          callback();
          return;
        }

        const breakpointRule = this.options.interceptEngine.findBreakpoint(fullUrl, 'response');
        if (breakpointRule) {
          this.handleResponseBreakpoint(ctx, breakpointRule);
          return;
        }

        callback();
      });

      proxy.onRequest((ctx, callback) => {
        const req = ctx.clientToProxyRequest;
        const method = req.method ?? 'GET';
        const url = req.url ?? '/';
        const rawHeaders = headersToRecord(req.headers);
        const fromComposer = isComposerCaptureHeader(rawHeaders);
        if (fromComposer) {
          for (const key of Object.keys(req.headers)) {
            if (key.toLowerCase() === 'x-yanshuf-composer') {
              delete req.headers[key];
            }
          }
        }
        const headers = fromComposer ? stripComposerCaptureHeader(rawHeaders) : rawHeaders;
        const info = extractRequestInfo(method, url, req.headers, ctx.isSSL);
        const id = uuidv4();
        (ctx as { yanshufId?: string }).yanshufId = id;

        const maxBodySize = this.options.maxBodySize;
        const requestBody = new CappedBuffer(maxBodySize);
        const pending: PendingCapture = {
          id,
          startedAt: Date.now(),
          method,
          url: info.fullUrl,
          host: info.host,
          path: info.path,
          tls: ctx.isSSL,
          protocol: detectProtocol(req.httpVersion, ctx.isSSL),
          requestHeaders: headers,
          requestBody,
          fromComposer,
        };

        this.pending.set(id, pending);

        const rewriteRule = this.options.interceptEngine.findRewrite(info.fullUrl, 'request');
        if (rewriteRule) {
          applyRequestRewrite(ctx, rewriteRule);
        }

        const breakpointRule = this.options.interceptEngine.findBreakpoint(info.fullUrl, 'request');
        const syncMatch = this.options.autoResponder.findMatch(info.fullUrl);
        pending.throttlePassthrough = !breakpointRule && !syncMatch;
        this.attachSessionThrottle(pending);

        ctx.onRequestData((_ctx, chunk, cb) => {
          requestBody.push(chunk);
          void this.pipeThrottledUpload(pending, chunk, cb);
        });

        ctx.onRequestEnd((_ctx, cb) => {
          cb();
        });

        const responseBody = new CappedBuffer(maxBodySize);
        ctx.onResponseData((_ctx, chunk, cb) => {
          responseBody.push(chunk);
          void this.pipeThrottledDownload(pending, chunk, cb);
        });

        ctx.onResponseEnd((_ctx, cb) => {
          const stored = this.pending.get(id);
          if (!stored) {
            cb();
            return;
          }
          this.pending.delete(id);

          const status = ctx.serverToProxyResponse?.statusCode ?? 0;
          const responseHeaders = headersToRecord(ctx.serverToProxyResponse?.headers ?? {});

          const entry = buildCaptureEntry(stored, status, responseHeaders, responseBody, maxBodySize);
          if (!this.options.shouldCapture || this.options.shouldCapture(stored.url, stored.host)) {
            this.options.captureStore.upsert(entry);
            this.emit('capture', entry);
          }
          cb();
        });

        if (breakpointRule) {
          this.handleRequestBreakpoint(ctx, callback, pending, id, requestBody, {
            method,
            url: info.fullUrl,
            headers,
            rule: breakpointRule,
          });
          return;
        }

        if (syncMatch) {
          void this.respondWithRule(ctx, pending, syncMatch, id);
          return;
        }

        this.applyMapRemoteIfNeeded(ctx, pending, info.fullUrl);

        void (async () => {
          if (pending.throttlePassthrough) {
            await this.options.throttle?.applyLatency();
          }
          callback();
        })();
      });

      proxy.listen(
        {
          port: this.options.port,
          host: this.options.host,
          sslCaDir: this.options.sslCaDir,
        },
        () => {
          this.running = true;
          this.startPendingSweep();
          resolve();
        },
      );

      proxy.onError((_ctx, err) => {
        if (!this.running) {
          uninstallProxyConsoleFilter();
          this.proxy = null;
          reject(err);
        }
      });
    });
  }

  private handleRequestBreakpoint(
    ctx: ProxyContext,
    callback: (error?: Error | null) => void,
    pending: PendingCapture,
    captureId: string,
    requestBody: CappedBuffer,
    input: {
      method: string;
      url: string;
      headers: Record<string, string>;
      rule: InterceptRule;
    },
  ): void {
    const chunks: Buffer[] = [];
    const req = ctx.clientToProxyRequest;

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      requestBody.push(chunk);
    });

    req.once('end', () => {
      void (async () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const breakpointId = uuidv4();
        const snapshot = {
          id: breakpointId,
          captureId,
          startedAt: pending.startedAt,
          ruleId: input.rule.id,
          ruleName: input.rule.name,
          phase: 'request' as const,
          method: input.method,
          url: input.url,
          headers: input.headers,
          body,
        };

        const breakpointEntry = buildBreakpointCaptureEntry(
          pending,
          {
            breakpointId,
            phase: 'request',
            ruleName: input.rule.name,
          },
          this.options.maxBodySize,
        );
        if (!this.options.shouldCapture || this.options.shouldCapture(pending.url, pending.host)) {
          this.options.captureStore.upsert(breakpointEntry);
          this.emit('capture', breakpointEntry);
        }

        const decision = await this.options.breakpointManager.wait(snapshot);

        if (decision.action === 'abort') {
          this.pending.delete(captureId);
          this.options.captureStore.patch(captureId, {
            status: 502,
            durationMs: Date.now() - pending.startedAt,
            awaitingBreakpoint: undefined,
            server: {
              url: pending.url,
              headers: { 'content-type': 'text/plain; charset=utf-8' },
              body: { size: 0, preview: 'Request aborted at breakpoint' },
            },
          });
          this.emit('capture');
          this.abortClient(ctx.proxyToClientResponse, 'Request aborted at breakpoint');
          return;
        }

        this.options.captureStore.patch(captureId, { awaitingBreakpoint: undefined });
        this.emit('capture');

        const mods = decision.modifications;
        if (mods?.headers) {
          mergeHeaderRecord(req.headers, mods.headers);
          pending.requestHeaders = headersToRecord(req.headers);
          this.options.captureStore.patch(captureId, {
            client: {
              method: pending.method,
              url: pending.url,
              headers: pending.requestHeaders,
              body: breakpointEntry.client.body,
            },
          });
        }

        const bodyToSend = mods?.body ?? body;
        ctx.onRequestEnd((_ctx, cb) => {
          if (bodyToSend && ctx.proxyToServerRequest) {
            ctx.proxyToServerRequest.write(Buffer.from(bodyToSend, 'utf8'));
          }
          cb();
        });

        this.applyMapRemoteIfNeeded(ctx, pending, input.url);
        pending.throttlePassthrough = true;
        this.attachSessionThrottle(pending);

        void (async () => {
          await this.options.throttle?.applyLatency();
          callback();
        })();
      })().catch((err) => {
        this.pending.delete(captureId);
        this.emit('notify', err instanceof Error ? err.message : 'Breakpoint error');
        this.abortClient(ctx.proxyToClientResponse, 'Breakpoint error');
      });
    });

    req.resume();
  }

  private handleResponseBreakpoint(ctx: ProxyContext, rule: InterceptRule): void {
    const captureId = (ctx as { yanshufId?: string }).yanshufId;
    const pending = captureId ? this.pending.get(captureId) : undefined;
    const serverRes = ctx.serverToProxyResponse;
    if (!serverRes) return;

    const status = serverRes.statusCode ?? 0;
    const headers = headersToRecord(serverRes.headers);
    const chunks: Buffer[] = [];

    serverRes.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    serverRes.once('end', () => {
      void (async () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const breakpointId = uuidv4();
        const snapshot = {
          id: breakpointId,
          captureId: captureId ?? breakpointId,
          startedAt: pending?.startedAt ?? Date.now(),
          ruleId: rule.id,
          ruleName: rule.name,
          phase: 'response' as const,
          method: ctx.clientToProxyRequest.method ?? 'GET',
          url: getFullUrl(ctx),
          status,
          headers,
          body,
        };

        if (pending && captureId) {
          const breakpointEntry = buildBreakpointCaptureEntry(
            pending,
            {
              breakpointId,
              phase: 'response',
              ruleName: rule.name,
              responseStatus: status,
              responseHeaders: headers,
              responseBody: body,
            },
            this.options.maxBodySize,
          );
          if (!this.options.shouldCapture || this.options.shouldCapture(pending.url, pending.host)) {
            this.options.captureStore.upsert(breakpointEntry);
            this.emit('capture', breakpointEntry);
          }
        }

        const decision = await this.options.breakpointManager.wait(snapshot);

        if (decision.action === 'abort') {
          if (captureId) this.pending.delete(captureId);
          if (captureId) {
            this.options.captureStore.patch(captureId, {
              status: 502,
              durationMs: pending ? Date.now() - pending.startedAt : 0,
              awaitingBreakpoint: undefined,
              server: {
                url: snapshot.url,
                headers: { 'content-type': 'text/plain; charset=utf-8' },
                body: { size: 0, preview: 'Response aborted at breakpoint' },
              },
            });
            this.emit('capture');
          }
          this.abortClient(ctx.proxyToClientResponse, 'Response aborted at breakpoint');
          return;
        }

        const mods = decision.modifications;
        const outStatus = mods?.status ?? status;
        const outHeaders = { ...headers, ...mods?.headers };
        const outBody = mods?.body ?? body;
        if (!outHeaders['content-length']) {
          outHeaders['content-length'] = String(Buffer.byteLength(outBody, 'utf8'));
        }

        ctx.proxyToClientResponse.writeHead(outStatus, outHeaders);
        ctx.proxyToClientResponse.end(outBody);

        if (pending && captureId) {
          this.pending.delete(captureId);
          const responseBody = new CappedBuffer(this.options.maxBodySize);
          responseBody.push(Buffer.from(outBody, 'utf8'));
          const entry = buildCaptureEntry(
            pending,
            outStatus,
            outHeaders,
            responseBody,
            this.options.maxBodySize,
          );
          if (!this.options.shouldCapture || this.options.shouldCapture(pending.url, pending.host)) {
            this.options.captureStore.upsert(entry);
            this.emit('capture', entry);
          }
        }
      })().catch((err) => {
        if (captureId) this.pending.delete(captureId);
        this.emit('notify', err instanceof Error ? err.message : 'Breakpoint error');
        this.abortClient(ctx.proxyToClientResponse, 'Breakpoint error');
      });
    });

    serverRes.resume();
  }

  private abortClient(res: ServerResponse, message: string): void {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    if (!res.writableEnded) {
      res.end(message);
    }
  }

  private startPendingSweep(): void {
    this.stopPendingSweep();
    this.sweepTimer = setInterval(() => {
      const cutoff = Date.now() - PENDING_MAX_AGE_MS;
      for (const [id, pending] of this.pending) {
        if (pending.startedAt < cutoff) this.pending.delete(id);
      }
    }, PENDING_SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  private stopPendingSweep(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  private attachSessionThrottle(pending: PendingCapture): void {
    if (!pending.throttlePassthrough) return;
    pending.sessionThrottle = this.options.throttle?.createSessionLimiters();
  }

  private async pipeThrottledUpload(
    pending: PendingCapture,
    chunk: Buffer,
    cb: ThrottleCallback,
  ): Promise<void> {
    try {
      if (pending.throttlePassthrough) {
        await pending.sessionThrottle?.throttleUpload(chunk);
      }
      cb(null, chunk);
    } catch (err) {
      cb(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private async pipeThrottledDownload(
    pending: PendingCapture,
    chunk: Buffer,
    cb: ThrottleCallback,
  ): Promise<void> {
    try {
      if (pending.throttlePassthrough) {
        await pending.sessionThrottle?.throttleDownload(chunk);
      }
      cb(null, chunk);
    } catch (err) {
      cb(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private applyMapRemoteIfNeeded(
    ctx: ProxyContext,
    pending: PendingCapture,
    originalUrl: string,
  ): void {
    const mapRule = this.options.mapRemoteEngine.findMatch(originalUrl);
    if (!mapRule) return;
    const mappedUrl = this.options.mapRemoteEngine.applyMapping(originalUrl, mapRule);
    applyMapRemote(ctx, mappedUrl);
    pending.matchedMapRemoteRuleId = mapRule.id;
    pending.mappedToUrl = mappedUrl;
  }

  private async respondWithRule(
    ctx: ProxyContext,
    pending: PendingCapture,
    match: ReturnType<AutoResponderEngine['findMatch']> & {},
    id: string,
  ): Promise<void> {
    pending.matchedRuleId = match.id;
    this.pending.delete(id);
    try {
      const synthetic = await this.options.autoResponder.buildResponse(match);
      const responseHeaders = { ...synthetic.headers };
      if (!responseHeaders['content-length']) {
        responseHeaders['content-length'] = String(synthetic.body.length);
      }
      ctx.proxyToClientResponse.writeHead(synthetic.status, responseHeaders);
      ctx.proxyToClientResponse.end(synthetic.body);

      const responseBody = new CappedBuffer(this.options.maxBodySize);
      responseBody.push(synthetic.body);
      const entry = buildCaptureEntry(
        pending,
        synthetic.status,
        responseHeaders,
        responseBody,
        this.options.maxBodySize,
      );
      if (!this.options.shouldCapture || this.options.shouldCapture(pending.url, pending.host)) {
        this.options.captureStore.upsert(entry);
        this.emit('capture', entry);
      }
    } catch (err) {
      this.emit('notify', err instanceof Error ? err.message : 'Mock response failed');
    }
  }

  private finalizeFailedCapture(id: string, err: unknown): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);

    const message = isExpectedUpstreamError(err) ? formatUpstreamError(err) : err instanceof Error ? err.message : 'Upstream request failed';
    const entry = buildFailedCaptureEntry(pending, 504, message, this.options.maxBodySize);
    if (!this.options.shouldCapture || this.options.shouldCapture(pending.url, pending.host)) {
      this.options.captureStore.upsert(entry);
      this.emit('capture', entry);
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.stopPendingSweep();
      this.options.breakpointManager.clear();
      if (!this.proxy || !this.running) {
        resolve();
        return;
      }
      this.proxy.close();
      this.proxy = null;
      this.running = false;
      this.pending.clear();
      uninstallProxyConsoleFilter();
      resolve();
    });
  }

  updateOptions(
    partial: Partial<Pick<ProxyServerOptions, 'port' | 'maxBodySize' | 'shouldCapture' | 'throttle'>>,
  ): void {
    this.options = { ...this.options, ...partial };
  }
}

function detectProtocol(httpVersion: string | undefined, isSSL: boolean): 'http1' | 'http2' | 'connect' {
  if (httpVersion === '2.0') return 'http2';
  if (isSSL) return 'http1';
  return 'http1';
}
