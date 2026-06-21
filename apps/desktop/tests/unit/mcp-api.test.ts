import http from 'node:http';
import { describe, expect, it, afterEach } from 'vitest';
import type { McpApiHandlers, YanshufStatus } from '@yanshuf/shared';
import { DEFAULT_THROTTLE } from '@yanshuf/shared';
import { McpApiServer } from '../../src/main/mcp-api/server';

const TOKEN = 'test-token';

function mockHandlers(overrides: Partial<McpApiHandlers> = {}): McpApiHandlers {
  const status: YanshufStatus = {
    capturing: false,
    port: 8888,
    entryCount: 0,
    certTrusted: true,
    mcpApiPort: 9473,
    throttle: DEFAULT_THROTTLE,
  };
  return {
    getStatus: async () => status,
    toggleCapture: async () => ({ ...status, capturing: true }),
    setThrottle: async () => ({
      ...status,
      throttle: { ...DEFAULT_THROTTLE, enabled: true, preset: 'edge' },
    }),
    cleanupSession: async () => ({
      entryCount: 0,
      disabledMockCount: 0,
      disabledInterceptCount: 0,
      disabledMapRemoteCount: 0,
    }),
    searchCaptures: async () => [],
    getCapture: async () => undefined,
    waitForCapture: async () => ({ timedOut: true }),
    sendRequest: async () => ({ status: 200, headers: {}, body: '', durationMs: 1 }),
    listMockRules: async () => [],
    saveMockRule: async () => ({
      id: '1',
      name: 'x',
      enabled: true,
      order: 0,
      match: {},
      response: { status: 200, headers: {} },
    }),
    deleteMockRule: async () => {},
    listInterceptRules: async () => [],
    saveInterceptRule: async () => ({
      id: '1',
      name: 'x',
      enabled: true,
      order: 0,
      mode: 'rewrite',
      phase: 'request',
      match: {},
    }),
    deleteInterceptRule: async () => {},
    listMapRemoteRules: async () => [],
    saveMapRemoteRule: async () => ({
      id: '1',
      name: 'x',
      enabled: true,
      order: 0,
      match: {},
      mapTo: { host: 'localhost' },
    }),
    deleteMapRemoteRule: async () => {},
    listPendingBreakpoints: async () => [],
    continueBreakpoint: async () => {},
    abortBreakpoint: async () => {},
    waitForBreakpoint: async () => ({ timedOut: true }),
    ...overrides,
  };
}

function request(
  port: number,
  path: string,
  options: { method?: string; token?: string; body?: string } = {},
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: options.method ?? 'GET',
        headers: {
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(options.body
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(options.body),
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode ?? 0,
            body: text ? JSON.parse(text) : null,
          });
        });
      },
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

describe('McpApiServer', () => {
  let server: McpApiServer;
  let port = 0;

  afterEach(async () => {
    await server?.stop();
  });

  it('rejects unauthorized requests', async () => {
    server = new McpApiServer(TOKEN, mockHandlers());
    port = await server.start(0);
    const res = await request(port, '/status');
    expect(res.status).toBe(401);
  });

  it('returns status when authorized', async () => {
    server = new McpApiServer(TOKEN, mockHandlers());
    port = await server.start(0);
    const res = await request(port, '/status', { token: TOKEN });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ capturing: false, certTrusted: true });
  });

  it('cleans up session', async () => {
    server = new McpApiServer(TOKEN, mockHandlers());
    port = await server.start(0);
    const res = await request(port, '/session/cleanup', { method: 'POST', token: TOKEN });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      entryCount: 0,
      disabledMockCount: 0,
      disabledInterceptCount: 0,
      disabledMapRemoteCount: 0,
    });
  });

  it('sets throttle profile', async () => {
    server = new McpApiServer(TOKEN, mockHandlers());
    port = await server.start(0);
    const res = await request(port, '/throttle', {
      method: 'POST',
      token: TOKEN,
      body: JSON.stringify({ enabled: true, preset: 'edge' }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      throttle: { enabled: true, preset: 'edge' },
    });
  });
});
