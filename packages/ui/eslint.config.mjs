import react from '@yanshuf/eslint-config/react';

export default [
  ...react,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
