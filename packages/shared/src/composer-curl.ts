import type { ComposerRequest } from './types';
import { methodSupportsBody } from './http';

function shellQuote(value: string): string {
  return value.replace(/'/g, "'\\''");
}

export function exportCurl(req: ComposerRequest): string {
  const parts = [`curl -X ${req.method}`];
  for (const [key, value] of Object.entries(req.headers)) {
    parts.push(`-H '${shellQuote(`${key}: ${value}`)}'`);
  }
  if (req.body && methodSupportsBody(req.method)) {
    parts.push(`-d '${shellQuote(req.body)}'`);
  }
  parts.push(`'${shellQuote(req.url)}'`);
  return parts.join(' \\\n  ');
}
