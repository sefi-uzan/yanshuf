import { describe, expect, it } from 'vitest';
import { MapRemoteEngine } from '../../src/main/map-remote/engine';
import type { MapRemoteRule } from '@yanshuf/shared';

describe('MapRemoteEngine', () => {
  const rules: MapRemoteRule[] = [
    {
      id: '1',
      name: 'Prod to staging',
      enabled: true,
      order: 0,
      match: { urlRegex: 'api\\.prod\\.com' },
      mapTo: { host: 'api.staging.com' },
    },
    {
      id: '2',
      name: 'Disabled',
      enabled: false,
      order: 1,
      match: { urlRegex: '.*' },
      mapTo: { host: 'localhost' },
    },
  ];

  it('finds first enabled matching rule by order', () => {
    const engine = new MapRemoteEngine();
    engine.setRules(rules);
    expect(engine.findMatch('https://api.prod.com/users')?.id).toBe('1');
    expect(engine.findMatch('https://other.test/foo')).toBeUndefined();
  });

  it('skips disabled rules', () => {
    const engine = new MapRemoteEngine();
    engine.setRules(rules);
    expect(engine.findMatch('https://anything.test')?.id).toBeUndefined();
  });

  it('returns invalid regex as no match', () => {
    const engine = new MapRemoteEngine();
    engine.setRules([
      {
        id: 'bad',
        name: 'Bad regex',
        enabled: true,
        order: 0,
        match: { urlRegex: '[invalid' },
        mapTo: { host: 'localhost' },
      },
    ]);
    expect(engine.findMatch('https://example.com')).toBeUndefined();
  });

  it('applies mapping via applyMapping', () => {
    const engine = new MapRemoteEngine();
    engine.setRules(rules);
    const match = engine.findMatch('https://api.prod.com/path?q=1');
    expect(match).toBeDefined();
    expect(engine.applyMapping('https://api.prod.com/path?q=1', match!)).toBe(
      'https://api.staging.com/path?q=1',
    );
  });
});
