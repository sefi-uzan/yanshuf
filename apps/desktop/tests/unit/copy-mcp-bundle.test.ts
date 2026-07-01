import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyMcpBundle, packagedResourcesDir } from '../../scripts/copy-mcp-bundle';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('copy-mcp-bundle', () => {
  it('maps a macOS app bundle to Contents/Resources', () => {
    expect(packagedResourcesDir('/tmp/Yanshuf.app')).toBe('/tmp/Yanshuf.app/Contents/Resources');
  });

  it('finds .app inside an electron-forge output directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yanshuf-out-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, 'Yanshuf.app', 'Contents', 'Resources'), { recursive: true });
    expect(packagedResourcesDir(root)).toBe(
      path.join(root, 'Yanshuf.app', 'Contents', 'Resources'),
    );
  });

  it('copies MCP entry to Resources/mcp/index.js', () => {
    const resourcesPath = fs.mkdtempSync(path.join(os.tmpdir(), 'yanshuf-resources-'));
    tempDirs.push(resourcesPath);

    copyMcpBundle(resourcesPath, path.resolve(__dirname, '../..'));

    const entry = path.join(resourcesPath, 'mcp', 'index.js');
    expect(fs.existsSync(entry)).toBe(true);
    expect(fs.statSync(entry).size).toBeGreaterThan(0);
  });
});
