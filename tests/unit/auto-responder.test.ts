import { describe, expect, it } from 'vitest';
import { AutoResponderEngine } from '../../src/main/auto-responder/engine';
import type { AutoResponderRule } from '../../src/shared/types';

describe('AutoResponderEngine', () => {
  const rules: AutoResponderRule[] = [
    {
      id: '1',
      name: 'First',
      enabled: true,
      order: 0,
      match: { urlRegex: 'api\\.example\\.com', method: 'GET' },
      response: { status: 200, headers: {}, body: { type: 'inline', content: 'first' } },
    },
    {
      id: '2',
      name: 'Second',
      enabled: true,
      order: 1,
      match: { urlRegex: '.*', method: 'GET' },
      response: { status: 404, headers: {}, body: { type: 'inline', content: 'second' } },
    },
  ];

  it('returns first matching rule in order', () => {
    const engine = new AutoResponderEngine();
    engine.setRules(rules);
    const match = engine.findMatch({
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: {},
      body: '',
    });
    expect(match?.id).toBe('1');
  });

  it('skips disabled rules', () => {
    const engine = new AutoResponderEngine();
    engine.setRules(rules.map((r) => (r.id === '1' ? { ...r, enabled: false } : r)));
    const match = engine.findMatch({
      method: 'GET',
      url: 'https://api.example.com/users',
      headers: {},
      body: '',
    });
    expect(match?.id).toBe('2');
  });

  it('applies delay before returning response', async () => {
    const engine = new AutoResponderEngine();
    engine.setRules([
      {
        id: 'delay',
        name: 'Delay',
        enabled: true,
        order: 0,
        match: { urlRegex: '.*' },
        response: {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
          body: { type: 'inline', content: 'ok' },
          delayMs: 50,
        },
      },
    ]);
    const start = Date.now();
    const response = await engine.buildResponse(engine.getRules()[0]);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
    expect(response.body.toString()).toBe('ok');
  });
});
