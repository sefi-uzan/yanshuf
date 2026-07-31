import {
  isLocalhostHost,
  isSelfTraffic,
  normalizeHost,
  parseHostPort,
  type SelfTrafficOptions,
} from './localhost';

export interface ShouldRecordCaptureOptions extends SelfTrafficOptions {
  captureLocalhost: boolean;
}

/** Accepts either a list or the legacy semicolon-separated string. */
export function parseFilterPatterns(patterns: string | string[]): string[] {
  const parts = Array.isArray(patterns) ? patterns : patterns.split(';');
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * Exclusion patterns are matched against the host, anchored, so `*.analytics.com`
 * cannot be triggered by an unrelated URL that merely mentions it in a query string.
 */
export function hostMatchesPattern(host: string, pattern: string): boolean {
  const source = pattern
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${source}$`, 'i').test(hostWithoutPort(host));
}

export function hostMatchesAnyPattern(host: string, patterns: string[]): boolean {
  return patterns.some((pattern) => hostMatchesPattern(host, pattern));
}

/** False when the host is on the never-record list. */
export function shouldRecordHost(host: string, exclusions: string[]): boolean {
  const patterns = parseFilterPatterns(exclusions);
  if (patterns.length === 0) return true;
  return !hostMatchesAnyPattern(host, patterns);
}

export function shouldRecordCapture(
  url: string,
  host: string,
  exclusions: string[],
  opts: ShouldRecordCaptureOptions,
): boolean {
  const { port } = parseHostPort(url, host);
  if (isSelfTraffic(host, port, opts)) return false;
  if (!opts.captureLocalhost && isLocalhostHost(host)) return false;
  return shouldRecordHost(host, exclusions);
}

export function hasRecordingExclusions(exclusions: string[]): boolean {
  return parseFilterPatterns(exclusions).length > 0;
}

/** Strip port from a host header or host:port string. */
export function hostWithoutPort(host: string): string {
  const trimmed = host.trim();
  const colonIdx = trimmed.lastIndexOf(':');
  if (colonIdx > 0 && /^\d+$/.test(trimmed.slice(colonIdx + 1))) {
    return normalizeHost(trimmed.slice(0, colonIdx));
  }
  return normalizeHost(trimmed);
}

export function addHostToExclusions(exclusions: string[], host: string): string[] {
  const pattern = hostWithoutPort(host);
  const merged = parseFilterPatterns(exclusions);
  if (!merged.includes(pattern)) merged.push(pattern);
  return merged;
}

export type RecordingExclusionAction =
  | { type: 'addHost'; host: string }
  | { type: 'clear' };
