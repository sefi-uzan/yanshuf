import { v4 as uuidv4 } from 'uuid';
import type { AutoResponderRule, InterceptMode, InterceptRule } from '@yanshuf/shared';

export type RuleAction = 'mock' | 'rewrite' | 'breakpoint';
export type RuleKind = 'mock' | 'intercept';
export type RuleFilter = 'all' | RuleKind;

export interface SelectedRuleRef {
  kind: RuleKind;
  id: string;
}

export function ruleActionFromIntercept(rule: InterceptRule): RuleAction {
  return rule.mode === 'breakpoint' ? 'breakpoint' : 'rewrite';
}

export function ruleActionLabel(action: RuleAction): string {
  switch (action) {
    case 'mock':
      return 'Mock';
    case 'rewrite':
      return 'Rewrite';
    case 'breakpoint':
      return 'Breakpoint';
  }
}

export function ruleActionDescription(action: RuleAction): string {
  switch (action) {
    case 'mock':
      return 'Return a synthetic response — traffic never reaches the server.';
    case 'rewrite':
      return 'Modify live requests or responses, then forward to the real backend.';
    case 'breakpoint':
      return 'Pause matching traffic so you can inspect, edit, and continue.';
  }
}

export function emptyMockRule(order: number): AutoResponderRule {
  return {
    id: uuidv4(),
    name: 'New Mock',
    enabled: true,
    order,
    match: { urlRegex: '' },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { type: 'inline', content: '{"mock": true}' },
      delayMs: 0,
    },
  };
}

export function emptyInterceptRule(order: number, mode: InterceptMode = 'rewrite'): InterceptRule {
  return {
    id: uuidv4(),
    name: mode === 'breakpoint' ? 'New Breakpoint' : 'New Rewrite',
    enabled: true,
    order,
    mode,
    phase: 'request',
    match: { urlRegex: '' },
    request: { headers: {}, body: '' },
    response: { status: 200, headers: {}, body: '' },
  };
}

export function reorderMockRules(
  rules: AutoResponderRule[],
  fromId: string,
  toId: string,
): AutoResponderRule[] {
  const fromIdx = rules.findIndex((rule) => rule.id === fromId);
  const toIdx = rules.findIndex((rule) => rule.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return rules;

  const next = [...rules];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next.map((rule, index) => ({ ...rule, order: index }));
}

export function reorderInterceptRules(
  rules: InterceptRule[],
  fromId: string,
  toId: string,
): InterceptRule[] {
  const fromIdx = rules.findIndex((rule) => rule.id === fromId);
  const toIdx = rules.findIndex((rule) => rule.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return rules;

  const next = [...rules];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next.map((rule, index) => ({ ...rule, order: index }));
}
