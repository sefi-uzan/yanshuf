import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
  // Workspace packages resolve to source; pre-bundling caches stale exports after changes.
  optimizeDeps: {
    exclude: ['@yanshuf/shared', '@yanshuf/ui'],
  },
});
