import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CaptureEntry } from '@yanshuf/shared';
import { AutoResponderEngine } from '../../src/main/auto-responder/engine';
import { BreakpointManager } from '../../src/main/intercept/breakpoint-manager';
import { InterceptEngine } from '../../src/main/intercept/engine';
import { MapRemoteEngine } from '../../src/main/map-remote/engine';
import { CaptureStore } from '../../src/main/proxy/capture-store';
import { ProxyServer } from '../../src/main/proxy/server';
import { ThrottleController } from '../../src/main/proxy/throttle';

/** Random rows keep the gzipped body large enough to arrive in many chunks. */
const PAYLOAD = Buffer.from(
  `{"rows":[${Array.from({ length: 40_000 }, () => `"${randomBytes(24).toString('hex')}"`).join(',')}]}`,
);
const GZIPPED = zlib.gzipSync(PAYLOAD);
const CHUNK_SIZE = 64 * 1024;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

/** Origin that answers with a gzipped body written in many small chunks. */
function startOrigin(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, {
      'content-type': 'application/json',
      'content-encoding': 'gzip',
      'content-length': String(GZIPPED.length),
    });
    for (let offset = 0; offset < GZIPPED.length; offset += CHUNK_SIZE) {
      res.write(GZIPPED.subarray(offset, offset + CHUNK_SIZE));
    }
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        port,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function fetchThroughProxy(
  proxyPort: number,
  targetUrl: string,
): Promise<{ body: Buffer; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    const req = http.request(
      {
        host: '127.0.0.1',
        port: proxyPort,
        method: 'GET',
        path: targetUrl,
        headers: { host: target.host, 'accept-encoding': 'gzip' },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({ body: Buffer.concat(chunks), headers: res.headers }));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('proxy response streaming', () => {
  let origin: { port: number; close: () => Promise<void> };
  let proxy: ProxyServer;
  let proxyPort: number;
  let captureStore: CaptureStore;
  let interceptEngine: InterceptEngine;
  let sslCaDir: string;

  beforeAll(async () => {
    origin = await startOrigin();
    proxyPort = await freePort();
    sslCaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yanshuf-proxy-test-'));
    captureStore = new CaptureStore(100);
    interceptEngine = new InterceptEngine();

    proxy = new ProxyServer({
      port: proxyPort,
      host: '127.0.0.1',
      sslCaDir,
      maxBodySize: 8 * 1024 * 1024,
      captureStore,
      autoResponder: new AutoResponderEngine(),
      interceptEngine,
      mapRemoteEngine: new MapRemoteEngine(),
      breakpointManager: new BreakpointManager(),
    });
    await proxy.start();
  }, 60_000);

  afterAll(async () => {
    await proxy?.stop();
    await origin?.close();
    fs.rmSync(sslCaDir, { recursive: true, force: true });
  });

  it('delivers the whole body to the client while throttling', async () => {
    proxy.updateOptions({
      throttle: new ThrottleController({
        enabled: true,
        latencyMs: 0,
        downloadKbps: 200_000,
        uploadKbps: 200_000,
      }),
    });

    const captured = new Promise<CaptureEntry>((resolve) => {
      proxy.once('capture', (entry: CaptureEntry) => resolve(entry));
    });
    const { body } = await fetchThroughProxy(proxyPort, `http://127.0.0.1:${origin.port}/big`);

    expect(body.length).toBe(GZIPPED.length);
    expect(zlib.gunzipSync(body).equals(PAYLOAD)).toBe(true);

    const entry = await captured;
    expect(entry.responseBodySize).toBe(PAYLOAD.length);
    expect(entry.server.body?.preview?.startsWith('{"rows":[')).toBe(true);
  }, 30_000);

  it('preserves upstream framing when only observing the body', async () => {
    proxy.updateOptions({ throttle: undefined });

    const { body, headers } = await fetchThroughProxy(
      proxyPort,
      `http://127.0.0.1:${origin.port}/big`,
    );

    expect(headers['content-length']).toBe(String(GZIPPED.length));
    expect(headers['transfer-encoding']).toBeUndefined();
    expect(headers['content-encoding']).toBe('gzip');
    expect(body.length).toBe(GZIPPED.length);
  }, 30_000);

  it('captures a readable original body when a rule replaces a compressed one', async () => {
    interceptEngine.setRules([
      {
        id: 'rewrite-1',
        name: 'replace body',
        enabled: true,
        order: 0,
        mode: 'rewrite',
        phase: 'response',
        match: { urlRegex: '/big' },
        response: { body: '{"replaced":true}' },
      },
    ]);

    const captured = new Promise<CaptureEntry>((resolve) => {
      proxy.once('capture', (entry: CaptureEntry) => resolve(entry));
    });
    const { body, headers } = await fetchThroughProxy(
      proxyPort,
      `http://127.0.0.1:${origin.port}/big`,
    );
    interceptEngine.setRules([]);

    expect(body.toString()).toBe('{"replaced":true}');
    expect(headers['content-encoding']).toBeUndefined();

    const entry = await captured;
    expect(entry.server.body?.preview?.startsWith('{"rows":[')).toBe(true);
  }, 30_000);
});
