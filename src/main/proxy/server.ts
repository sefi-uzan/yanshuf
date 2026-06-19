import { EventEmitter } from 'node:events';
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
import { installProxyConsoleFilter, isBenignProxyError, uninstallProxyConsoleFilter } from './console-filter';

export interface ProxyServerOptions {
  port: number;
  host: string;
  sslCaDir: string;
  maxBodySize: number;
  captureStore: CaptureStore;
  autoResponder: AutoResponderEngine;
}

export class ProxyServer extends EventEmitter {
  private proxy: Proxy | null = null;
  private options: ProxyServerOptions;
  private pending = new Map<string, PendingCapture>();
  private running = false;

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

  start(): Promise<void> {
    if (this.running) return Promise.resolve();

    return new Promise((resolve, reject) => {
      installProxyConsoleFilter();
      const proxy = new Proxy();
      this.proxy = proxy;

      proxy.onError((_ctx, err, kind) => {
        if (err && isBenignProxyError(err, kind)) return;
        this.emit('error', err);
      });

      proxy.use(Proxy.gunzip);

      proxy.onRequest((ctx, callback) => {
        const req = ctx.clientToProxyRequest;
        const method = req.method ?? 'GET';
        const url = req.url ?? '/';
        const headers = headersToRecord(req.headers);
        const info = extractRequestInfo(method, url, req.headers, ctx.isSSL);
        const id = uuidv4();

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
          requestChunks: [],
        };

        this.pending.set(id, pending);

        const requestBodyChunks: Buffer[] = [];
        ctx.onRequestData((_ctx, chunk, cb) => {
          requestBodyChunks.push(chunk);
          cb(null, chunk);
        });

        ctx.onRequestEnd((_ctx, cb) => {
          pending.requestChunks = requestBodyChunks;
          cb();
        });

        const responseChunks: Buffer[] = [];
        ctx.onResponseData((_ctx, chunk, cb) => {
          responseChunks.push(chunk);
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
          const responseBody = Buffer.concat(responseChunks);

          const entry = buildCaptureEntry(
            stored,
            status,
            responseHeaders,
            responseBody,
            this.options.maxBodySize,
          );
          this.options.captureStore.add(entry);
          this.emit('capture', entry);
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
          resolve();
        },
      );

      proxy.onError((_ctx, err, kind) => {
        if (!this.running) {
          uninstallProxyConsoleFilter();
          reject(err);
          return;
        }
        if (err && isBenignProxyError(err, kind)) return;
      });
    });
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

      const entry = buildCaptureEntry(
        pending,
        synthetic.status,
        responseHeaders,
        synthetic.body,
        this.options.maxBodySize,
      );
      this.options.captureStore.add(entry);
      this.emit('capture', entry);
    } catch (err) {
      this.emit('error', err);
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
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

  updateOptions(partial: Partial<Pick<ProxyServerOptions, 'port' | 'maxBodySize'>>): void {
    this.options = { ...this.options, ...partial };
  }
}

function detectProtocol(httpVersion: string | undefined, isSSL: boolean): 'http1' | 'http2' | 'connect' {
  if (httpVersion === '2.0') return 'http2';
  if (isSSL) return 'http1';
  return 'http1';
}
