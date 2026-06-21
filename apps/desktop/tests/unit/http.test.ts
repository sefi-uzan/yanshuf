import { describe, expect, it } from 'vitest';
import { methodSupportsBody, normalizeBodyForMethod } from '@yanshuf/shared';

describe('methodSupportsBody', () => {
  it('allows body for POST, PUT, PATCH, DELETE', () => {
    expect(methodSupportsBody('POST')).toBe(true);
    expect(methodSupportsBody('PUT')).toBe(true);
    expect(methodSupportsBody('PATCH')).toBe(true);
    expect(methodSupportsBody('DELETE')).toBe(true);
  });

  it('disallows body for GET, HEAD, OPTIONS', () => {
    expect(methodSupportsBody('GET')).toBe(false);
    expect(methodSupportsBody('HEAD')).toBe(false);
    expect(methodSupportsBody('OPTIONS')).toBe(false);
  });
});

describe('normalizeBodyForMethod', () => {
  it('clears body when method does not support one', () => {
    expect(normalizeBodyForMethod('GET', '{"a":1}')).toBe('');
  });

  it('defaults to empty object when method supports body and body is empty', () => {
    expect(normalizeBodyForMethod('POST', '')).toBe('{}');
    expect(normalizeBodyForMethod('POST')).toBe('{}');
  });

  it('preserves existing body content', () => {
    expect(normalizeBodyForMethod('POST', '{"a":1}')).toBe('{"a":1}');
  });
});
