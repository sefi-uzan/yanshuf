import { describe, expect, it } from 'vitest';
import {
  addHostToScope,
  hostMatchesPattern,
  hostWithoutPort,
  isRecordingScopeActive,
  normalizeRecordingScope,
  parseFilterPatterns,
  shouldRecordCapture,
  shouldRecordHost,
  type RecordingScope,
} from '@yanshuf/shared';

const exclude = (...patterns: string[]): RecordingScope => ({ mode: 'exclude', patterns });
const include = (...patterns: string[]): RecordingScope => ({ mode: 'include', patterns });

describe('recording scope', () => {
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

  it('records everything when no patterns are set, in either mode', () => {
    expect(shouldRecordHost('any.test', exclude())).toBe(true);
    // Switching to "only record" before typing a host must not drop everything.
    expect(shouldRecordHost('any.test', include())).toBe(true);
  });

  it('drops hosts on the never-record list', () => {
    const scope = exclude('*.analytics.com', 'telemetry.example.com');
    expect(shouldRecordHost('cdn.analytics.com', scope)).toBe(false);
    expect(shouldRecordHost('telemetry.example.com', scope)).toBe(false);
    expect(shouldRecordHost('api.example.com', scope)).toBe(true);
  });

  it('keeps only the listed hosts in include mode', () => {
    const scope = include('*.example.com', 'api.internal');
    expect(shouldRecordHost('api.example.com', scope)).toBe(true);
    expect(shouldRecordHost('api.internal', scope)).toBe(true);
    expect(shouldRecordHost('cdn.analytics.com', scope)).toBe(false);
    // The bare apex is not covered by the wildcard, same as in exclude mode.
    expect(shouldRecordHost('example.com', scope)).toBe(false);
  });

  it('excludes localhost when captureLocalhost is false', () => {
    const opts = { captureLocalhost: false, proxyPort: 8888, mcpApiPort: 9473 };
    expect(
      shouldRecordCapture('http://127.0.0.1:3000/api', '127.0.0.1:3000', exclude(), opts),
    ).toBe(false);
    expect(shouldRecordCapture('https://example.com/', 'example.com', exclude(), opts)).toBe(true);
  });

  it('excludes localhost even when it is on the include list', () => {
    const opts = { captureLocalhost: false, proxyPort: 8888, mcpApiPort: 9473 };
    expect(
      shouldRecordCapture(
        'http://127.0.0.1:3000/api',
        '127.0.0.1:3000',
        include('127.0.0.1'),
        opts,
      ),
    ).toBe(false);
  });

  it('always excludes self traffic on yanshuf ports', () => {
    const opts = { captureLocalhost: true, proxyPort: 8888, mcpApiPort: 9473 };
    expect(shouldRecordCapture('http://127.0.0.1:8888/', '127.0.0.1:8888', exclude(), opts)).toBe(
      false,
    );
    expect(
      shouldRecordCapture('http://127.0.0.1:9473/status', '127.0.0.1:9473', exclude(), opts),
    ).toBe(false);
    expect(shouldRecordCapture('http://127.0.0.1:3000/', '127.0.0.1:3000', exclude(), opts)).toBe(
      true,
    );
  });

  it('detects whether the scope actually narrows anything', () => {
    expect(isRecordingScopeActive(exclude())).toBe(false);
    expect(isRecordingScopeActive(exclude('   '))).toBe(false);
    expect(isRecordingScopeActive(exclude('*.example.com'))).toBe(true);
    expect(isRecordingScopeActive(include('*.example.com'))).toBe(true);
    expect(isRecordingScopeActive(undefined)).toBe(false);
  });

  it('falls back to recording everything for a malformed scope', () => {
    expect(normalizeRecordingScope(undefined)).toEqual({ mode: 'exclude', patterns: [] });
    expect(
      normalizeRecordingScope({ mode: 'nonsense', patterns: undefined } as unknown as RecordingScope),
    ).toEqual({ mode: 'exclude', patterns: [] });
  });

  it('strips the port from a host', () => {
    expect(hostWithoutPort('api.example.com:443')).toBe('api.example.com');
    expect(hostWithoutPort('api.example.com')).toBe('api.example.com');
  });

  it('adds hosts to the scope without duplicating or changing mode', () => {
    expect(addHostToScope(exclude(), 'api.example.com:443')).toEqual(
      exclude('api.example.com'),
    );
    expect(addHostToScope(exclude('*.api.com'), 'cdn.example.com')).toEqual(
      exclude('*.api.com', 'cdn.example.com'),
    );
    expect(addHostToScope(exclude('api.example.com'), 'api.example.com')).toEqual(
      exclude('api.example.com'),
    );
    expect(addHostToScope(include('*.api.com'), 'cdn.example.com')).toEqual(
      include('*.api.com', 'cdn.example.com'),
    );
  });
});
