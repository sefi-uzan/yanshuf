import { describe, expect, it } from 'vitest';
import { InterceptEngine } from '../../src/main/intercept/engine';
import type { InterceptRule } from '../../src/shared/types';

describe('InterceptEngine', () => {
  const rules: InterceptRule[] = [
    {
      id: '1',
      name: 'Rewrite API',
      enabled: true,
      order: 0,
      mode: 'rewrite',
      phase: 'request',
      match: { urlRegex: 'api\\.example\\.com' },
      request: { headers: { 'X-Test': '1' } },
    },
    {
      id: '2',
      name: 'Breakpoint all',
      enabled: true,
      order: 1,
      mode: 'breakpoint',
      phase: 'response',
      match: { urlRegex: '.*' },
    },
  ];

  it('finds rewrite rules by phase', () => {
    const engine = new InterceptEngine();
    engine.setRules(rules);
    expect(engine.findRewrite('https://api.example.com/users', 'request')?.id).toBe('1');
    expect(engine.findRewrite('https://api.example.com/users', 'response')).toBeUndefined();
  });

  it('finds breakpoint rules by phase', () => {
    const engine = new InterceptEngine();
    engine.setRules(rules);
    expect(engine.findBreakpoint('https://other.test', 'response')?.id).toBe('2');
    expect(engine.findBreakpoint('https://other.test', 'request')).toBeUndefined();
  });
});
