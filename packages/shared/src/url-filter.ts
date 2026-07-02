import type { CaptureFilterSettings } from './types';
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

export function parseFilterPatterns(urls: string): string[] {
  return urls
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function globPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(escaped, 'i');
}

export function urlMatchesPattern(url: string, pattern: string): boolean {
  return globPatternToRegExp(pattern).test(url);
}

export function urlMatchesAnyPattern(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => urlMatchesPattern(url, pattern));
}

export function shouldCaptureUrl(url: string, filter: CaptureFilterSettings): boolean {
  const patterns = parseFilterPatterns(filter.urls);
  if (patterns.length === 0) return true;

  const matches = urlMatchesAnyPattern(url, patterns);
  return filter.mode === 'include' ? matches : !matches;
}

export function shouldRecordCapture(
  url: string,
  host: string,
  filter: CaptureFilterSettings,
  opts: ShouldRecordCaptureOptions,
): boolean {
  const { port } = parseHostPort(url, host);
  if (isSelfTraffic(host, port, opts)) return false;
  if (!opts.captureLocalhost && isLocalhostHost(host)) return false;
  return shouldCaptureUrl(url, filter);
}

export function isCaptureFilterActive(filter: CaptureFilterSettings): boolean {
  return parseFilterPatterns(filter.urls).length > 0;
}

/** Strip port from a host header or host:port string for use in URL glob patterns. */
export function hostWithoutPort(host: string): string {
  const trimmed = host.trim();
  const colonIdx = trimmed.lastIndexOf(':');
  if (colonIdx > 0 && /^\d+$/.test(trimmed.slice(colonIdx + 1))) {
    return normalizeHost(trimmed.slice(0, colonIdx));
  }
  return normalizeHost(trimmed);
}

/** Build a URL glob that matches requests for this host. */
export function hostToFilterPattern(host: string): string {
  return `*${hostWithoutPort(host)}*`;
}

export function mergeFilterPatterns(existing: string, additions: string[]): string {
  const merged = [...parseFilterPatterns(existing)];
  for (const pattern of additions) {
    if (!merged.includes(pattern)) merged.push(pattern);
  }
  return merged.join(';');
}

export function addHostToCaptureFilter(
  current: CaptureFilterSettings,
  host: string,
): CaptureFilterSettings {
  const pattern = hostToFilterPattern(host);
  return {
    mode: current.mode,
    urls: mergeFilterPatterns(current.urls, [pattern]),
  };
}

export type CaptureFilterApplyAction =
  | { type: 'addHost'; host: string }
  | { type: 'clear' };
