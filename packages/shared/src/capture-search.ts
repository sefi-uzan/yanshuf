import type { CaptureEntrySummary } from './types';
import type { CaptureSearchParams } from './mcp-api';
import { MCP_CAPTURE_SEARCH_MAX_LIMIT } from './mcp-api';
import { matchesCaptureQuery, parseCaptureQuery } from './capture-query';

/** Free-text search over an entry, using the shared capture query syntax. */
export function matchesCaptureSearch(entry: CaptureEntrySummary, query: string): boolean {
  if (!query) return true;
  return matchesCaptureQuery(entry, parseCaptureQuery(query));
}

function matchesField(value: string, filter?: string): boolean {
  if (!filter) return true;
  return value.toLowerCase().includes(filter.toLowerCase());
}

export function searchCaptures(
  entries: CaptureEntrySummary[],
  params: CaptureSearchParams,
): CaptureEntrySummary[] {
  const limit = Math.min(params.limit ?? MCP_CAPTURE_SEARCH_MAX_LIMIT, MCP_CAPTURE_SEARCH_MAX_LIMIT);

  const filtered = entries.filter((entry) => {
    if (params.query && !matchesCaptureSearch(entry, params.query)) return false;
    // Discrete field params predate the query syntax and stay plain substring matches.
    if (!matchesField(entry.url, params.url)) return false;
    if (!matchesField(entry.host, params.host)) return false;
    if (!matchesField(entry.method, params.method)) return false;
    if (params.status && !String(entry.status).includes(params.status)) return false;
    return true;
  });

  return filtered
    .slice()
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit);
}
