import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        'electron',
        // Bundled by Vite breaks ws optional native peers; copied at pack time via scripts/copy-main-externals.ts
        'http-mitm-proxy',
        'ws',
      ],
    },
  },
});
