import { describe, expect, it } from 'vitest';
import { isLocalhostHost, isSelfTraffic, normalizeHost, parseHostPort } from '@yanshuf/shared';

describe('localhost', () => {
  it('normalizes host casing and ports', () => {
    expect(normalizeHost('LOCALHOST:3000')).toBe('localhost');
    expect(normalizeHost('[::1]:8080')).toBe('::1');
  });

  it('detects localhost hosts', () => {
    expect(isLocalhostHost('localhost')).toBe(true);
    expect(isLocalhostHost('127.0.0.1')).toBe(true);
    expect(isLocalhostHost('::1')).toBe(true);
    expect(isLocalhostHost('myapp.local')).toBe(true);
    expect(isLocalhostHost('example.com')).toBe(false);
  });

  it('parses host and port from urls', () => {
    expect(parseHostPort('http://127.0.0.1:8888/path')).toEqual({
      host: '127.0.0.1',
      port: 8888,
    });
  });

  it('detects self traffic on loopback ports', () => {
    const opts = { proxyPort: 8888, mcpApiPort: 9473 };
    expect(isSelfTraffic('127.0.0.1', 8888, opts)).toBe(true);
    expect(isSelfTraffic('127.0.0.1', 9473, opts)).toBe(true);
    expect(isSelfTraffic('127.0.0.1', 3000, opts)).toBe(false);
    expect(isSelfTraffic('example.com', 8888, opts)).toBe(false);
  });
});
