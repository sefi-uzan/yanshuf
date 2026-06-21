import { randomUUID } from 'node:crypto';
import type {
  IntegrationAggregateStatus,
  IntegrationClient,
  IntegrationClientRecord,
  IntegrationClientStatus,
  IntegrationInstallRecord,
  IntegrationRegistry,
  IntegrationSkillRecord,
  IntegrationStatusResult,
  IntegrationUninstallPayload,
  IntegrationUninstallResult,
  IntegrationUpdatePayload,
  SkillInstallTarget,
} from '@yanshuf/shared';
import type { JsonFileStore } from '../storage/json-store';
import {
  bundledIntegrationManifest,
  detectHookConfigured,
  detectMcpConfigured,
  detectSkillConfigured,
  getClientConfigPaths,
  installMcpEntry,
  installSessionEndHook,
  installSkill,
  uninstallMcpEntry,
  uninstallSessionEndHook,
  uninstallSkillPath,
  updateHookPath,
  updateMcpEntryPath,
} from './integration';
import { checkPrerequisites } from './integration-prerequisites';

const REGISTRY_FILE = 'integration-registry.json';
const ALL_CLIENTS: IntegrationClient[] = ['cursor', 'claude-code'];

function migrateRegistry(raw: IntegrationRegistry & { installs?: IntegrationInstallRecord[] }): IntegrationRegistry {
  if (raw.clients?.length) {
    return { clients: raw.clients, postCertPromptDismissed: raw.postCertPromptDismissed };
  }

  const clientMap = new Map<IntegrationClient, IntegrationClientRecord>();
  for (const install of raw.installs ?? []) {
    let clientRecord = clientMap.get(install.client);
    if (!clientRecord) {
      clientRecord = {
        client: install.client,
        mcpInstalled: true,
        hookInstalled: true,
        bundleVersion: install.bundleVersion,
        skillContentHash: install.skillContentHash,
        paths: install.paths,
        skills: [],
        installedAt: install.installedAt,
      };
      clientMap.set(install.client, clientRecord);
    }
    clientRecord.skills.push({
      id: install.id,
      kind: install.skill.kind,
      path: install.skill.path,
      repoRoot: install.skill.repoRoot,
      bundleVersion: install.bundleVersion,
      skillContentHash: install.skillContentHash,
      installedAt: install.installedAt,
    });
  }

  return {
    clients: [...clientMap.values()],
    postCertPromptDismissed: raw.postCertPromptDismissed,
  };
}

