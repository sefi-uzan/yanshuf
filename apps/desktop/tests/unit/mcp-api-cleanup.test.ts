import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@yanshuf/shared';
import { AutoResponderEngine } from '../../src/main/auto-responder/engine';
import { InterceptEngine } from '../../src/main/intercept/engine';
import { MapRemoteEngine } from '../../src/main/map-remote/engine';
import { CaptureStore } from '../../src/main/proxy/capture-store';
import { createMcpHandlers } from '../../src/main/mcp-api/create-handlers';
import type { McpHandlerDeps } from '../../src/main/mcp-api/create-handlers';

function minimalDeps(): McpHandlerDeps {
  const captureStore = new CaptureStore(100);
  const autoResponder = new AutoResponderEngine();
  autoResponder.setRules([
    {
      id: 'mock-1',
      name: 'A',
      enabled: true,
      order: 0,
      match: { urlRegex: '.*' },
      response: { status: 200, headers: {} },
    },
    {
      id: 'mock-2',
      name: 'B',
      enabled: false,
      order: 1,
      match: { urlRegex: '.*' },
      response: { status: 404, headers: {} },
    },
  ]);

  const interceptEngine = new InterceptEngine();
  interceptEngine.setRules([
    {
      id: 'int-1',
      name: 'Rewrite',
      enabled: true,
      order: 0,
      mode: 'rewrite',
      phase: 'request',
      match: { urlRegex: '.*' },
    },
  ]);

  const mapRemoteEngine = new MapRemoteEngine();
  mapRemoteEngine.setRules([
    {
      id: 'map-1',
      name: 'Staging',
      enabled: true,
      order: 0,
      match: { urlRegex: '.*' },
      mapTo: { host: 'localhost' },
    },
  ]);

  const writes: Record<string, unknown> = {};
  return {
    settings: { ...DEFAULT_SETTINGS },
    saveSettings: async () => {},
    captureStore,
    autoResponder,
    interceptEngine,
    mapRemoteEngine,
    breakpointManager: { continue: () => false, abort: () => false } as unknown as McpHandlerDeps['breakpointManager'],
    proxyServer: { isRunning: () => false, start: async () => {}, stop: async () => {} } as unknown as McpHandlerDeps['proxyServer'],
    certManager: { verifyTrust: async () => ({ trusted: true }) } as unknown as McpHandlerDeps['certManager'],
    captureController: {
      isCapturing: () => false,
      toggle: async () => {},
      withProxyServer: async (fn: () => Promise<unknown>) => fn(),
    } as unknown as McpHandlerDeps['captureController'],
    composerService: {} as McpHandlerDeps['composerService'],
    store: { write: async (key: string, value: unknown) => { writes[key] = value; } } as unknown as McpHandlerDeps['store'],
    waitQueue: { waitForCapture: async () => null, waitForBreakpoint: async () => null } as unknown as McpHandlerDeps['waitQueue'],
    mcpApiPort: 9473,
    broadcastCaptureUpdate: () => {},
    tagComposerCaptures: () => {},
    mergeAndApplyThrottle: () => {},
  };
}

describe('cleanupSession', () => {
  it('clears captures and disables enabled rules atomically', async () => {
    const deps = minimalDeps();
    const handlers = createMcpHandlers(deps);

    const result = await handlers.cleanupSession();

    expect(result).toEqual({
      entryCount: 0,
      disabledMockCount: 1,
      disabledInterceptCount: 1,
      disabledMapRemoteCount: 1,
    });
    expect(deps.autoResponder.getRules().find((r) => r.id === 'mock-1')?.enabled).toBe(false);
    expect(deps.autoResponder.getRules().find((r) => r.id === 'mock-2')?.enabled).toBe(false);
    expect(deps.interceptEngine.getRules()[0]?.enabled).toBe(false);
    expect(deps.mapRemoteEngine.getRules()[0]?.enabled).toBe(false);
  });
});
