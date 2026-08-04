import type { CaptureEntrySummary } from './types';

/**
 * A small filter language for the capture list, shared by the desktop filter bar
 * and the MCP `query` parameter so both speak the same syntax.
 *
 *   text                bare words match anywhere in the URL
 *   host:api.foo.com    host match, `*` wildcards allowed
 *   method:POST         exact method
 *   status:404          exact status
 *   status:5xx          status class
 *   is:error            predicate, see IS_PREDICATES
 *   -host:analytics     any term can be negated with a leading `-`
 */

export const QUERY_FIELDS = ['text', 'host', 'url', 'method', 'status', 'is'] as const;
export type QueryField = (typeof QUERY_FIELDS)[number];

export const IS_PREDICATES = ['error', 'mocked', 'mapped', 'composed', 'paused', 'tls'] as const;
export type IsPredicate = (typeof IS_PREDICATES)[number];

export interface QueryTerm {
  field: QueryField;
  value: string;
  negated: boolean;
}

export interface CaptureQuery {
  terms: QueryTerm[];
}

export const EMPTY_CAPTURE_QUERY: CaptureQuery = { terms: [] };

function isQueryField(value: string): value is QueryField {
  return (QUERY_FIELDS as readonly string[]).includes(value);
}

/**
 * Split on whitespace, but keep quoted runs together so values with spaces
 * (`host:"my host"`) survive tokenization.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (const char of input) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

export function parseCaptureQuery(input: string): CaptureQuery {
  const terms: QueryTerm[] = [];

  for (const token of tokenize(input)) {
    const negated = token.startsWith('-') && token.length > 1;
    const body = negated ? token.slice(1) : token;
    const separator = body.indexOf(':');

    if (separator > 0) {
      const field = body.slice(0, separator).toLowerCase();
      const value = body.slice(separator + 1);
      if (isQueryField(field) && value) {
        terms.push({ field: field as QueryField, value, negated });
        continue;
      }
    }

    // Anything that isn't a recognised `field:value` pair is free text.
    terms.push({ field: 'text', value: body, negated });
  }

  return { terms };
}

/** Render terms back to a query string, the inverse of {@link parseCaptureQuery}. */
export function formatCaptureQuery(query: CaptureQuery): string {
  return query.terms
    .map(({ field, value, negated }) => {
      const quoted = /\s/.test(value) ? `"${value}"` : value;
      const body = field === 'text' ? quoted : `${field}:${quoted}`;
      return negated ? `-${body}` : body;
    })
    .join(' ');
}

/**
 * Wildcard match anchored to the whole value. `*.google.com` matches the host
 * `www.google.com` but not a URL that merely mentions it, which is where the
 * old substring-regex filter surprised people.
 */
function matchesWildcard(value: string, pattern: string): boolean {
  const source = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${source}$`, 'i').test(value);
}

/** Wildcards anchor; a bare value stays a substring match, which is what people type. */
function matchesValue(value: string, pattern: string): boolean {
  if (pattern.includes('*')) return matchesWildcard(value, pattern);
  return value.toLowerCase().includes(pattern.toLowerCase());
}

function matchesStatus(status: number, pattern: string): boolean {
  const normalized = pattern.toLowerCase();
  const classMatch = /^([1-5])xx$/.exec(normalized);
  if (classMatch) return Math.floor(status / 100) === Number(classMatch[1]);
  return String(status) === normalized;
}

function matchesPredicate(entry: CaptureEntrySummary, predicate: string): boolean {
  switch (predicate.toLowerCase() as IsPredicate) {
    case 'error':
      return entry.status >= 400;
    case 'mocked':
      return Boolean(entry.matchedRuleId);
    case 'mapped':
      return Boolean(entry.matchedMapRemoteRuleId);
    case 'composed':
      return Boolean(entry.fromComposer);
    case 'paused':
      return Boolean(entry.awaitingBreakpoint);
    case 'tls':
      return entry.tls;
    default:
      return false;
  }
}

function matchesTerm(entry: CaptureEntrySummary, term: QueryTerm): boolean {
  switch (term.field) {
    case 'host':
      return matchesValue(entry.host, term.value);
    case 'url':
      return matchesValue(entry.url, term.value);
    case 'method':
      return entry.method.toLowerCase() === term.value.toLowerCase();
    case 'status':
      return matchesStatus(entry.status, term.value);
    case 'is':
      return matchesPredicate(entry, term.value);
    case 'text':
      return (
        matchesValue(entry.url, term.value) ||
        matchesValue(entry.host, term.value) ||
        entry.method.toLowerCase() === term.value.toLowerCase() ||
        String(entry.status) === term.value
      );
    default:
      return false;
  }
}

/**
 * Positive terms sharing a field are OR'd (`method:GET method:POST` means either),
 * different fields are AND'd, and any matching negated term rejects the entry.
 */
export function matchesCaptureQuery(entry: CaptureEntrySummary, query: CaptureQuery): boolean {
  const positivesByField = new Map<QueryField, QueryTerm[]>();

  for (const term of query.terms) {
    if (term.negated) {
      if (matchesTerm(entry, term)) return false;
      continue;
    }
    const group = positivesByField.get(term.field);
    if (group) group.push(term);
    else positivesByField.set(term.field, [term]);
  }

  for (const group of positivesByField.values()) {
    if (!group.some((term) => matchesTerm(entry, term))) return false;
  }

  return true;
}

export function filterCaptures(
  entries: CaptureEntrySummary[],
  query: string | CaptureQuery,
): CaptureEntrySummary[] {
  const parsed = typeof query === 'string' ? parseCaptureQuery(query) : query;
  if (parsed.terms.length === 0) return entries;
  return entries.filter((entry) => matchesCaptureQuery(entry, parsed));
}

/** True when `query` already contains this exact term, used to toggle filter chips. */
export function hasQueryTerm(query: CaptureQuery, term: QueryTerm): boolean {
  return query.terms.some(
    (candidate) =>
      candidate.field === term.field &&
      candidate.negated === term.negated &&
      candidate.value.toLowerCase() === term.value.toLowerCase(),
  );
}

/** Add the term if absent, remove it if present. Backs every chip in the filter bar. */
export function toggleQueryTerm(query: string, term: QueryTerm): string {
  const parsed = parseCaptureQuery(query);
  if (hasQueryTerm(parsed, term)) {
    return formatCaptureQuery({
      terms: parsed.terms.filter(
        (candidate) =>
          !(
            candidate.field === term.field &&
            candidate.negated === term.negated &&
            candidate.value.toLowerCase() === term.value.toLowerCase()
          ),
      ),
    });
  }
  return formatCaptureQuery({ terms: [...parsed.terms, term] });
}

/** Drop every positive term for a field, leaving other fields and negations alone. */
export function clearQueryField(query: string, field: QueryField): string {
  const parsed = parseCaptureQuery(query);
  return formatCaptureQuery({
    terms: parsed.terms.filter((term) => term.field !== field || term.negated),
  });
}

/** The single active positive value for a field, or null when unset. */
export function getQueryField(query: CaptureQuery, field: QueryField): string | null {
  const term = query.terms.find((candidate) => candidate.field === field && !candidate.negated);
  return term ? term.value : null;
}

/** Every positive value for a field, which is the OR set a multi-select shows as checked. */
export function getQueryFieldValues(query: CaptureQuery, field: QueryField): string[] {
  return query.terms
    .filter((candidate) => candidate.field === field && !candidate.negated)
    .map((candidate) => candidate.value);
}
