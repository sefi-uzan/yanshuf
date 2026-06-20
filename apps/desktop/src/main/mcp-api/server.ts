import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { McpApiHandlers } from '@yanshuf/shared';
import { readBearerToken } from './auth';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function parseQuery(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    out[key] = value;
  }
  return out;
}

function numParam(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export class McpApiServer {
  private server: http.Server | null = null;

  constructor(
    private readonly token: string,
    private readonly handlers: McpApiHandlers,
  ) {}

  async start(port: number): Promise<number> {
    if (this.server) return port;

    this.server = http.createServer((req, res) => {
      void this.handle(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(port, '127.0.0.1', () => {
        const address = this.server!.address();
        const boundPort = typeof address === 'object' && address ? address.port : port;
        resolve(boundPort);
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server!.close((err) => (err ? reject(err) : resolve()));
    });
    this.server = null;
  }

  private unauthorized(res: ServerResponse): void {
    sendJson(res, 401, { error: 'Unauthorized' });
  }

  private notFound(res: ServerResponse): void {
    sendJson(res, 404, { error: 'Not found' });
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const token = readBearerToken(req.headers.authorization);
      if (token !== this.token) {
        this.unauthorized(res);
        return;
      }

      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const method = req.method ?? 'GET';
      const q = parseQuery(url);

      if (method === 'GET' && url.pathname === '/status') {
        sendJson(res, 200, await this.handlers.getStatus());
        return;
      }

      if (method === 'POST' && url.pathname === '/capture/toggle') {
        sendJson(res, 200, await this.handlers.toggleCapture());
        return;
      }

      if (method === 'POST' && url.pathname === '/session/cleanup') {
        sendJson(res, 200, await this.handlers.cleanupSession());
        return;
      }

      if (method === 'GET' && url.pathname === '/captures/search') {
        sendJson(res, 200, {
          captures: await this.handlers.searchCaptures({
            query: q.query,
            url: q.url,
            host: q.host,
            method: q.method,
            status: q.status,
            limit: numParam(q.limit),
          }),
        });
        return;
      }

      if (method === 'GET' && url.pathname === '/captures/wait') {
        sendJson(res, 200, await this.handlers.waitForCapture({
          query: q.query,
          url: q.url,
          host: q.host,
          method: q.method,
          status: q.status,
          sinceId: q.sinceId,
          timeoutMs: numParam(q.timeoutMs),
        }));
        return;
      }

      const captureMatch = url.pathname.match(/^\/captures\/([^/]+)$/);
      if (method === 'GET' && captureMatch) {
        const entry = await this.handlers.getCapture(decodeURIComponent(captureMatch[1]!));
        if (!entry) {
          sendJson(res, 404, { error: 'Capture not found' });
          return;
        }
        sendJson(res, 200, entry);
        return;
      }

      if (method === 'POST' && url.pathname === '/composer/send') {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        sendJson(res, 200, await this.handlers.sendRequest(body));
        return;
      }

      if (method === 'GET' && url.pathname === '/rules/mock') {
        sendJson(res, 200, { rules: await this.handlers.listMockRules() });
        return;
      }

      const mockRuleMatch = url.pathname.match(/^\/rules\/mock\/([^/]+)$/);
      if (mockRuleMatch) {
        const id = decodeURIComponent(mockRuleMatch[1]!);
        if (method === 'PUT') {
          const raw = await readBody(req);
          const body = raw ? JSON.parse(raw) : {};
          sendJson(res, 200, await this.handlers.saveMockRule({ ...body, id }));
          return;
        }
        if (method === 'DELETE') {
          await this.handlers.deleteMockRule(id);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      if (method === 'PUT' && url.pathname === '/rules/mock') {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        sendJson(res, 200, await this.handlers.saveMockRule(body));
        return;
      }

      if (method === 'GET' && url.pathname === '/rules/intercept') {
        sendJson(res, 200, { rules: await this.handlers.listInterceptRules() });
        return;
      }

      const interceptRuleMatch = url.pathname.match(/^\/rules\/intercept\/([^/]+)$/);
      if (interceptRuleMatch) {
        const id = decodeURIComponent(interceptRuleMatch[1]!);
        if (method === 'PUT') {
          const raw = await readBody(req);
          const body = raw ? JSON.parse(raw) : {};
          sendJson(res, 200, await this.handlers.saveInterceptRule({ ...body, id }));
          return;
        }
        if (method === 'DELETE') {
          await this.handlers.deleteInterceptRule(id);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      if (method === 'PUT' && url.pathname === '/rules/intercept') {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        sendJson(res, 200, await this.handlers.saveInterceptRule(body));
        return;
      }

      if (method === 'GET' && url.pathname === '/rules/map-remote') {
        sendJson(res, 200, { rules: await this.handlers.listMapRemoteRules() });
        return;
      }

      const mapRemoteRuleMatch = url.pathname.match(/^\/rules\/map-remote\/([^/]+)$/);
      if (mapRemoteRuleMatch) {
        const id = decodeURIComponent(mapRemoteRuleMatch[1]!);
        if (method === 'PUT') {
          const raw = await readBody(req);
          const body = raw ? JSON.parse(raw) : {};
          sendJson(res, 200, await this.handlers.saveMapRemoteRule({ ...body, id }));
          return;
        }
        if (method === 'DELETE') {
          await this.handlers.deleteMapRemoteRule(id);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      if (method === 'PUT' && url.pathname === '/rules/map-remote') {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        sendJson(res, 200, await this.handlers.saveMapRemoteRule(body));
        return;
      }

      if (method === 'GET' && url.pathname === '/breakpoints/pending') {
        sendJson(res, 200, { breakpoints: await this.handlers.listPendingBreakpoints() });
        return;
      }

      if (method === 'GET' && url.pathname === '/breakpoints/wait') {
        sendJson(res, 200, await this.handlers.waitForBreakpoint({ timeoutMs: numParam(q.timeoutMs) }));
        return;
      }

      const bpMatch = url.pathname.match(/^\/breakpoints\/([^/]+)\/(continue|abort)$/);
      if (bpMatch) {
        const id = decodeURIComponent(bpMatch[1]!);
        const action = bpMatch[2];
        if (action === 'continue' && method === 'POST') {
          const raw = await readBody(req);
          const body = raw ? JSON.parse(raw) : undefined;
          await this.handlers.continueBreakpoint(id, body);
          sendJson(res, 200, { ok: true });
          return;
        }
        if (action === 'abort' && method === 'POST') {
          await this.handlers.abortBreakpoint(id);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      this.notFound(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message });
    }
  }
}
