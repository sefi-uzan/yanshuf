import base from '@yanshuf/eslint-config/base';

export default [
  ...base,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
