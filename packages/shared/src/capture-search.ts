import type { CaptureEntrySummary } from './types';
import type { CaptureSearchParams } from './mcp-api';
import { MCP_CAPTURE_SEARCH_MAX_LIMIT } from './mcp-api';

export function matchesCaptureSearch(entry: CaptureEntrySummary, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    entry.url.toLowerCase().includes(q) ||
    entry.host.toLowerCase().includes(q) ||
    entry.method.toLowerCase().includes(q) ||
    String(entry.status).includes(q)
  );
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
