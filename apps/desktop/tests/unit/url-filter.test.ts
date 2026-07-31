import { describe, expect, it } from 'vitest';
import {
  addHostToExclusions,
  hasRecordingExclusions,
  hostMatchesPattern,
  hostWithoutPort,
  parseFilterPatterns,
  shouldRecordCapture,
  shouldRecordHost,
} from '@yanshuf/shared';

describe('recording exclusions', () => {
  it('parses patterns from a list or the legacy semicolon string', () => {
    expect(parseFilterPatterns(['*.google.com', ' *.example.com '])).toEqual([
      '*.google.com',
      '*.example.com',
    ]);
    expect(parseFilterPatterns('*.google.com ; *.example.com')).toEqual([
      '*.google.com',
      '*.example.com',
    ]);
    expect(parseFilterPatterns([])).toEqual([]);
  });

  it('anchors host patterns to the whole host', () => {
    expect(hostMatchesPattern('www.google.com', '*.google.com')).toBe(true);
    expect(hostMatchesPattern('google.com', '*.google.com')).toBe(false);
    expect(hostMatchesPattern('bing.com', '*.google.com')).toBe(false);
    expect(hostMatchesPattern('api.example.com:443', 'api.example.com')).toBe(true);
  });

  it('does not let a lookalike host slip past an exclusion', () => {
    // The old substring globs matched anywhere in the URL, so this returned true.
    expect(hostMatchesPattern('notgoogle.com', '*.google.com')).toBe(false);
    expect(hostMatchesPattern('google.com.evil.net', '*.google.com')).toBe(false);
  });

  it('records everything when no exclusions are set', () => {
    expect(shouldRecordHost('any.test', [])).toBe(true);
  });

  it('drops hosts on the exclusion list', () => {
    const exclusions = ['*.analytics.com', 'telemetry.example.com'];
    expect(shouldRecordHost('cdn.analytics.com', exclusions)).toBe(false);
    expect(shouldRecordHost('telemetry.example.com', exclusions)).toBe(false);
    expect(shouldRecordHost('api.example.com', exclusions)).toBe(true);
  });

  it('excludes localhost when captureLocalhost is false', () => {
    const opts = { captureLocalhost: false, proxyPort: 8888, mcpApiPort: 9473 };
    expect(shouldRecordCapture('http://127.0.0.1:3000/api', '127.0.0.1:3000', [], opts)).toBe(
      false,
    );
    expect(shouldRecordCapture('https://example.com/', 'example.com', [], opts)).toBe(true);
  });

  it('always excludes self traffic on yanshuf ports', () => {
    const opts = { captureLocalhost: true, proxyPort: 8888, mcpApiPort: 9473 };
    expect(shouldRecordCapture('http://127.0.0.1:8888/', '127.0.0.1:8888', [], opts)).toBe(false);
    expect(shouldRecordCapture('http://127.0.0.1:9473/status', '127.0.0.1:9473', [], opts)).toBe(
      false,
    );
    expect(shouldRecordCapture('http://127.0.0.1:3000/', '127.0.0.1:3000', [], opts)).toBe(true);
  });

  it('detects whether any exclusion is configured', () => {
    expect(hasRecordingExclusions([])).toBe(false);
    expect(hasRecordingExclusions(['   '])).toBe(false);
    expect(hasRecordingExclusions(['*.example.com'])).toBe(true);
  });

  it('strips the port from a host', () => {
    expect(hostWithoutPort('api.example.com:443')).toBe('api.example.com');
    expect(hostWithoutPort('api.example.com')).toBe('api.example.com');
  });

  it('adds hosts to the exclusion list without duplicating', () => {
    expect(addHostToExclusions([], 'api.example.com:443')).toEqual(['api.example.com']);
    expect(addHostToExclusions(['*.api.com'], 'cdn.example.com')).toEqual([
      '*.api.com',
      'cdn.example.com',
    ]);
    expect(addHostToExclusions(['api.example.com'], 'api.example.com')).toEqual([
      'api.example.com',
    ]);
  });
});
