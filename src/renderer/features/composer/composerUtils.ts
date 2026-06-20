import type { ComposerRequest } from '../../../shared/types';

export const MAX_COMPOSED_ENTRIES = 100;

export function composedListLabel(request: ComposerRequest): string {
  return request.url.replace(/^https?:\/\//i, '').trim() || 'Request';
}
