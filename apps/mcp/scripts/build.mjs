import * as esbuild from 'esbuild';
import { chmodSync } from 'node:fs';

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
