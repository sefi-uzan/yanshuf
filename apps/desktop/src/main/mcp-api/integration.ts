import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { getMcpDataDir } from './auth';

export type IntegrationClient = 'cursor' | 'claude-code';

export type SkillInstallTarget =
  | { kind: 'personal' }
  | { kind: 'project'; repoRoot: string };

export interface IntegrationStepResult {
  ok: boolean;
  message: string;
  path?: string;
}

export interface IntegrationVerifyResult {
  mcpConfigured: boolean;
  skillInstalled: boolean;
  hookInstalled: boolean;
  apiReachable: boolean;
  certTrusted: boolean;
  details: string[];
}

function homePath(...segments: string[]): string {
  return path.join(os.homedir(), ...segments);
}

export function bundledMcpPaths(): {
  mcpEntry: string;
  skillsSource: string;
  cleanupSessionScript: string;
} {
  if (app.isPackaged) {
    const root = path.join(process.resourcesPath, 'mcp');
    return {
      mcpEntry: path.join(root, 'index.js'),
      skillsSource: path.join(root, 'skills', 'yanshuf'),
      cleanupSessionScript: path.join(root, 'scripts', 'cleanup-session.sh'),
    };
  }

  const monorepoRoot = path.resolve(app.getAppPath(), '..', '..');
  return {
    mcpEntry: path.join(monorepoRoot, 'apps', 'mcp', 'dist', 'index.js'),
    skillsSource: path.join(monorepoRoot, 'apps', 'mcp', 'skills', 'yanshuf'),
    cleanupSessionScript: path.join(monorepoRoot, 'apps', 'mcp', 'scripts', 'cleanup-session.sh'),
  };
}

function skillDestination(client: IntegrationClient, target: SkillInstallTarget): string {
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
    const already = sessionEnd.some(
      (h) => typeof h === 'object' && h && 'command' in h && String(h.command).includes('cleanup-session'),
    );
    if (!already) {
      sessionEnd.push({ command: cleanupSessionScript });
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
  const already = sessionEnd.some(
    (h) => typeof h === 'object' && h && 'command' in h && String(h.command).includes('cleanup-session'),
  );
  if (!already) {
    sessionEnd.push({ command: cleanupSessionScript });
  }
  hooks.SessionEnd = sessionEnd;
  existing.hooks = hooks;
  await writeJsonFile(configPath, existing);
  return { ok: true, message: 'Added SessionEnd hook to Claude Code.', path: configPath };
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
  target: SkillInstallTarget,
  apiReachable: boolean,
  certTrusted: boolean,
): Promise<IntegrationVerifyResult> {
  const { mcpEntry, cleanupSessionScript } = bundledMcpPaths();
  const details: string[] = [];

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

  const skillPath = path.join(skillDestination(client, target), 'SKILL.md');
  let skillInstalled = false;
  try {
    await fs.access(skillPath);
    skillInstalled = true;
  } catch {
    details.push(`Skill not found at ${skillPath}`);
  }

  let hookInstalled = false;
  if (client === 'cursor') {
    const hooks = await readJsonFile<{ hooks?: { sessionEnd?: { command?: string }[] } }>(
      homePath('.cursor', 'hooks.json'),
    );
    hookInstalled = Boolean(
      hooks?.hooks?.sessionEnd?.some((h) => h.command?.includes('cleanup-session')),
    );
  } else {
    const hooks = await readJsonFile<{ hooks?: { SessionEnd?: { command?: string }[] } }>(
      homePath('.claude', 'settings.json'),
    );
    hookInstalled = Boolean(
      hooks?.hooks?.SessionEnd?.some((h) => h.command?.includes('cleanup-session')),
    );
  }
  if (!hookInstalled) details.push('SessionEnd hook not configured.');

  try {
    await fs.access(cleanupSessionScript);
  } catch {
    details.push(`Cleanup session script missing at ${cleanupSessionScript}`);
  }

  if (!apiReachable) details.push('Yanshuf MCP HTTP API is not reachable.');
  if (!certTrusted) details.push('Certificate is not trusted — complete setup in Yanshuf settings.');

  return {
    mcpConfigured,
    skillInstalled,
    hookInstalled,
    apiReachable,
    certTrusted,
    details,
  };
}

export function getMcpTokenPath(userDataPath: string): string {
  return path.join(getMcpDataDir(userDataPath), 'token.json');
}
