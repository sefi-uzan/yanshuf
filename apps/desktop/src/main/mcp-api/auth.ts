import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { McpConfig, McpTokenFile } from '@yanshuf/shared';
import { MCP_DEFAULT_PORT } from '@yanshuf/shared';

export function getMcpDataDir(userDataPath: string): string {
  return path.join(userDataPath, 'data', 'mcp');
}

export async function ensureMcpAuth(userDataPath: string): Promise<{ token: string; config: McpConfig }> {
  const dir = getMcpDataDir(userDataPath);
  await fs.mkdir(dir, { recursive: true });

  const tokenPath = path.join(dir, 'token.json');
  const configPath = path.join(dir, 'config.json');

  let token: string;
  try {
    const raw = await fs.readFile(tokenPath, 'utf8');
    token = (JSON.parse(raw) as McpTokenFile).token;
  } catch {
    token = randomBytes(32).toString('hex');
    await fs.writeFile(tokenPath, JSON.stringify({ token } satisfies McpTokenFile, null, 2));
  }

  let config: McpConfig;
  try {
    config = JSON.parse(await fs.readFile(configPath, 'utf8')) as McpConfig;
  } catch {
    config = { port: MCP_DEFAULT_PORT };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  return { token, config };
}

export function readBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim() || null;
}
