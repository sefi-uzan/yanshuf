import { applyMapRemoteUrl, matchesUrlRegex } from '@yanshuf/shared';
import type { MapRemoteRule } from '@yanshuf/shared';

export class MapRemoteEngine {
  private rules: MapRemoteRule[] = [];

  setRules(rules: MapRemoteRule[]): void {
    this.rules = [...rules].sort((a, b) => a.order - b.order);
  }

  getRules(): MapRemoteRule[] {
    return this.rules;
  }

  findMatch(url: string): MapRemoteRule | undefined {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (matchesUrlRegex(rule.match.urlRegex, url)) return rule;
    }
    return undefined;
  }

  applyMapping(originalUrl: string, rule: MapRemoteRule): string {
    return applyMapRemoteUrl(originalUrl, rule);
  }
}
