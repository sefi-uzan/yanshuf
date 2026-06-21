import type { ComposerRequest } from '@yanshuf/shared';

export const MAX_COMPOSED_ENTRIES = 100;

export function composedListLabel(request: ComposerRequest): string {
  return request.url.replace(/^https?:\/\//i, '').trim() || 'Request';
}
