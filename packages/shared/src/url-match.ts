import type { RuleMatch, UrlMatchMode } from './types';

/** Legacy rules stored only a regex, so anything without a mode is one. */
const LEGACY_MODE: UrlMatchMode = 'regex';

interface SplitUrl {
  host: string;
  /** Path plus query and fragment, always starting with `/`. */
  rest: string;
}

/**
 * Split a URL or a bare pattern into host and remainder. The scheme is dropped so
 * `www.cursor.com/x` matches both http and https, which is how people paste URLs.
 */
function splitUrl(value: string): SplitUrl | null {
  const withoutScheme = value.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  if (!withoutScheme) return null;

  const separator = withoutScheme.search(/[/?#]/);
  const host = separator === -1 ? withoutScheme : withoutScheme.slice(0, separator);
  if (!host) return null;

  const rest = separator === -1 ? '' : withoutScheme.slice(separator);
  return { host: host.toLowerCase(), rest: rest.startsWith('/') ? rest : `/${rest}` };
}

/** A lone trailing slash is noise; `/a/` and `/a` are the same resource here. */
function trimTrailingSlash(rest: string): string {
  return rest.length > 1 && rest.endsWith('/') ? rest.slice(0, -1) : rest;
}

/**
 * Host equality is checked separately from the path so a prefix pattern cannot
 * run past the host boundary — `https://www.google.com` must not be satisfied by
 * `www.google.com.attacker.net`.
 */
function matchesLiteralUrl(pattern: string, url: string, mode: 'exact' | 'prefix'): boolean {
  const target = splitUrl(url);
  const wanted = splitUrl(pattern);
  if (!target || !wanted) return false;
  if (target.host !== wanted.host) return false;

  const targetRest = trimTrailingSlash(target.rest);
  const wantedRest = trimTrailingSlash(wanted.rest);

  if (mode === 'exact') return targetRest === wantedRest;
  // A host-only pattern narrows to the host alone, matching everything on it.
  if (wantedRest === '/') return true;
  return targetRest.startsWith(wantedRest);
}

export function matchesUrlRegex(pattern: string | undefined, url: string): boolean {
  const trimmed = pattern?.trim();
  if (!trimmed) return false;
  try {
    return new RegExp(trimmed, 'i').test(url);
  } catch {
    return false;
  }
}

export interface ResolvedRuleMatch {
  pattern: string;
  mode: UrlMatchMode;
}

/** Accepts the legacy `{ urlRegex }` shape so rules saved before match modes still load. */
export function normalizeRuleMatch(match: RuleMatch | undefined): ResolvedRuleMatch {
  return {
    pattern: match?.pattern ?? match?.urlRegex ?? '',
    mode: match?.mode ?? LEGACY_MODE,
  };
}

export function matchesRuleUrl(match: RuleMatch | undefined, url: string): boolean {
  const { pattern, mode } = normalizeRuleMatch(match);
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  if (mode === 'regex') return matchesUrlRegex(trimmed, url);
  return matchesLiteralUrl(trimmed, url, mode);
}
