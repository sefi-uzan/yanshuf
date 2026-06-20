import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const sharedSrc = path.resolve(__dirname, '../../packages/shared/src');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@yanshuf/shared/capture-to-rule': path.join(sharedSrc, 'capture-to-rule.ts'),
      '@yanshuf/shared': path.join(sharedSrc, 'index.ts'),
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
