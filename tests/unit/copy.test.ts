import { describe, expect, it } from 'vitest';
import { urlFromMatchRegex } from '../../src/renderer/lib/copy';

describe('urlFromMatchRegex', () => {
  it('unescapes exact URL regex from captured rules', () => {
    expect(urlFromMatchRegex('https://api\\.example\\.com/v1/users\\?id=1')).toBe(
      'https://api.example.com/v1/users?id=1',
    );
  });

  it('returns empty string for empty input', () => {
    expect(urlFromMatchRegex('')).toBe('');
  });
});
