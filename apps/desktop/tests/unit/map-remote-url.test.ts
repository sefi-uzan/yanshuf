import { describe, expect, it } from 'vitest';
import { applyMapRemoteUrl } from '@yanshuf/shared';
import type { MapRemoteRule } from '@yanshuf/shared';

function rule(overrides: Partial<MapRemoteRule> & { mapTo: MapRemoteRule['mapTo'] }): MapRemoteRule {
  return {
    id: '1',
    name: 'test',
    enabled: true,
    order: 0,
    match: { urlRegex: '.*' },
    ...overrides,
  };
}

describe('applyMapRemoteUrl', () => {
  it('remaps host while preserving path and query', () => {
    const mapped = applyMapRemoteUrl(
      'https://api.prod.com/users?id=1',
      rule({ mapTo: { host: 'api.staging.com' } }),
    );
    expect(mapped).toBe('https://api.staging.com/users?id=1');
  });

  it('overrides port when specified', () => {
    const mapped = applyMapRemoteUrl(
      'https://api.prod.com/foo',
      rule({ mapTo: { host: 'localhost', port: 8080 } }),
    );
    expect(mapped).toBe('https://localhost:8080/foo');
  });

  it('overrides protocol when specified', () => {
    const mapped = applyMapRemoteUrl(
      'https://api.prod.com/foo',
      rule({ mapTo: { host: 'api.staging.com', protocol: 'http' } }),
    );
    expect(mapped).toBe('http://api.staging.com/foo');
  });

  it('preserves original port when not overridden', () => {
    const mapped = applyMapRemoteUrl(
      'http://api.prod.com:3000/foo',
      rule({ mapTo: { host: 'localhost' } }),
    );
    expect(mapped).toBe('http://localhost:3000/foo');
  });
});
