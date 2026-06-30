import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseBypassDomains, parseProxySetting, proxyPointsAt } from '../../src/main/system-proxy/macos';

describe('system-proxy bypass domains', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses bypass domain output', () => {
    const domains = parseBypassDomains('There are 2 domains set:\n127.0.0.1\nlocalhost\n');
    expect(domains).toEqual(['127.0.0.1', 'localhost']);
  });

  it('returns empty list when no domains are set', () => {
    expect(parseBypassDomains('There are no bypass domains set')).toEqual([]);
  });
});

describe('system-proxy settings parsing', () => {
  it('parses enabled proxy output', () => {
    const snapshot = parseProxySetting(
      'Enabled: Yes\nServer: 127.0.0.1\nPort: 8888\nAuthenticated Proxy Enabled: 0\n',
    );
    expect(snapshot).toEqual({ enabled: true, server: '127.0.0.1', port: '8888' });
  });

  it('detects when proxy points at Yanshuf host and port', () => {
    expect(proxyPointsAt({ enabled: true, server: '127.0.0.1', port: '8888' }, '127.0.0.1', 8888)).toBe(
      true,
    );
    expect(proxyPointsAt({ enabled: true, server: '127.0.0.1', port: '8889' }, '127.0.0.1', 8888)).toBe(
      false,
    );
    expect(proxyPointsAt({ enabled: false, server: '127.0.0.1', port: '8888' }, '127.0.0.1', 8888)).toBe(
      false,
    );
  });
});
