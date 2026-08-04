import electron from '@yanshuf/eslint-config/electron';

export default [
  {
    ignores: [
      'dist/**',
      'out/**',
      '.vite/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'eslint.config.mjs',
      'tailwind.config.js',
      'postcss.config.js',
      'forge.config.ts',
    ],
  },
  ...electron,
];