export function createIntegrationRegistry(store: JsonFileStore) {
  async function loadRegistry(): Promise<IntegrationRegistry> {
    const raw = await store.read<IntegrationRegistry & { installs?: IntegrationInstallRecord[] }>(
      REGISTRY_FILE,
      { clients: [] },
    );
    const registry = migrateRegistry(raw);
    if (raw.installs?.length && !raw.clients?.length) {
      await saveRegistry(registry);
    }
    return registry;
  }

  async function saveRegistry(registry: IntegrationRegistry): Promise<void> {
    await store.write(REGISTRY_FILE, registry);
  }

  function getOrCreateClientRecord(
    registry: IntegrationRegistry,
    client: IntegrationClient,
  ): IntegrationClientRecord {
    let record = registry.clients.find((c) => c.client === client);
    if (!record) {
      const paths = getClientConfigPaths(client);
      const manifest = bundledIntegrationManifest();
      record = {
        client,
        mcpInstalled: false,
        hookInstalled: false,
        bundleVersion: manifest.bundleVersion,
        skillContentHash: manifest.skillContentHash,
        paths: {
          mcpConfig: paths.mcpConfig,
          hookConfig: paths.hookConfig,
          mcpEntry: paths.mcpEntry,
          hookScript: paths.cleanupSessionScript,
        },
        skills: [],
        installedAt: new Date().toISOString(),
      };
      registry.clients.push(record);
    }
    return record;
  }

  async function buildClientStatus(
    client: IntegrationClient,
    clientRecord: IntegrationClientRecord | undefined,
    manifest: ReturnType<typeof bundledIntegrationManifest>,
  ): Promise<IntegrationClientStatus | null> {
    const paths = getClientConfigPaths(client);
    const mcpConfigured = await detectMcpConfigured(client);
    const hookConfigured = await detectHookConfigured(client);

    const skillStatuses = await Promise.all(
      (clientRecord?.skills ?? []).map(async (skill) => {
        const configured = await detectSkillConfigured(skill.path);
        const outdated =
          skill.bundleVersion !== manifest.bundleVersion ||
          skill.skillContentHash !== manifest.skillContentHash;
        return {
          id: skill.id,
          kind: skill.kind,
          path: skill.path,
          repoRoot: skill.repoRoot,
          configured,
          tracked: true,
          outdated,
          bundleVersion: skill.bundleVersion,
        };
      }),
    );

    const clientOutdated =
      Boolean(clientRecord) &&
      (clientRecord.bundleVersion !== manifest.bundleVersion ||
        clientRecord.skillContentHash !== manifest.skillContentHash ||
        skillStatuses.some((s) => s.outdated));

    const hasAnyConfigured =
      mcpConfigured || hookConfigured || skillStatuses.some((s) => s.configured);

    if (!hasAnyConfigured && !clientRecord) return null;

    return {
      client,
      bundleVersion: clientRecord?.bundleVersion ?? manifest.bundleVersion,
      outdated: clientOutdated,
      mcp: {
        configured: mcpConfigured,
        tracked: clientRecord?.mcpInstalled ?? false,
        path: paths.mcpEntry,
        configPath: paths.mcpConfig,
        outdated: clientOutdated && (clientRecord?.mcpInstalled ?? false),
      },
      hook: {
        configured: hookConfigured,
        tracked: clientRecord?.hookInstalled ?? false,
        path: paths.cleanupSessionScript,
        configPath: paths.hookConfig,
        outdated: false,
      },
      skills: skillStatuses,
      hasAnyConfigured,
    };
  }

  async function getStatus(certTrusted: boolean, apiReachable: boolean): Promise<IntegrationStatusResult> {
    const registry = await loadRegistry();
    const manifest = bundledIntegrationManifest();
    const prerequisites = await checkPrerequisites(certTrusted);

    const clients: IntegrationClientStatus[] = [];
    for (const client of ALL_CLIENTS) {
      const clientRecord = registry.clients.find((c) => c.client === client);
      const status = await buildClientStatus(client, clientRecord, manifest);
      if (status) clients.push(status);
    }

    const hasAnyInstall = clients.some((c) => c.hasAnyConfigured);

    let aggregate: IntegrationAggregateStatus = 'not_installed';
    if (hasAnyInstall) {
      aggregate = clients.some((c) => c.outdated || c.mcp.outdated || c.skills.some((s) => s.outdated))
        ? 'update_available'
        : 'installed';
    }

    void apiReachable;

    return { status: aggregate, manifest, clients, prerequisites, hasAnyInstall };
  }

  async function recordInstall(
    client: IntegrationClient,
    targets: SkillInstallTarget[],
    verifyOk: boolean,
  ): Promise<IntegrationSkillRecord[]> {
    void verifyOk;
    const registry = await loadRegistry();
    const manifest = bundledIntegrationManifest();
    const paths = getClientConfigPaths(client);
    const now = new Date().toISOString();
    const clientRecord = getOrCreateClientRecord(registry, client);

    clientRecord.mcpInstalled = true;
    clientRecord.hookInstalled = true;
    clientRecord.bundleVersion = manifest.bundleVersion;
    clientRecord.skillContentHash = manifest.skillContentHash;
    clientRecord.installedAt = now;
    clientRecord.paths = {
      mcpConfig: paths.mcpConfig,
      hookConfig: paths.hookConfig,
      mcpEntry: paths.mcpEntry,
      hookScript: paths.cleanupSessionScript,
    };

    const created: IntegrationSkillRecord[] = [];

    for (const target of targets) {
      const skillResult = await installSkill(client, target);
      if (!skillResult.ok || !skillResult.path) continue;

      const existingIdx = clientRecord.skills.findIndex(
        (s) =>
          s.kind === target.kind &&
          (target.kind === 'personal' ? true : s.repoRoot === target.repoRoot),
      );

      const skillRecord: IntegrationSkillRecord = {
        id: existingIdx >= 0 ? clientRecord.skills[existingIdx].id : randomUUID(),
        kind: target.kind,
        path: skillResult.path,
        repoRoot: target.kind === 'project' ? target.repoRoot : undefined,
        bundleVersion: manifest.bundleVersion,
        skillContentHash: manifest.skillContentHash,
        installedAt: now,
      };

      if (existingIdx >= 0) {
        clientRecord.skills[existingIdx] = skillRecord;
      } else {
        clientRecord.skills.push(skillRecord);
      }
      created.push(skillRecord);
    }

    await saveRegistry(registry);
    return created;
  }

  async function updateInstallRecord(skillId: string): Promise<{ ok: boolean; message: string }> {
    const registry = await loadRegistry();
    for (const clientRecord of registry.clients) {
      const skill = clientRecord.skills.find((s) => s.id === skillId);
      if (!skill) continue;

      const paths = getClientConfigPaths(clientRecord.client);
      await updateMcpEntryPath(clientRecord.client, paths.mcpEntry);
      await updateHookPath(clientRecord.client, paths.cleanupSessionScript);

      const target: SkillInstallTarget =
        skill.kind === 'personal'
          ? { kind: 'personal' }
          : { kind: 'project', repoRoot: skill.repoRoot! };
      const skillResult = await installSkill(clientRecord.client, target);
      if (!skillResult.ok) return skillResult;

      const manifest = bundledIntegrationManifest();
      skill.bundleVersion = manifest.bundleVersion;
      skill.skillContentHash = manifest.skillContentHash;
      skill.installedAt = new Date().toISOString();
      skill.path = skillResult.path ?? skill.path;
      clientRecord.bundleVersion = manifest.bundleVersion;
      clientRecord.skillContentHash = manifest.skillContentHash;
      clientRecord.paths.mcpEntry = paths.mcpEntry;
      clientRecord.paths.hookScript = paths.cleanupSessionScript;

      await saveRegistry(registry);
      return { ok: true, message: `Updated ${skill.path}` };
    }
    return { ok: false, message: 'Skill install not found.' };
  }

  async function updateAllInstalls(payload: IntegrationUpdatePayload = {}): Promise<{
    ok: boolean;
    results: { id: string; ok: boolean; message: string }[];
  }> {
    const registry = await loadRegistry();
    let skillIds = registry.clients.flatMap((c) => c.skills.map((s) => s.id));
    if (payload.recordIds?.length) {
      skillIds = skillIds.filter((id) => payload.recordIds!.includes(id));
    }
    if (payload.client) {
      const clientRecord = registry.clients.find((c) => c.client === payload.client);
      skillIds = clientRecord?.skills.map((s) => s.id) ?? [];
    }

    const clientsSeen = new Set<IntegrationClient>();
    const results: { id: string; ok: boolean; message: string }[] = [];

    for (const skillId of skillIds) {
      const clientRecord = registry.clients.find((c) => c.skills.some((s) => s.id === skillId));
      if (clientRecord && !clientsSeen.has(clientRecord.client)) {
        clientsSeen.add(clientRecord.client);
        const paths = getClientConfigPaths(clientRecord.client);
        await updateMcpEntryPath(clientRecord.client, paths.mcpEntry);
        await updateHookPath(clientRecord.client, paths.cleanupSessionScript);
      }
      const result = await updateInstallRecord(skillId);
      results.push({ id: skillId, ...result });
    }

    return { ok: results.every((r) => r.ok), results };
  }

  async function uninstall(payload: IntegrationUninstallPayload): Promise<IntegrationUninstallResult> {
    const registry = await loadRegistry();
    const clientRecord = registry.clients.find((c) => c.client === payload.client);

    if (payload.scope === 'mcp') {
      const result = await uninstallMcpEntry(payload.client);
      if (!result.ok) return result;
      if (clientRecord) {
        clientRecord.mcpInstalled = false;
        if (!clientRecord.hookInstalled && clientRecord.skills.length === 0) {
          registry.clients = registry.clients.filter((c) => c.client !== payload.client);
        }
        await saveRegistry(registry);
      }
      return { ok: true, message: result.message };
    }

    if (payload.scope === 'hook') {
      const result = await uninstallSessionEndHook(payload.client);
      if (!result.ok) return result;
      if (clientRecord) {
        clientRecord.hookInstalled = false;
        if (!clientRecord.mcpInstalled && clientRecord.skills.length === 0) {
          registry.clients = registry.clients.filter((c) => c.client !== payload.client);
        }
        await saveRegistry(registry);
      }
      return { ok: true, message: result.message };
    }

    if (payload.scope === 'client') {
      if (clientRecord) {
        if (clientRecord.mcpInstalled) await uninstallMcpEntry(payload.client);
        if (clientRecord.hookInstalled) await uninstallSessionEndHook(payload.client);
        for (const skill of clientRecord.skills) {
          await uninstallSkillPath(skill.path);
        }
      } else {
        await uninstallMcpEntry(payload.client);
        await uninstallSessionEndHook(payload.client);
      }
      registry.clients = registry.clients.filter((c) => c.client !== payload.client);
      await saveRegistry(registry);
      return { ok: true, message: `Uninstalled all Yanshuf components from ${payload.client}.` };
    }

    if (!clientRecord) {
      return { ok: false, message: 'No tracked integration for this client.' };
    }

    if (payload.scope === 'skill') {
      if (!payload.skillId) return { ok: false, message: 'Skill id is required.' };
      const skill = clientRecord.skills.find((s) => s.id === payload.skillId);
      if (!skill) return { ok: false, message: 'Skill not found.' };
      const result = await uninstallSkillPath(skill.path);
      if (!result.ok) return result;
      clientRecord.skills = clientRecord.skills.filter((s) => s.id !== payload.skillId);
      if (!clientRecord.mcpInstalled && !clientRecord.hookInstalled && clientRecord.skills.length === 0) {
        registry.clients = registry.clients.filter((c) => c.client !== payload.client);
      }
      await saveRegistry(registry);
      return { ok: true, message: result.message };
    }

    return { ok: false, message: 'Unknown uninstall scope.' };
  }

  async function removeInstall(recordId: string): Promise<void> {
    const registry = await loadRegistry();
    for (const clientRecord of registry.clients) {
      const skill = clientRecord.skills.find((s) => s.id === recordId);
      if (skill) {
        await uninstall({ client: clientRecord.client, scope: 'skill', skillId: recordId });
        return;
      }
    }
  }

  async function dismissPostCertPrompt(): Promise<void> {
    const registry = await loadRegistry();
    registry.postCertPromptDismissed = true;
    await saveRegistry(registry);
  }

  async function ensureClientBasics(client: IntegrationClient): Promise<void> {
    await installMcpEntry(client);
    await installSessionEndHook(client);
  }

  return {
    loadRegistry,
    saveRegistry,
    getStatus,
    recordInstall,
    updateInstallRecord,
    updateAllInstalls,
    uninstall,
    removeInstall,
    dismissPostCertPrompt,
    ensureClientBasics,
  };
}

export type IntegrationRegistryService = ReturnType<typeof createIntegrationRegistry>;
