export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function methodSupportsBody(method: string): boolean {
  return METHODS_WITH_BODY.has(method.toUpperCase());
}

export function normalizeBodyForMethod(method: string, body?: string): string {
  if (!methodSupportsBody(method)) return '';
  if (!body?.trim()) return '{}';
  return body;
}
