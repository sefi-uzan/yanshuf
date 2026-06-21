import * as esbuild from 'esbuild';
import { chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
spawnSync(process.execPath, [path.join(__dirname, 'generate-manifest.mjs')], { stdio: 'inherit' });

await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
});

chmodSync('dist/index.js', 0o755);
console.log('Built apps/mcp/dist/index.js');
