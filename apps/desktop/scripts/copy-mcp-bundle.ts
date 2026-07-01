import fs from 'node:fs';
import path from 'node:path';

/** Resolve Contents/Resources for an electron-forge output path (dir or .app). */
export function packagedResourcesDir(outputPath: string): string {
  if (outputPath.endsWith('.app')) {
    return path.join(outputPath, 'Contents', 'Resources');
  }

  const appBundle = fs
    .readdirSync(outputPath, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.endsWith('.app'));
  if (appBundle) {
    return path.join(outputPath, appBundle.name, 'Contents', 'Resources');
  }

  return path.join(outputPath, 'Contents', 'Resources');
}

/**
 * Copy MCP server bundle, skills, and hook scripts into Contents/Resources/mcp
 * so Cursor/Claude Code can launch them with plain `node` (asar paths do not work).
 */
export function copyMcpBundle(resourcesPath: string, desktopRoot: string): void {
  const monorepoRoot = path.resolve(desktopRoot, '..', '..');
  const mcpRoot = path.join(monorepoRoot, 'apps', 'mcp');
  const dest = path.join(resourcesPath, 'mcp');

  const distSrc = path.join(mcpRoot, 'dist');
  const distDest = path.join(dest, 'dist');
  if (!fs.existsSync(distSrc)) {
    throw new Error(
      `MCP dist not found at ${distSrc}. Run \`pnpm --filter @yanshuf/mcp build\` before packaging.`,
    );
  }
  copyRecursive(distSrc, distDest);
  const indexSrc = path.join(distDest, 'index.js');
  if (!fs.existsSync(indexSrc)) {
    throw new Error(`MCP entry not found at ${indexSrc} after copy.`);
  }
  fs.copyFileSync(indexSrc, path.join(dest, 'index.js'));

  copyRecursive(path.join(mcpRoot, 'skills'), path.join(dest, 'skills'));
  copyRecursive(path.join(mcpRoot, 'scripts'), path.join(dest, 'scripts'));
  const manifestSrc = path.join(mcpRoot, 'integration-manifest.json');
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, path.join(dest, 'integration-manifest.json'));
  }
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
