import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import type {
  IntegrationClient,
  IntegrationManifest,
  IntegrationStepResult,
  IntegrationVerifyParams,
  IntegrationVerifyResult,
  SkillInstallTarget,
} from '@yanshuf/shared';
import { getMcpDataDir } from './auth';
import { checkNodeOnPath } from './integration-prerequisites';

export type { IntegrationClient, IntegrationStepResult, IntegrationVerifyResult, SkillInstallTarget };

const DEFAULT_MANIFEST: IntegrationManifest = {
  bundleVersion: '0.0.0',
  skillContentHash: '',
  generatedAt: '',
};

function homePath(...segments: string[]): string {
  return path.join(os.homedir(), ...segments);
}

export function bundledMcpPaths(): {
  mcpEntry: string;
  skillsSource: string;
  cleanupSessionScript: string;
  manifestPath: string;
} {
  if (app.isPackaged) {
    const root = path.join(process.resourcesPath, 'mcp');
    return {
      mcpEntry: path.join(root, 'index.js'),
      skillsSource: path.join(root, 'skills', 'yanshuf'),
      cleanupSessionScript: path.join(root, 'scripts', 'cleanup-session.sh'),
      manifestPath: path.join(root, 'integration-manifest.json'),
    };
  }

  const monorepoRoot = path.resolve(app.getAppPath(), '..', '..');
  return {
    mcpEntry: path.join(monorepoRoot, 'apps', 'mcp', 'dist', 'index.js'),
    skillsSource: path.join(monorepoRoot, 'apps', 'mcp', 'skills', 'yanshuf'),
    cleanupSessionScript: path.join(monorepoRoot, 'apps', 'mcp', 'scripts', 'cleanup-session.sh'),
    manifestPath: path.join(monorepoRoot, 'apps', 'mcp', 'integration-manifest.json'),
  };
}

export function bundledIntegrationManifest(): IntegrationManifest {
  const { manifestPath } = bundledMcpPaths();
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8')) as IntegrationManifest;
  } catch {
    return DEFAULT_MANIFEST;
  }
}

export function getClientConfigPaths(client: IntegrationClient): {
  mcpConfig: string;
  hookConfig: string;
  mcpEntry: string;
  cleanupSessionScript: string;
} {
  const { mcpEntry, cleanupSessionScript } = bundledMcpPaths();
  if (client === 'cursor') {
    return {
      mcpConfig: homePath('.cursor', 'mcp.json'),
      hookConfig: homePath('.cursor', 'hooks.json'),
      mcpEntry,
      cleanupSessionScript,
    };
  }
  return {
    mcpConfig: homePath('.claude', 'settings.json'),
    hookConfig: homePath('.claude', 'settings.json'),
    mcpEntry,
    cleanupSessionScript,
  };
}

export async function detectMcpConfigured(client: IntegrationClient): Promise<boolean> {
  if (client === 'cursor') {
    const config = await readJsonFile<{ mcpServers?: Record<string, { args?: string[] }> }>(
      homePath('.cursor', 'mcp.json'),
    );
    return Boolean(config?.mcpServers?.yanshuf?.args?.some((arg) => arg.includes('index.js')));
  }
  const config = await readJsonFile<{ mcpServers?: Record<string, { args?: string[] }> }>(
    homePath('.claude', 'settings.json'),
  );
  return Boolean(config?.mcpServers?.yanshuf?.args?.some((arg) => arg.includes('index.js')));
}

export async function detectHookConfigured(client: IntegrationClient): Promise<boolean> {
  if (client === 'cursor') {
    const hooks = await readJsonFile<{ hooks?: { sessionEnd?: { command?: string }[] } }>(
      homePath('.cursor', 'hooks.json'),
    );
    return Boolean(hooks?.hooks?.sessionEnd?.some((h) => isYanshufHook(h.command)));
  }
  const hooks = await readJsonFile<{ hooks?: { SessionEnd?: { command?: string }[] } }>(
    homePath('.claude', 'settings.json'),
  );
  return Boolean(hooks?.hooks?.SessionEnd?.some((h) => isYanshufHook(h.command)));
}

