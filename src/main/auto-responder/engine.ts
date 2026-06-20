import fs from 'node:fs/promises';
import type { AutoResponderRule } from '../../shared/types';

export class AutoResponderEngine {
  private rules: AutoResponderRule[] = [];

  setRules(rules: AutoResponderRule[]): void {
    this.rules = [...rules].sort((a, b) => a.order - b.order);
  }

  getRules(): AutoResponderRule[] {
    return this.rules;
  }

  findMatch(url: string): AutoResponderRule | undefined {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (this.matchesUrl(rule, url)) return rule;
    }
    return undefined;
  }

  private matchesUrl(rule: AutoResponderRule, url: string): boolean {
    const pattern = rule.match.urlRegex?.trim();
    if (!pattern) return false;
    try {
      return new RegExp(pattern, 'i').test(url);
    } catch {
      return false;
    }
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
