import { describe, expect, it } from 'vitest';
import { matchesRuleUrl, matchesUrlRegex, normalizeRuleMatch } from '@yanshuf/shared';

describe('normalizeRuleMatch', () => {
  it('reads the pre-match-mode urlRegex field as regex mode', () => {
    expect(normalizeRuleMatch({ urlRegex: 'api\\.example\\.com' })).toEqual({
      pattern: 'api\\.example\\.com',
      mode: 'regex',
    });
  });

  it('defaults a bare pattern to regex so old rules keep behaving', () => {
    expect(normalizeRuleMatch({ pattern: '.*' })).toEqual({ pattern: '.*', mode: 'regex' });
  });

  it('handles a missing match', () => {
    expect(normalizeRuleMatch(undefined)).toEqual({ pattern: '', mode: 'regex' });
  });
});

describe('matchesRuleUrl — regex mode', () => {
  it('matches anywhere in the URL', () => {
    const match = { pattern: 'api\\.example\\.com', mode: 'regex' as const };
    expect(matchesRuleUrl(match, 'https://api.example.com/users')).toBe(true);
    expect(matchesRuleUrl(match, 'https://other.test/api.example.com')).toBe(true);
  });

  it('treats an invalid regex as no match', () => {
    expect(matchesRuleUrl({ pattern: '[invalid', mode: 'regex' }, 'https://a.test')).toBe(false);
  });

  it('never matches on an empty pattern', () => {
    expect(matchesRuleUrl({ pattern: '', mode: 'regex' }, 'https://a.test')).toBe(false);
    expect(matchesRuleUrl({ pattern: '   ', mode: 'prefix' }, 'https://a.test')).toBe(false);
  });

  it('is exposed on its own for the copy helper', () => {
    expect(matchesUrlRegex('^https://a\\.test/$', 'https://a.test/')).toBe(true);
    expect(matchesUrlRegex(undefined, 'https://a.test/')).toBe(false);
  });
});

describe('matchesRuleUrl — exact mode', () => {
  const match = { pattern: 'https://api.example.com/v1/users?id=1', mode: 'exact' as const };

  it('matches the identical URL', () => {
    expect(matchesRuleUrl(match, 'https://api.example.com/v1/users?id=1')).toBe(true);
  });

  it('requires the query string to match too', () => {
    expect(matchesRuleUrl(match, 'https://api.example.com/v1/users?id=2')).toBe(false);
    expect(matchesRuleUrl(match, 'https://api.example.com/v1/users')).toBe(false);
  });

  it('rejects anything longer than the pattern', () => {
    const path = { pattern: 'https://api.example.com/v1/users', mode: 'exact' as const };
    expect(matchesRuleUrl(path, 'https://api.example.com/v1/users/42')).toBe(false);
  });

  it('ignores the scheme so a pasted host-only URL still works', () => {
    const noScheme = { pattern: 'api.example.com/v1/users', mode: 'exact' as const };
    expect(matchesRuleUrl(noScheme, 'https://api.example.com/v1/users')).toBe(true);
    expect(matchesRuleUrl(noScheme, 'http://api.example.com/v1/users')).toBe(true);
  });

  it('ignores a trailing slash and host casing', () => {
    const slash = { pattern: 'https://api.example.com/v1/users/', mode: 'exact' as const };
    expect(matchesRuleUrl(slash, 'https://API.Example.com/v1/users')).toBe(true);
  });

  it('does not treat regex metacharacters as special', () => {
    const dots = { pattern: 'https://a.test/x?y=1', mode: 'exact' as const };
    expect(matchesRuleUrl(dots, 'https://a.test/x?y=1')).toBe(true);
    expect(matchesRuleUrl(dots, 'https://axtest/x?y=1')).toBe(false);
  });
});

describe('matchesRuleUrl — prefix mode', () => {
  it('matches every path on a host-only pattern', () => {
    const match = { pattern: 'https://www.google.com', mode: 'prefix' as const };
    expect(matchesRuleUrl(match, 'https://www.google.com')).toBe(true);
    expect(matchesRuleUrl(match, 'https://www.google.com/search?q=x')).toBe(true);
  });

  it('matches anything under the given path', () => {
    const match = { pattern: 'www.cursor.com/dashboard/usage', mode: 'prefix' as const };
    expect(matchesRuleUrl(match, 'https://www.cursor.com/dashboard/usage')).toBe(true);
    expect(matchesRuleUrl(match, 'https://www.cursor.com/dashboard/usage/2026?tab=all')).toBe(true);
    expect(matchesRuleUrl(match, 'https://www.cursor.com/dashboard/settings')).toBe(false);
  });

  it('cannot run past the host boundary', () => {
    // A plain string prefix would let a lookalike host satisfy this pattern.
    const match = { pattern: 'https://www.google.com', mode: 'prefix' as const };
    expect(matchesRuleUrl(match, 'https://www.google.com.attacker.net/steal')).toBe(false);
    expect(matchesRuleUrl(match, 'https://notwww.google.com/')).toBe(false);
  });

  it('does not match a different host that shares the path', () => {
    const match = { pattern: 'api.example.com/v1', mode: 'prefix' as const };
    expect(matchesRuleUrl(match, 'https://api.other.com/v1/users')).toBe(false);
  });
});
