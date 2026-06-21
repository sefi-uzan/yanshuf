import { execFileSync } from 'node:child_process';

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

function readLoginShellPath(): string | undefined {
  const shell = process.env.SHELL ?? '/bin/zsh';
  try {
    const stdout = execFileSync(shell, ['-l', '-c', 'printf %s "$PATH"'], {
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
    readLoginShellPath(),
    readPathHelperPath(),
    MACOS_NODE_PATH_FALLBACKS.join(':'),
    process.env.PATH,
  );
}
