import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyMcpBundle, stagedResourcesDir } from '../../scripts/copy-mcp-bundle';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('copy-mcp-bundle', () => {
  it('maps the packager afterCopy build path to Contents/Resources', () => {
    expect(stagedResourcesDir('/tmp/staging/Electron.app/Contents/Resources/app')).toBe(
      '/tmp/staging/Electron.app/Contents/Resources',
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
