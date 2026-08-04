import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const sharedSrc = path.resolve(__dirname, '../../packages/shared/src');
const uiSrc = path.resolve(__dirname, '../../packages/ui/src');

export default defineConfig({
  plugins: [react()],
  // Every workspace package must be aliased to its source. Resolved through the
  // node_modules symlink instead, Vite treats it as a dependency: the dev server
  // stamps `?v=<hash>` on it and serves it `immutable`, and that hash only moves
  // when dependencies change. Editing the package then leaves the renderer
  // replaying the pre-edit module from its HTTP cache, so a newly added export
  // is missing at runtime while typecheck still passes against source.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@yanshuf/shared/capture-to-rule': path.join(sharedSrc, 'capture-to-rule.ts'),
      '@yanshuf/shared': path.join(sharedSrc, 'index.ts'),
      '@yanshuf/ui/lib/utils': path.join(uiSrc, 'lib/utils.ts'),
      '@yanshuf/ui': path.join(uiSrc, 'index.ts'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
  },
  // Workspace packages resolve to source; pre-bundling caches stale exports after changes.
  optimizeDeps: {
    exclude: ['@yanshuf/shared', '@yanshuf/ui'],
  },
});
