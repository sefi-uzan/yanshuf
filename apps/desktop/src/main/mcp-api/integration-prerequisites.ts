import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IntegrationPrerequisites } from '@yanshuf/shared';
import { INTEGRATION_MIN_NODE_VERSION } from '@yanshuf/shared';

const execFileAsync = promisify(execFile);

function parseNodeVersion(raw: string): string {
  return raw.trim().replace(/^v/, '');
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkNodeOnPath(): Promise<IntegrationPrerequisites['node']> {
  try {
    const { stdout } = await execFileAsync('node', ['-v'], { env: process.env });
    const version = parseNodeVersion(stdout);
    const ok = compareSemver(version, INTEGRATION_MIN_NODE_VERSION) >= 0;
    return {
      ok,
      version: stdout.trim(),
      message: ok
        ? undefined
        : `Node ${INTEGRATION_MIN_NODE_VERSION} or later required (found ${stdout.trim()}). Install from nodejs.org or use nvm.`,
    };
  } catch {
    return {
      ok: false,
      message: `Node.js not found on PATH. Install Node ${INTEGRATION_MIN_NODE_VERSION}+ from nodejs.org or use nvm.`,
    };
  }
}

export async function checkPrerequisites(certTrusted: boolean): Promise<IntegrationPrerequisites> {
  const node = await checkNodeOnPath();
  const cert = {
    ok: certTrusted,
    message: certTrusted
      ? undefined
      : 'Certificate not trusted — HTTPS capture may fail until you complete setup in Settings → Certificate.',
  };
  return {
    node,
    cert,
    allMet: node.ok && cert.ok,
  };
}
