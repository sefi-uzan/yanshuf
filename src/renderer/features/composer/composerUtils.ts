import type { ComposerRequest } from '../../../shared/types';

export const MAX_COMPOSED_ENTRIES = 100;

export function requestHostname(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {
    return url.slice(0, 48) || 'Request';
  }
}

export function composedListLabel(request: ComposerRequest): string {
  return request.name?.trim() || requestHostname(request.url);
}
