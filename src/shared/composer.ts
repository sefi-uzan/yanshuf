export const YANSHUF_COMPOSER_HEADER = 'x-yanshuf-composer';

export function isComposerCaptureHeader(headers: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === YANSHUF_COMPOSER_HEADER) {
      return value === '1' || value === 'true';
    }
  }
  return false;
}

export function stripComposerCaptureHeader(headers: Record<string, string>): Record<string, string> {
  const next = { ...headers };
  for (const key of Object.keys(next)) {
    if (key.toLowerCase() === YANSHUF_COMPOSER_HEADER) {
      delete next[key];
    }
  }
  return next;
}
