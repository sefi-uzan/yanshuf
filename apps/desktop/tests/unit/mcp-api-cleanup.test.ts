import { describe, expect, it } from 'vitest';
import { AutoResponderEngine } from '../../src/main/auto-responder/engine';
import { InterceptEngine } from '../../src/main/intercept/engine';
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

  const writes: Record<string, unknown> = {};
  return {
    settings: {
      port: 8888,
      ringBufferSize: 100,
      maxBodySize: 1024,
      systemProxyEnabled: false,
      proxyRunning: false,
      captureFilter: { mode: 'exclude', urls: '' },
    },
    saveSettings: async () => {},
    captureStore,
    autoResponder,
    interceptEngine,
    breakpointManager: { continue: () => false, abort: () => false } as McpHandlerDeps['breakpointManager'],
    proxyServer: { isRunning: () => false, start: async () => {}, stop: async () => {} } as McpHandlerDeps['proxyServer'],
    certManager: { verifyTrust: async () => ({ trusted: true }) } as McpHandlerDeps['certManager'],
    systemProxy: { isEnabled: () => false, enable: async () => {}, disable: async () => {} } as McpHandlerDeps['systemProxy'],
    composerService: {} as McpHandlerDeps['composerService'],
    store: { write: async (key: string, value: unknown) => { writes[key] = value; } } as McpHandlerDeps['store'],
    waitQueue: { waitForCapture: async () => null, waitForBreakpoint: async () => null } as McpHandlerDeps['waitQueue'],
    mcpApiPort: 9473,
    broadcastCaptureUpdate: () => {},
    tagComposerCaptures: () => {},
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
    });
    expect(deps.autoResponder.getRules().find((r) => r.id === 'mock-1')?.enabled).toBe(false);
    expect(deps.autoResponder.getRules().find((r) => r.id === 'mock-2')?.enabled).toBe(false);
    expect(deps.interceptEngine.getRules()[0]?.enabled).toBe(false);
  });
});
