import type { InterceptPhase, InterceptRule } from '../../shared/types';

export class InterceptEngine {
  private rules: InterceptRule[] = [];

  setRules(rules: InterceptRule[]): void {
    this.rules = [...rules].sort((a, b) => a.order - b.order);
  }

  getRules(): InterceptRule[] {
    return this.rules;
  }

  findRewrite(url: string, phase: InterceptPhase): InterceptRule | undefined {
    for (const rule of this.rules) {
      if (!rule.enabled || rule.mode !== 'rewrite' || rule.phase !== phase) continue;
      if (this.matchesUrl(rule, url)) return rule;
    }
    return undefined;
  }

  findBreakpoint(url: string, phase: InterceptPhase): InterceptRule | undefined {
    for (const rule of this.rules) {
      if (!rule.enabled || rule.mode !== 'breakpoint' || rule.phase !== phase) continue;
      if (this.matchesUrl(rule, url)) return rule;
    }
    return undefined;
  }

  private matchesUrl(rule: InterceptRule, url: string): boolean {
    const pattern = rule.match.urlRegex?.trim();
    if (!pattern) return false;
    try {
      return new RegExp(pattern, 'i').test(url);
    } catch {
      return false;
    }
  }
}

export function mergeHeaderRecord(
  target: Record<string, string | string[] | undefined>,
  patch?: Record<string, string>,
): void {
  if (!patch) return;
  for (const [key, value] of Object.entries(patch)) {
    target[key.toLowerCase()] = value;
  }
}

export function installBodyReplacer(
  onData: (handler: (ctx: unknown, chunk: Buffer, cb: (err: Error | null, chunk?: Buffer) => void) => void) => unknown,
  body: string,
): void {
  let replaced = false;
  onData((_ctx, chunk, cb) => {
    if (!replaced) {
      replaced = true;
      cb(null, Buffer.from(body, 'utf8'));
      return;
    }
    cb(null, Buffer.alloc(0));
  });
}
