import { describe, expect, it } from 'vitest';
import { formatShortcutParts } from '@yanshuf/shared';

describe('formatShortcutParts', () => {
  it('formats modifier shortcuts for mac-style display', () => {
    expect(formatShortcutParts(['mod', 'shift', 'P'])).toEqual(['⌘', '⇧', 'P']);
  });
});
