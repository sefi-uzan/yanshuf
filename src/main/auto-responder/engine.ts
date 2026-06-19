import fs from 'node:fs/promises';
import type { AutoResponderRule } from '../../shared/types';

export interface MatchContext {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

export class AutoResponderEngine {
  private rules: AutoResponderRule[] = [];

  setRules(rules: AutoResponderRule[]): void {
    this.rules = [...rules].sort((a, b) => a.order - b.order);
  }

  getRules(): AutoResponderRule[] {
    return this.rules;
  }

  findMatch(ctx: MatchContext): AutoResponderRule | undefined {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (this.matches(rule, ctx)) return rule;
    }
    return undefined;
  }

  private matches(rule: AutoResponderRule, ctx: MatchContext): boolean {
    const { match } = rule;
    if (match.method && match.method.toUpperCase() !== ctx.method.toUpperCase()) {
      return false;
    }
    if (match.urlRegex) {
      try {
        if (!new RegExp(match.urlRegex, 'i').test(ctx.url)) return false;
      } catch {
        return false;
      }
    }
    if (match.headerRegex) {
      for (const hr of match.headerRegex) {
        const value = ctx.headers[hr.name.toLowerCase()] ?? ctx.headers[hr.name];
        if (!value) return false;
        try {
          if (!new RegExp(hr.pattern, 'i').test(value)) return false;
        } catch {
          return false;
        }
      }
    }
    return true;
  }

  async buildResponse(rule: AutoResponderRule): Promise<{
    status: number;
    headers: Record<string, string>;
    body: Buffer;
  }> {
    if (rule.response.delayMs && rule.response.delayMs > 0) {
      await new Promise((r) => setTimeout(r, rule.response.delayMs));
    }

    let body = Buffer.alloc(0);
    if (rule.response.body?.type === 'inline') {
      body = Buffer.from(rule.response.body.content, 'utf8');
    } else if (rule.response.body?.type === 'file') {
      body = await fs.readFile(rule.response.body.path);
    }

    return {
      status: rule.response.status,
      headers: rule.response.headers,
      body,
    };
  }
}
