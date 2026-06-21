import { describe, expect, it } from 'vitest';
import {
  parseFilterPatterns,
  shouldCaptureUrl,
  shouldRecordCapture,
  urlMatchesPattern,
} from '@yanshuf/shared';

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

  it('excludes localhost when captureLocalhost is false', () => {
    const filter = { mode: 'exclude' as const, urls: '' };
    const opts = { captureLocalhost: false, proxyPort: 8888, mcpApiPort: 9473 };
    expect(
      shouldRecordCapture('http://127.0.0.1:3000/api', '127.0.0.1:3000', filter, opts),
    ).toBe(false);
    expect(
      shouldRecordCapture('https://example.com/', 'example.com', filter, opts),
    ).toBe(true);
  });

  it('always excludes self traffic on yanshuf ports', () => {
    const filter = { mode: 'exclude' as const, urls: '' };
    const opts = { captureLocalhost: true, proxyPort: 8888, mcpApiPort: 9473 };
    expect(
      shouldRecordCapture('http://127.0.0.1:8888/', '127.0.0.1:8888', filter, opts),
    ).toBe(false);
    expect(
      shouldRecordCapture('http://127.0.0.1:9473/status', '127.0.0.1:9473', filter, opts),
    ).toBe(false);
    expect(
      shouldRecordCapture('http://127.0.0.1:3000/', '127.0.0.1:3000', filter, opts),
    ).toBe(true);
  });
});
