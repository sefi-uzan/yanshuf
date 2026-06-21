import type { MapRemoteRule } from './types';

export function applyMapRemoteUrl(originalUrl: string, rule: MapRemoteRule): string {
  const parsed = new URL(originalUrl);
  parsed.hostname = rule.mapTo.host;
  if (rule.mapTo.port !== undefined) {
    parsed.port = String(rule.mapTo.port);
  }
  if (rule.mapTo.protocol) {
    parsed.protocol = `${rule.mapTo.protocol}:`;
  }
  return parsed.toString();
}
