import fs from 'node:fs';
import path from 'node:path';

/**
 * Copy MCP server bundle, skills, and hook scripts into the packaged app Resources.
 */
export function copyMcpBundle(buildPath: string, desktopRoot: string): void {
  const monorepoRoot = path.resolve(desktopRoot, '..', '..');
  const mcpRoot = path.join(monorepoRoot, 'apps', 'mcp');
  const dest = path.join(buildPath, 'mcp');

  fs.mkdirSync(dest, { recursive: true });

  const distSrc = path.join(mcpRoot, 'dist');
  const distDest = path.join(dest, 'dist');
  if (fs.existsSync(distSrc)) {
    copyRecursive(distSrc, distDest);
    // Entry point at mcp/index.js for simpler config paths
    const indexSrc = path.join(distDest, 'index.js');
    if (fs.existsSync(indexSrc)) {
      fs.copyFileSync(indexSrc, path.join(dest, 'index.js'));
    }
  }

  copyRecursive(path.join(mcpRoot, 'skills'), path.join(dest, 'skills'));
  copyRecursive(path.join(mcpRoot, 'scripts'), path.join(dest, 'scripts'));
}

function copyRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      if (entry.name.endsWith('.sh')) {
        fs.chmodSync(destPath, 0o755);
      }
    }
  }
}
