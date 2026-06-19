import { describe, expect, it } from 'vitest';
import { urlFromMatchRegex, urlWithoutQuery } from '../../src/renderer/lib/copy';

describe('urlWithoutQuery', () => {
  it('strips query string from a URL', () => {
    expect(urlWithoutQuery('https://api.example.com/v1/users?id=1&sort=asc')).toBe(
      'https://api.example.com/v1/users',
    );
  });

  it('strips hash fragments', () => {
    expect(urlWithoutQuery('https://example.com/page#section')).toBe('https://example.com/page');
  });
});

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
