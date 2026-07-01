import { describe, expect, it } from 'vitest';
import { mergePathSegments, resolveExecutable } from '../../src/main/shell-path';

describe('mergePathSegments', () => {
  it('deduplicates while preserving first-seen order', () => {
    expect(
      mergePathSegments('/opt/homebrew/bin:/usr/bin', '/usr/bin:/bin', '/opt/homebrew/bin'),
    ).toBe('/opt/homebrew/bin:/usr/bin:/bin');
  });

  it('skips empty segments', () => {
    expect(mergePathSegments('::/usr/bin::', undefined, '/bin')).toBe('/usr/bin:/bin');
  });

  it('returns empty string when no segments are provided', () => {
    expect(mergePathSegments(undefined, '')).toBe('');
  });
});

describe('resolveExecutable', () => {
  it('finds node when available on this machine', () => {
    const nodePath = resolveExecutable('node');
    if (nodePath) {
      expect(nodePath).toMatch(/node$/);
    }
  });
});
