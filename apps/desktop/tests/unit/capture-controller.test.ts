import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@yanshuf/shared';
import { CaptureController } from '../../src/main/capture-controller';

function createController(overrides?: {
  systemEnabled?: boolean;
  serverRunning?: boolean;
}) {
  const settings = { ...DEFAULT_SETTINGS, capturing: false };
  const saveSettings = vi.fn(async () => {});
  let systemEnabled = overrides?.systemEnabled ?? false;
  let serverRunning = overrides?.serverRunning ?? false;

  const controller = new CaptureController({
    settings,
    saveSettings,
    systemProxy: {
      isEnabled: () => systemEnabled,
      enable: vi.fn(async () => {
        systemEnabled = true;
      }),
      disable: vi.fn(async () => {
        systemEnabled = false;
      }),
      releaseIfPointingAt: vi.fn(async () => {
        systemEnabled = false;
      }),
      updateCaptureLocalhost: vi.fn(async () => {}),
      updatePort: vi.fn(async () => {}),
    } as never,
    proxyServer: {
      isRunning: () => serverRunning,
      start: vi.fn(async () => {
        serverRunning = true;
      }),
      stop: vi.fn(async () => {
        serverRunning = false;
      }),
      getHiddenCount: () => 0,
    } as never,
    certManager: {
      getStatus: vi.fn(async () => ({ trusted: 'installed' as const, exists: true })),
    } as never,
    captureStore: {
      count: 0,
    } as never,
  });

  return { controller, settings, saveSettings };
}

describe('CaptureController', () => {
  it('reports capturing only when system proxy and server are active', () => {
    const off = createController();
    expect(off.controller.isCapturing()).toBe(false);

    const on = createController({ systemEnabled: true, serverRunning: true });
    expect(on.controller.isCapturing()).toBe(true);
  });

  it('enables system proxy and server together', async () => {
    const { controller, settings, saveSettings } = createController();
    await controller.setCapturing(true);

    expect(settings.capturing).toBe(true);
    expect(controller.isCapturing()).toBe(true);
    expect(saveSettings).toHaveBeenCalled();
  });

  it('disables system proxy and server together', async () => {
    const { controller, settings } = createController({ systemEnabled: true, serverRunning: true });
    await controller.setCapturing(false);

    expect(settings.capturing).toBe(false);
    expect(controller.isCapturing()).toBe(false);
  });

  it('starts and stops a temporary proxy server for composer without capture', async () => {
    const { controller } = createController();
    const result = await controller.withProxyServer(async () => 'ok');

    expect(result).toBe('ok');
    expect(controller.isCapturing()).toBe(false);
  });

  it('cleans up orphaned Yanshuf proxies on launch when capture is off', async () => {
    const { controller, settings } = createController();
    settings.capturing = false;

    await controller.restoreOnLaunch();

    expect(controller.isCapturing()).toBe(false);
  });

  it('restores capture on launch when persisted setting is on', async () => {
    const { controller, settings } = createController();
    settings.capturing = true;

    await controller.restoreOnLaunch();

    expect(controller.isCapturing()).toBe(true);
  });
});
