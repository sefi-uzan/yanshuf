import { describe, expect, it } from 'vitest';
import type { CaptureEntrySummary } from '@yanshuf/shared';
import {
  filterCaptures,
  formatCaptureQuery,
  getQueryField,
  hasQueryTerm,
  matchesCaptureQuery,
  parseCaptureQuery,
  setQueryField,
  toggleQueryTerm,
} from '@yanshuf/shared';

function entry(overrides: Partial<CaptureEntrySummary> = {}): CaptureEntrySummary {
  return {
    id: 'e1',
    startedAt: 0,
    durationMs: 40,
    method: 'GET',
    url: 'https://api.example.com/v1/users',
    host: 'api.example.com',
    path: '/v1/users',
    status: 200,
    tls: true,
    protocol: 'http1',
    requestBodySize: 0,
    responseBodySize: 128,
    ...overrides,
  };
}

const matches = (e: CaptureEntrySummary, query: string) =>
  matchesCaptureQuery(e, parseCaptureQuery(query));

describe('parseCaptureQuery', () => {
  it('treats unprefixed words as free text', () => {
    expect(parseCaptureQuery('users')).toEqual({
      terms: [{ field: 'text', value: 'users', negated: false }],
    });
  });

  it('parses field terms and negation', () => {
    expect(parseCaptureQuery('host:api.example.com -is:mocked')).toEqual({
      terms: [
        { field: 'host', value: 'api.example.com', negated: false },
        { field: 'is', value: 'mocked', negated: true },
      ],
    });
  });

  it('keeps quoted values intact', () => {
    expect(parseCaptureQuery('host:"my host"').terms[0]).toEqual({
      field: 'host',
      value: 'my host',
      negated: false,
    });
  });

  it('falls back to free text for unknown fields', () => {
    expect(parseCaptureQuery('weird:thing').terms[0]).toEqual({
      field: 'text',
      value: 'weird:thing',
      negated: false,
    });
  });

  it('round-trips through formatCaptureQuery', () => {
    const query = 'host:api.example.com status:5xx -is:mocked plain';
    expect(formatCaptureQuery(parseCaptureQuery(query))).toBe(query);
  });
});

describe('matchesCaptureQuery', () => {
  it('matches everything on an empty query', () => {
    expect(matches(entry(), '')).toBe(true);
  });

  it('anchors host wildcards to the whole host', () => {
    expect(matches(entry({ host: 'www.google.com' }), 'host:*.google.com')).toBe(true);
    expect(matches(entry({ host: 'notgoogle.com' }), 'host:*.google.com')).toBe(false);
  });

  it('does not match a host mentioned only in the query string', () => {
    // The old filter used an unanchored regex over the whole URL, so this matched.
    const sneaky = entry({ host: 'evil.com', url: 'https://evil.com/?ref=x.google.com' });
    expect(matches(sneaky, 'host:*.google.com')).toBe(false);
  });

  it('treats a bare value as a substring match', () => {
    expect(matches(entry(), 'host:example')).toBe(true);
    expect(matches(entry(), 'host:nomatch')).toBe(false);
  });

  it('matches status codes and status classes', () => {
    expect(matches(entry({ status: 503 }), 'status:5xx')).toBe(true);
    expect(matches(entry({ status: 404 }), 'status:5xx')).toBe(false);
    expect(matches(entry({ status: 404 }), 'status:404')).toBe(true);
  });

  it('matches methods exactly and case-insensitively', () => {
    expect(matches(entry({ method: 'POST' }), 'method:post')).toBe(true);
    expect(matches(entry({ method: 'GET' }), 'method:POST')).toBe(false);
  });

  it('evaluates is: predicates', () => {
    expect(matches(entry({ status: 500 }), 'is:error')).toBe(true);
    expect(matches(entry({ status: 200 }), 'is:error')).toBe(false);
    expect(matches(entry({ durationMs: 5000 }), 'is:slow')).toBe(true);
    expect(matches(entry({ durationMs: 20 }), 'is:slow')).toBe(false);
    expect(matches(entry({ matchedRuleId: 'r1' }), 'is:mocked')).toBe(true);
    expect(matches(entry({ matchedMapRemoteRuleId: 'm1' }), 'is:mapped')).toBe(true);
    expect(matches(entry({ fromComposer: true }), 'is:composed')).toBe(true);
    expect(matches(entry({ tls: false }), 'is:tls')).toBe(false);
  });

  it('rejects entries matching a negated term', () => {
    expect(matches(entry({ host: 'analytics.io' }), '-host:analytics')).toBe(false);
    expect(matches(entry({ host: 'api.example.com' }), '-host:analytics')).toBe(true);
  });

  it('ORs terms sharing a field and ANDs across fields', () => {
    const post = entry({ method: 'POST', status: 500 });
    expect(matches(post, 'method:GET method:POST')).toBe(true);
    expect(matches(post, 'method:GET method:PUT')).toBe(false);
    expect(matches(post, 'method:POST status:5xx')).toBe(true);
    expect(matches(post, 'method:POST status:2xx')).toBe(false);
  });

  it('combines positive and negative terms', () => {
    const noisy = entry({ host: 'cdn.analytics.com', status: 500 });
    expect(matches(noisy, 'is:error -host:*.analytics.com')).toBe(false);
    expect(matches(entry({ status: 500 }), 'is:error -host:*.analytics.com')).toBe(true);
  });
});

describe('filterCaptures', () => {
  it('returns the original list when the query is empty', () => {
    const entries = [entry({ id: 'a' }), entry({ id: 'b' })];
    expect(filterCaptures(entries, '')).toBe(entries);
  });

  it('filters by query', () => {
    const entries = [entry({ id: 'ok', status: 200 }), entry({ id: 'bad', status: 500 })];
    expect(filterCaptures(entries, 'is:error').map((e) => e.id)).toEqual(['bad']);
  });
});

describe('query editing helpers', () => {
  it('toggles a term on and off', () => {
    const term = { field: 'is' as const, value: 'error', negated: false };
    const added = toggleQueryTerm('', term);
    expect(added).toBe('is:error');
    expect(hasQueryTerm(parseCaptureQuery(added), term)).toBe(true);
    expect(toggleQueryTerm(added, term)).toBe('');
  });

  it('keeps other terms when toggling', () => {
    const term = { field: 'is' as const, value: 'slow', negated: false };
    expect(toggleQueryTerm('host:api.example.com', term)).toBe('host:api.example.com is:slow');
  });

  it('treats a negated term as distinct from its positive form', () => {
    const positive = { field: 'host' as const, value: 'x.com', negated: false };
    expect(hasQueryTerm(parseCaptureQuery('-host:x.com'), positive)).toBe(false);
  });

  it('replaces the active value when setting a single-choice field', () => {
    expect(setQueryField('method:GET', 'method', 'POST')).toBe('method:POST');
    expect(setQueryField('method:GET is:error', 'method', 'POST')).toBe('is:error method:POST');
  });

  it('clears a field when passed null, leaving negated terms alone', () => {
    expect(setQueryField('method:GET is:error', 'method', null)).toBe('is:error');
    expect(setQueryField('-method:GET', 'method', null)).toBe('-method:GET');
  });

  it('reads back the active value for a field', () => {
    expect(getQueryField(parseCaptureQuery('status:4xx'), 'status')).toBe('4xx');
    expect(getQueryField(parseCaptureQuery('is:error'), 'status')).toBe(null);
  });
});
