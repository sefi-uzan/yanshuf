import { EventEmitter } from 'node:events';
import net from 'node:net';
import { Proxy } from 'http-mitm-proxy';
import { v4 as uuidv4 } from 'uuid';
import type { AutoResponderEngine } from '../auto-responder/engine';
import {
  buildCaptureEntry,
  CaptureStore,
  extractRequestInfo,
  type PendingCapture,
} from './capture-store';
import { headersToRecord } from '../../shared/utils';
import {
  isComposerCaptureHeader,
  stripComposerCaptureHeader,
} from '../../shared/composer';
import { installProxyConsoleFilter, isBenignProxyError, uninstallProxyConsoleFilter } from './console-filter';

export interface ProxyServerOptions {
  port: number;
  host: string;
  sslCaDir: string;
  maxBodySize: number;
  captureStore: CaptureStore;
  autoResponder: AutoResponderEngine;
  shouldCapture?: (url: string) => boolean;
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
        // Drop any pending capture tied to this connection so it can't leak.
        const id = ctx ? (ctx as { yanshufId?: string }).yanshufId : undefined;
        if (id) this.pending.delete(id);
        if (err && isBenignProxyError(err, kind)) return;
        if (this.running) this.emit('error', err);
      });

      proxy.use(Proxy.gunzip);

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

        ctx.onRequestData((_ctx, chunk, cb) => {
          requestBody.push(chunk);
          cb(null, chunk);
        });

        ctx.onRequestEnd((_ctx, cb) => {
          cb();
        });

        const responseBody = new CappedBuffer(maxBodySize);
        ctx.onResponseData((_ctx, chunk, cb) => {
          responseBody.push(chunk);
          cb(null, chunk);
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
          if (!this.options.shouldCapture || this.options.shouldCapture(stored.url)) {
            this.options.captureStore.add(entry);
            this.emit('capture', entry);
          }
          cb();
        });

        const syncMatch = this.options.autoResponder.findMatch({
          method,
          url: info.fullUrl,
          headers,
          body: '',
        });
        if (syncMatch) {
          void this.respondWithRule(ctx, pending, syncMatch, id);
          return;
        }

        callback();
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

  private async respondWithRule(
    ctx: Parameters<Parameters<Proxy['onRequest']>[0]>[0],
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
      if (!this.options.shouldCapture || this.options.shouldCapture(pending.url)) {
        this.options.captureStore.add(entry);
        this.emit('capture', entry);
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.stopPendingSweep();
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
    partial: Partial<Pick<ProxyServerOptions, 'port' | 'maxBodySize' | 'shouldCapture'>>,
  ): void {
    this.options = { ...this.options, ...partial };
  }
}

function detectProtocol(httpVersion: string | undefined, isSSL: boolean): 'http1' | 'http2' | 'connect' {
  if (httpVersion === '2.0') return 'http2';
  if (isSSL) return 'http1';
  return 'http1';
}
