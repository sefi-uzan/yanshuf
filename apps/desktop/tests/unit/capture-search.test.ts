import { describe, expect, it } from 'vitest';
import type { CaptureEntrySummary } from '@yanshuf/shared';
import { matchesCaptureSearch, searchCaptures } from '@yanshuf/shared';

const entries: CaptureEntrySummary[] = [
  {
    id: 'a',
    startedAt: 100,
    durationMs: 10,
    method: 'GET',
    url: 'https://api.example.com/users',
    host: 'api.example.com',
    path: '/users',
    status: 200,
    tls: true,
    protocol: 'http1',
    requestBodySize: 0,
    responseBodySize: 10,
  },
  {
    id: 'b',
    startedAt: 200,
    durationMs: 20,
    method: 'POST',
    url: 'https://api.example.com/login',
    host: 'api.example.com',
    path: '/login',
    status: 401,
    tls: true,
    protocol: 'http1',
    requestBodySize: 5,
    responseBodySize: 0,
  },
];

describe('matchesCaptureSearch', () => {
  it('matches url host method status', () => {
    expect(matchesCaptureSearch(entries[0]!, 'users')).toBe(true);
    expect(matchesCaptureSearch(entries[0]!, '404')).toBe(false);
    expect(matchesCaptureSearch(entries[1]!, '401')).toBe(true);
    expect(matchesCaptureSearch(entries[1]!, 'post')).toBe(true);
  });
});

describe('searchCaptures', () => {
  it('returns latest first with limit', () => {
    const result = searchCaptures(entries, { limit: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('b');
  });

  it('filters by method', () => {
    const result = searchCaptures(entries, { method: 'GET' });
    expect(result.map((e) => e.id)).toEqual(['a']);
  });
});
