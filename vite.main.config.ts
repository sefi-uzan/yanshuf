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
        // http-mitm-proxy → ws optional peer deps (bufferutil) break when bundled
        'http-mitm-proxy',
        'ws',
      ],
    },
  },
});
