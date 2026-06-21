import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('bundled MCP entry', () => {
  it('does not import @yanshuf/shared at runtime', () => {
    const entry = readFileSync(path.join(__dirname, '../dist/index.js'), 'utf8');
    expect(entry).not.toContain('@yanshuf/shared');
    expect(entry).toContain('McpServer');
  });
});
