import { describe, expect, it } from 'vitest';
import { ThrottleController, toThrottleConfig } from '../../src/main/proxy/throttle';

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

  it('throttles download bytes based on kbps', async () => {
    const controller = new ThrottleController({
      enabled: true,
      latencyMs: 0,
      downloadKbps: 8,
      uploadKbps: 0,
    });
    const start = Date.now();
    await controller.throttleDownload(Buffer.alloc(512));
    await controller.throttleDownload(Buffer.alloc(512));
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
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
