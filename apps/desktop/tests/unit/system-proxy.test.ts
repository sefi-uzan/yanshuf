import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseBypassDomains } from '../../src/main/system-proxy/macos';

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
