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
      external: ['electron', 'http-mitm-proxy', 'node-forge', 'undici', 'electron-squirrel-startup'],
    },
  },
});
