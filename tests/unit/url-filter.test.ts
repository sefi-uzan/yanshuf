import { describe, expect, it } from 'vitest';
import {
  parseFilterPatterns,
  shouldCaptureUrl,
  urlMatchesPattern,
} from '../../src/shared/url-filter';

describe('url-filter', () => {
  it('parses semicolon-separated patterns', () => {
    expect(parseFilterPatterns('*.google.com ; *.example.com')).toEqual([
      '*.google.com',
      '*.example.com',
    ]);
    expect(parseFilterPatterns('')).toEqual([]);
  });

  it('matches wildcard URL patterns', () => {
    expect(urlMatchesPattern('https://www.google.com/search', '*.google.com')).toBe(true);
    expect(urlMatchesPattern('https://bing.com/', '*.google.com')).toBe(false);
    expect(urlMatchesPattern('https://example.com/api/v1', '*/api/*')).toBe(true);
  });

  it('includes only matching URLs in include mode', () => {
    const filter = { mode: 'include' as const, urls: '*.google.com;*.example.com' };
    expect(shouldCaptureUrl('https://www.google.com/', filter)).toBe(true);
    expect(shouldCaptureUrl('https://api.example.com/x', filter)).toBe(true);
    expect(shouldCaptureUrl('https://bing.com/', filter)).toBe(false);
  });

  it('excludes matching URLs in exclude mode', () => {
    const filter = { mode: 'exclude' as const, urls: '*.google.com' };
    expect(shouldCaptureUrl('https://www.google.com/', filter)).toBe(false);
    expect(shouldCaptureUrl('https://bing.com/', filter)).toBe(true);
  });

  it('captures everything when no patterns are set', () => {
    expect(shouldCaptureUrl('https://any.test/', { mode: 'include', urls: '' })).toBe(true);
    expect(shouldCaptureUrl('https://any.test/', { mode: 'exclude', urls: '' })).toBe(true);
  });
});
