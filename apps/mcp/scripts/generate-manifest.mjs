import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcpRoot = path.resolve(__dirname, '..');
const skillsDir = path.join(mcpRoot, 'skills', 'yanshuf');

async function hashDir(dir) {
  const hash = createHash('sha256');
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      hash.update(entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        hash.update(await readFile(full));
      }
    }
  }
  await walk(dir);
  return `sha256:${hash.digest('hex')}`;
}

const skillContentHash = await hashDir(skillsDir);
const manifest = {
  bundleVersion: '1.0.0',
  skillContentHash,
  generatedAt: new Date().toISOString(),
};

await writeFile(
  path.join(mcpRoot, 'integration-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log('Generated integration-manifest.json');
