import { describe, expect, it } from 'vitest';
import { readBearerToken } from '../../src/main/mcp-api/auth';

describe('readBearerToken', () => {
  it('parses bearer token', () => {
    expect(readBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('returns null for missing or invalid header', () => {
    expect(readBearerToken(undefined)).toBeNull();
    expect(readBearerToken('Basic abc')).toBeNull();
  });
});
