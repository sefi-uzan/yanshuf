import type { CaptureFilterSettings } from './types';
import { isLocalhostHost, isSelfTraffic, parseHostPort, type SelfTrafficOptions } from './localhost';

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
