import { describe, expect, it } from 'vitest';
import type { CaptureEntry } from '@yanshuf/shared';
import { captureToAutoResponderRule, captureToMapRemoteRule } from '@yanshuf/shared';

const sampleEntry: CaptureEntry = {
  id: 'entry-1',
  startedAt: 1,
  durationMs: 42,
  method: 'GET',
  url: 'https://api.example.com/v1/users?id=1',
  host: 'api.example.com',
  path: '/v1/users?id=1',
  status: 200,
  tls: true,
  protocol: 'http1',
  requestBodySize: 0,
  responseBodySize: 18,
  client: {
    method: 'GET',
    url: 'https://api.example.com/v1/users?id=1',
    headers: { accept: 'application/json' },
    body: { size: 0 },
  },
  server: {
    url: 'https://api.example.com/v1/users?id=1',
    headers: {
      'content-type': 'application/json',
      'transfer-encoding': 'chunked',
      connection: 'close',
    },
    body: { size: 18, preview: '{"users":[1,2]}' },
  },
};

describe('captureToAutoResponderRule', () => {
  it('builds a rule from a captured exchange', () => {
    const rule = captureToAutoResponderRule(sampleEntry, 3);

    expect(rule.order).toBe(3);
    expect(rule.name).toBe('api.example.com');
    // The captured URL is stored verbatim; exact mode means no escaping is needed.
    expect(rule.match).toEqual({
      pattern: 'https://api.example.com/v1/users?id=1',
      mode: 'exact',
    });
    expect(rule.response.status).toBe(200);
    expect(rule.response.headers).toEqual({ 'content-type': 'application/json' });
    expect(rule.response.body).toEqual({ type: 'inline', content: '{"users":[1,2]}' });
  });
});

describe('captureToMapRemoteRule', () => {
  it('matches the whole host so every path is redirected', () => {
    const rule = captureToMapRemoteRule(sampleEntry, 0);

    expect(rule.match).toEqual({ pattern: 'api.example.com', mode: 'prefix' });
    expect(rule.mapTo).toEqual({ host: '' });
  });
});
