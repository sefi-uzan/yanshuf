import { describe, expect, it } from 'vitest';
import { DEFAULT_BODY_CHARS, truncateLargeStrings } from '../src/tools.js';

describe('truncateLargeStrings', () => {
  it('leaves short strings, numbers, and nulls untouched', () => {
    const input = { a: 'short', b: 42, c: null, d: [true, 'x'] };
    expect(truncateLargeStrings(input, 100)).toEqual(input);
  });

  it('truncates long strings and reports the omitted size', () => {
    const long = 'x'.repeat(5000);
    const result = truncateLargeStrings({ body: long }, 100);
    expect(result.body).toContain('x'.repeat(100));
    expect(result.body).toContain('truncated 4900 of 5000 chars');
    expect(result.body.length).toBeLessThan(200);
  });

  it('recurses into nested capture-like shapes', () => {
    const capture = {
      client: { body: { preview: 'y'.repeat(DEFAULT_BODY_CHARS + 10), size: 9999 } },
      server: { headers: { 'content-type': 'application/json' } },
    };
    const result = truncateLargeStrings(capture, DEFAULT_BODY_CHARS);
    expect(result.client.body.preview).toContain('truncated 10 of');
    expect(result.client.body.size).toBe(9999);
    expect(result.server.headers['content-type']).toBe('application/json');
  });
});