export async function detectSkillConfigured(skillPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(skillPath, 'SKILL.md'));
    return true;
  } catch {
    return false;
  }
}

async function removeDirRecursive(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

export async function uninstallMcpEntry(client: IntegrationClient): Promise<IntegrationStepResult> {
  if (client === 'cursor') {
    const configPath = homePath('.cursor', 'mcp.json');
    const existing = await readJsonFile<{ mcpServers?: Record<string, unknown> }>(configPath);
    if (!existing?.mcpServers?.yanshuf) {
      return { ok: true, message: 'MCP entry not present in Cursor config.' };
    }
    const { yanshuf: _, ...rest } = existing.mcpServers;
    existing.mcpServers = rest;
    await writeJsonFile(configPath, existing);
    return { ok: true, message: 'Removed yanshuf MCP server from Cursor.', path: configPath };
  }

  const configPath = homePath('.claude', 'settings.json');
  const existing = await readJsonFile<{ mcpServers?: Record<string, unknown> }>(configPath);
  if (!existing?.mcpServers?.yanshuf) {
    return { ok: true, message: 'MCP entry not present in Claude Code config.' };
  }
  const { yanshuf: _, ...rest } = existing.mcpServers;
  existing.mcpServers = rest;
  await writeJsonFile(configPath, existing);
  return { ok: true, message: 'Removed yanshuf MCP server from Claude Code.', path: configPath };
}

export async function uninstallSessionEndHook(client: IntegrationClient): Promise<IntegrationStepResult> {
  if (client === 'cursor') {
    const configPath = homePath('.cursor', 'hooks.json');
    const existing = await readJsonFile<{ hooks?: Record<string, unknown[]> }>(configPath);
    if (!existing?.hooks?.sessionEnd) {
      return { ok: true, message: 'SessionEnd hook not present in Cursor config.' };
    }
    const sessionEnd = (existing.hooks.sessionEnd ?? []).filter(
      (h) => !(typeof h === 'object' && h && 'command' in h && isYanshufHook(String(h.command))),
    );
    existing.hooks.sessionEnd = sessionEnd;
    await writeJsonFile(configPath, existing);
    return { ok: true, message: 'Removed sessionEnd hook from Cursor.', path: configPath };
  }

  const configPath = homePath('.claude', 'settings.json');
  const existing = await readJsonFile<{ hooks?: Record<string, unknown[]> }>(configPath);
  if (!existing?.hooks?.SessionEnd) {
    return { ok: true, message: 'SessionEnd hook not present in Claude Code config.' };
  }
  const sessionEnd = (existing.hooks.SessionEnd ?? []).filter(
    (h) => !(typeof h === 'object' && h && 'command' in h && isYanshufHook(String(h.command))),
  );
  existing.hooks.SessionEnd = sessionEnd;
  await writeJsonFile(configPath, existing);
  return { ok: true, message: 'Removed SessionEnd hook from Claude Code.', path: configPath };
}

export async function uninstallSkillPath(skillPath: string): Promise<IntegrationStepResult> {
  try {
    await removeDirRecursive(skillPath);
    return { ok: true, message: `Removed skill at ${skillPath}`, path: skillPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Failed to remove skill at ${skillPath}: ${message}` };
  }
}

export function skillDestination(client: IntegrationClient, target: SkillInstallTarget): string {
  if (target.kind === 'personal') {
    return client === 'cursor'
      ? homePath('.cursor', 'skills', 'yanshuf')
      : homePath('.claude', 'skills', 'yanshuf');
  }
  return client === 'cursor'
    ? path.join(target.repoRoot, '.cursor', 'skills', 'yanshuf')
    : path.join(target.repoRoot, '.claude', 'skills', 'yanshuf');
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

export async function installMcpEntry(client: IntegrationClient): Promise<IntegrationStepResult> {
  const { mcpEntry } = bundledMcpPaths();
  try {
    await fs.access(mcpEntry);
  } catch {
    return { ok: false, message: `MCP entry not found at ${mcpEntry}. Build apps/mcp first.` };
  }

  if (client === 'cursor') {
    const configPath = homePath('.cursor', 'mcp.json');
    const existing = (await readJsonFile<{ mcpServers?: Record<string, unknown> }>(configPath)) ?? {};
    existing.mcpServers = {
      ...existing.mcpServers,
      yanshuf: { command: 'node', args: [mcpEntry] },
    };
    await writeJsonFile(configPath, existing);
    return { ok: true, message: 'Added yanshuf MCP server to Cursor.', path: configPath };
  }

  const configPath = homePath('.claude', 'settings.json');
  const existing =
    (await readJsonFile<{ mcpServers?: Record<string, unknown> }>(configPath)) ?? {};
  existing.mcpServers = {
    ...existing.mcpServers,
    yanshuf: { command: 'node', args: [mcpEntry] },
  };
  await writeJsonFile(configPath, existing);
  return { ok: true, message: 'Added yanshuf MCP server to Claude Code.', path: configPath };
}

export async function updateMcpEntryPath(
  client: IntegrationClient,
  mcpEntry: string,
): Promise<IntegrationStepResult> {
  return installMcpEntry(client);
}

export async function installSkill(
  client: IntegrationClient,
  target: SkillInstallTarget,
): Promise<IntegrationStepResult> {
  const { skillsSource } = bundledMcpPaths();
  try {
    await fs.access(path.join(skillsSource, 'SKILL.md'));
  } catch {
    return { ok: false, message: `Skill source not found at ${skillsSource}` };
  }

  const dest = skillDestination(client, target);
  await copyDirRecursive(skillsSource, dest);
  return { ok: true, message: `Installed /yanshuf skill to ${dest}`, path: dest };
}

function isYanshufHook(command: string | undefined): boolean {
  return Boolean(command?.includes('cleanup-session'));
}

export async function installSessionEndHook(client: IntegrationClient): Promise<IntegrationStepResult> {
  const { cleanupSessionScript } = bundledMcpPaths();
  try {
    await fs.access(cleanupSessionScript);
  } catch {
    return { ok: false, message: `Cleanup session script not found at ${cleanupSessionScript}` };
  }

  if (client === 'cursor') {
    const configPath = homePath('.cursor', 'hooks.json');
    const existing = (await readJsonFile<{ hooks?: Record<string, unknown[]> }>(configPath)) ?? {};
    const hooks = existing.hooks ?? {};
    const sessionEnd = Array.isArray(hooks.sessionEnd) ? [...hooks.sessionEnd] : [];
    const idx = sessionEnd.findIndex(
      (h) => typeof h === 'object' && h && 'command' in h && isYanshufHook(String(h.command)),
    );
    const entry = { command: cleanupSessionScript };
    if (idx >= 0) {
      sessionEnd[idx] = entry;
    } else {
      sessionEnd.push(entry);
    }
    hooks.sessionEnd = sessionEnd;
    existing.hooks = hooks;
    await writeJsonFile(configPath, existing);
    return { ok: true, message: 'Added sessionEnd hook to Cursor.', path: configPath };
  }

  const configPath = homePath('.claude', 'settings.json');
  const existing =
    (await readJsonFile<{ hooks?: Record<string, unknown[]> }>(configPath)) ?? {};
  const hooks = existing.hooks ?? {};
  const sessionEnd = Array.isArray(hooks.SessionEnd) ? [...hooks.SessionEnd] : [];
  const idx = sessionEnd.findIndex(
    (h) => typeof h === 'object' && h && 'command' in h && isYanshufHook(String(h.command)),
  );
  const entry = { command: cleanupSessionScript };
  if (idx >= 0) {
    sessionEnd[idx] = entry;
  } else {
    sessionEnd.push(entry);
  }
  hooks.SessionEnd = sessionEnd;
  existing.hooks = hooks;
  await writeJsonFile(configPath, existing);
  return { ok: true, message: 'Added SessionEnd hook to Claude Code.', path: configPath };
}

export async function updateHookPath(
  client: IntegrationClient,
  cleanupSessionScript: string,
): Promise<IntegrationStepResult> {
  return installSessionEndHook(client);
}

export async function installIntegration(
  client: IntegrationClient,
  target: SkillInstallTarget,
): Promise<{ mcp: IntegrationStepResult; skill: IntegrationStepResult; hook: IntegrationStepResult }> {
  const mcp = await installMcpEntry(client);
  const skill = await installSkill(client, target);
  const hook = await installSessionEndHook(client);
  return { mcp, skill, hook };
}

export async function verifyIntegration(
  client: IntegrationClient,
  params: IntegrationVerifyParams,
  apiReachable: boolean,
  certTrusted: boolean,
): Promise<IntegrationVerifyResult> {
  const { cleanupSessionScript } = bundledMcpPaths();
  const details: string[] = [];
  const nodeCheck = await checkNodeOnPath();

  let mcpConfigured = false;
  if (client === 'cursor') {
    const config = await readJsonFile<{ mcpServers?: Record<string, { args?: string[] }> }>(
      homePath('.cursor', 'mcp.json'),
    );
    mcpConfigured = Boolean(
      config?.mcpServers?.yanshuf?.args?.some((arg) => arg.includes('index.js')),
    );
  } else {
    const config = await readJsonFile<{ mcpServers?: Record<string, { args?: string[] }> }>(
      homePath('.claude', 'settings.json'),
    );
    mcpConfigured = Boolean(
      config?.mcpServers?.yanshuf?.args?.some((arg) => arg.includes('index.js')),
    );
  }
  if (!mcpConfigured) details.push('MCP entry not configured or path mismatch.');

  const skillChecks: boolean[] = [];
  if (params.personalSkill) {
    const skillPath = path.join(skillDestination(client, { kind: 'personal' }), 'SKILL.md');
    try {
      await fs.access(skillPath);
      skillChecks.push(true);
    } catch {
      skillChecks.push(false);
      details.push(`Personal skill not found at ${skillPath}`);
    }
  }
  for (const repoRoot of params.projectRoots) {
    const skillPath = path.join(
      skillDestination(client, { kind: 'project', repoRoot }),
      'SKILL.md',
    );
    try {
      await fs.access(skillPath);
      skillChecks.push(true);
    } catch {
      skillChecks.push(false);
      details.push(`Project skill not found at ${skillPath}`);
    }
  }
  const skillInstalled =
    skillChecks.length === 0 ? true : skillChecks.every(Boolean);

  let hookInstalled = false;
  if (client === 'cursor') {
    const hooks = await readJsonFile<{ hooks?: { sessionEnd?: { command?: string }[] } }>(
      homePath('.cursor', 'hooks.json'),
    );
    hookInstalled = Boolean(
      hooks?.hooks?.sessionEnd?.some((h) => isYanshufHook(h.command)),
    );
  } else {
    const hooks = await readJsonFile<{ hooks?: { SessionEnd?: { command?: string }[] } }>(
      homePath('.claude', 'settings.json'),
    );
    hookInstalled = Boolean(
      hooks?.hooks?.SessionEnd?.some((h) => isYanshufHook(h.command)),
    );
  }
  if (!hookInstalled) details.push('SessionEnd hook not configured.');

  try {
    await fs.access(cleanupSessionScript);
  } catch {
    details.push(`Cleanup session script missing at ${cleanupSessionScript}`);
  }

  if (!nodeCheck.ok) {
    details.push(nodeCheck.message ?? 'Node.js not available on PATH.');
  }
  if (!apiReachable) details.push('Yanshuf MCP HTTP API is not reachable.');
  if (!certTrusted) details.push('Certificate is not trusted — complete setup in Yanshuf settings.');

  return {
    mcpConfigured,
    skillInstalled,
    hookInstalled,
    apiReachable,
    certTrusted,
    nodeOk: nodeCheck.ok,
    nodeVersion: nodeCheck.version,
    details,
  };
}

export function getMcpTokenPath(userDataPath: string): string {
  return path.join(getMcpDataDir(userDataPath), 'token.json');
}
