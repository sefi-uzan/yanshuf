import {
  isLocalhostHost,
  isSelfTraffic,
  normalizeHost,
  parseHostPort,
  type SelfTrafficOptions,
} from './localhost';
import { DEFAULT_RECORDING_SCOPE, type RecordingScope } from './types';

export interface ShouldRecordCaptureOptions extends SelfTrafficOptions {
  captureLocalhost: boolean;
}

/** Accepts either a list or the legacy semicolon-separated string. */
export function parseFilterPatterns(patterns: string | string[]): string[] {
  const parts = Array.isArray(patterns) ? patterns : patterns.split(';');
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * Scope patterns are matched against the host, anchored, so `*.analytics.com`
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

/** Fall back to recording everything when the scope is missing or has no patterns. */
export function normalizeRecordingScope(scope: RecordingScope | undefined): RecordingScope {
  if (!scope) return DEFAULT_RECORDING_SCOPE;
  return {
    mode: scope.mode === 'include' ? 'include' : 'exclude',
    patterns: Array.isArray(scope.patterns) ? scope.patterns : [],
  };
}

/** Whether the host survives the never-record / only-record list. */
export function shouldRecordHost(host: string, scope: RecordingScope): boolean {
  const { mode, patterns } = normalizeRecordingScope(scope);
  const parsed = parseFilterPatterns(patterns);
  // An empty list means "everything", including in `include` mode — otherwise
  // switching modes before typing a host would silently drop all traffic.
  if (parsed.length === 0) return true;
  const matched = hostMatchesAnyPattern(host, parsed);
  return mode === 'include' ? matched : !matched;
}

export function shouldRecordCapture(
  url: string,
  host: string,
  scope: RecordingScope,
  opts: ShouldRecordCaptureOptions,
): boolean {
  const { port } = parseHostPort(url, host);
  if (isSelfTraffic(host, port, opts)) return false;
  if (!opts.captureLocalhost && isLocalhostHost(host)) return false;
  return shouldRecordHost(host, scope);
}

export function isRecordingScopeActive(scope: RecordingScope | undefined): boolean {
  return parseFilterPatterns(normalizeRecordingScope(scope).patterns).length > 0;
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

export function addHostToScope(scope: RecordingScope, host: string): RecordingScope {
  const normalized = normalizeRecordingScope(scope);
  const pattern = hostWithoutPort(host);
  const patterns = parseFilterPatterns(normalized.patterns);
  if (!patterns.includes(pattern)) patterns.push(pattern);
  return { ...normalized, patterns };
}

export type RecordingScopeAction =
  | { type: 'addHost'; host: string }
  | { type: 'setMode'; mode: RecordingScope['mode'] }
  | { type: 'clear' };
