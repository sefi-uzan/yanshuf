import { describe, expect, it } from 'vitest';
import { SessionThrottle, ThrottleController, toThrottleConfig } from '../../src/main/proxy/throttle';

describe('ThrottleController', () => {
  it('applies latency when enabled', async () => {
    const controller = new ThrottleController({
      enabled: true,
      latencyMs: 40,
      downloadKbps: 0,
      uploadKbps: 0,
    });
    const start = Date.now();
    await controller.applyLatency();
    expect(Date.now() - start).toBeGreaterThanOrEqual(35);
  });

  it('skips latency when disabled', async () => {
    const controller = new ThrottleController({
      enabled: false,
      latencyMs: 500,
      downloadKbps: 0,
      uploadKbps: 0,
    });
    const start = Date.now();
    await controller.applyLatency();
    expect(Date.now() - start).toBeLessThan(20);
  });

  it('throttles download bytes within a session based on kbps', async () => {
    const session = new SessionThrottle(0, 8);
    const start = Date.now();
    await session.throttleDownload(Buffer.alloc(512));
    await session.throttleDownload(Buffer.alloc(512));
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
  });

  it('throttles each session independently', async () => {
    const chunk = Buffer.alloc(512);
    const session = new SessionThrottle(0, 8);
    const singleStart = Date.now();
    await session.throttleDownload(chunk);
    await session.throttleDownload(chunk);
    const singleElapsed = Date.now() - singleStart;

    const controller = new ThrottleController({
      enabled: true,
      latencyMs: 0,
      downloadKbps: 8,
      uploadKbps: 0,
    });
    const a = controller.createSessionLimiters()!;
    const b = controller.createSessionLimiters()!;
    const parallelStart = Date.now();
    await Promise.all([
      (async () => {
        await a.throttleDownload(chunk);
        await a.throttleDownload(chunk);
      })(),
      (async () => {
        await b.throttleDownload(chunk);
        await b.throttleDownload(chunk);
      })(),
    ]);
    const parallelElapsed = Date.now() - parallelStart;

    expect(singleElapsed).toBeGreaterThanOrEqual(50);
    expect(parallelElapsed).toBeLessThan(singleElapsed * 1.5);
  });

  it('returns no session limiters when disabled', () => {
    const controller = new ThrottleController({
      enabled: false,
      latencyMs: 0,
      downloadKbps: 8,
      uploadKbps: 8,
    });
    expect(controller.createSessionLimiters()).toBeUndefined();
  });

  it('resolves preset settings into config', () => {
    const config = toThrottleConfig({
      enabled: true,
      preset: 'edge',
      latencyMs: 0,
      downloadKbps: 0,
      uploadKbps: 0,
    });
    expect(config.latencyMs).toBe(840);
    expect(config.downloadKbps).toBe(240);
  });
});
