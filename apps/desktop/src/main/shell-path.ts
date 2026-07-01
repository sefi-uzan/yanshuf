import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MACOS_NODE_PATH_FALLBACKS = ['/opt/homebrew/bin', '/usr/local/bin'];

/** Merge PATH segments left-to-right, keeping the first occurrence of each directory. */
export function mergePathSegments(...pathStrings: (string | undefined)[]): string {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const pathString of pathStrings) {
    if (!pathString) continue;
    for (const segment of pathString.split(':')) {
      if (segment && !seen.has(segment)) {
        seen.add(segment);
        ordered.push(segment);
      }
    }
  }

  return ordered.join(':');
}

function readShellPath(flags: string[]): string | undefined {
  const shell = process.env.SHELL ?? '/bin/zsh';
  try {
    const stdout = execFileSync(shell, [...flags, '-c', 'printf %s "$PATH"'], {
      encoding: 'utf8',
      timeout: 5_000,
      env: process.env,
    });
    const trimmed = stdout.trim();
    return trimmed || undefined;
  } catch {
    return undefined;
  }
}

function readLoginShellPath(): string | undefined {
  return readShellPath(['-l']);
}

/** nvm and similar tools often initialize in .zshrc, which login shells skip. */
function readInteractiveShellPath(): string | undefined {
  return readShellPath(['-l', '-i']);
}

function readPathHelperPath(): string | undefined {
  try {
    const stdout = execFileSync('/usr/libexec/path_helper', ['-s'], {
      encoding: 'utf8',
      timeout: 5_000,
    });
    const match = stdout.match(/PATH="([^"]+)"/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

/**
 * GUI-launched macOS apps inherit a minimal PATH. Merge login-shell and common
 * tool locations so prerequisite checks and child processes can find node, etc.
 */
export function augmentProcessPath(): void {
  if (process.platform !== 'darwin') return;

  process.env.PATH = mergePathSegments(
    readInteractiveShellPath(),
    readLoginShellPath(),
    readPathHelperPath(),
    MACOS_NODE_PATH_FALLBACKS.join(':'),
    resolveNvmBinDir(),
    process.env.PATH,
  );
}

function resolveNvmBinDir(): string | undefined {
  const nvmHome = process.env.NVM_DIR ?? path.join(os.homedir(), '.nvm');
  const versionsDir = path.join(nvmHome, 'versions', 'node');
  if (!fs.existsSync(versionsDir)) return undefined;

  const versionDirs = fs
    .readdirSync(versionsDir)
    .filter((entry) => entry.startsWith('v'))
    .sort((a, b) => compareSemver(b.slice(1), a.slice(1)));

  for (const versionDir of versionDirs) {
    const binDir = path.join(versionsDir, versionDir, 'bin');
    if (fs.existsSync(path.join(binDir, 'node'))) {
      return binDir;
    }
  }

  return undefined;
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

function resolveViaShell(name: string): string | undefined {
  const shell = process.env.SHELL ?? '/bin/zsh';
  for (const flags of [['-l', '-i'], ['-l']] as const) {
    try {
      const stdout = execFileSync(shell, [...flags, '-c', `command -v ${name}`], {
        encoding: 'utf8',
        timeout: 5_000,
        env: process.env,
      }).trim();
      if (stdout) return stdout;
    } catch {
      // try next shell mode
    }
  }
  return undefined;
}

/** Resolve an executable after augmentProcessPath() has run. */
export function resolveExecutable(name: string): string | undefined {
  const fromShell = resolveViaShell(name);
  if (fromShell) return fromShell;

  if (name !== 'node' || process.platform !== 'darwin') return undefined;

  for (const dir of MACOS_NODE_PATH_FALLBACKS) {
    const candidate = path.join(dir, 'node');
    if (fs.existsSync(candidate)) return candidate;
  }

  const nvmBin = resolveNvmBinDir();
  if (nvmBin) {
    const candidate = path.join(nvmBin, 'node');
    if (fs.existsSync(candidate)) return candidate;
  }

  return undefined;
}
