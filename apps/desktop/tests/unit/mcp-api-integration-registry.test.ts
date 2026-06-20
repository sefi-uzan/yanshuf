import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonFileStore } from '../../src/main/storage/json-store';
import { createIntegrationRegistry } from '../../src/main/mcp-api/integration-registry';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => path.join(process.cwd(), 'apps', 'desktop'),
  },
}));

vi.mock('../../src/main/mcp-api/integration', async () => {
  const actual = await vi.importActual<typeof import('../../src/main/mcp-api/integration')>(
    '../../src/main/mcp-api/integration',
  );
  return {
    ...actual,
    detectMcpConfigured: vi.fn(async () => false),
    detectHookConfigured: vi.fn(async () => false),
    detectSkillConfigured: vi.fn(async () => true),
    installSkill: vi.fn(async () => ({ ok: true, message: 'ok', path: '/tmp/skill' })),
    uninstallMcpEntry: vi.fn(async () => ({ ok: true, message: 'mcp removed' })),
    uninstallSessionEndHook: vi.fn(async () => ({ ok: true, message: 'hook removed' })),
    uninstallSkillPath: vi.fn(async () => ({ ok: true, message: 'skill removed' })),
    updateMcpEntryPath: vi.fn(async () => ({ ok: true, message: 'ok' })),
    updateHookPath: vi.fn(async () => ({ ok: true, message: 'ok' })),
  };
});

let tmpDir: string;

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

describe('integration registry', () => {
  it('persists client install records with skills', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yanshuf-registry-'));
    const store = new JsonFileStore(tmpDir);
    await store.init();
    const registry = createIntegrationRegistry(store);

    const skills = await registry.recordInstall('cursor', [{ kind: 'personal' }], true);
    expect(skills).toHaveLength(1);

    const loaded = await registry.loadRegistry();
    expect(loaded.clients).toHaveLength(1);
    expect(loaded.clients[0].skills).toHaveLength(1);
    expect(loaded.clients[0].mcpInstalled).toBe(true);
  });

  it('reports not_installed when empty', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yanshuf-registry-'));
    const store = new JsonFileStore(tmpDir);
    await store.init();
    const registry = createIntegrationRegistry(store);

    const status = await registry.getStatus(true, true);
    expect(status.status).toBe('not_installed');
    expect(status.hasAnyInstall).toBe(false);
  });

  it('uninstalls skill files and removes registry entry', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yanshuf-registry-'));
    const store = new JsonFileStore(tmpDir);
    await store.init();
    const registry = createIntegrationRegistry(store);

    const skills = await registry.recordInstall('cursor', [{ kind: 'personal' }], true);
    const result = await registry.uninstall({
      client: 'cursor',
      scope: 'skill',
      skillId: skills[0].id,
    });
    expect(result.ok).toBe(true);

    const loaded = await registry.loadRegistry();
    expect(loaded.clients[0].skills).toHaveLength(0);
    expect(loaded.clients[0].mcpInstalled).toBe(true);
  });
});
