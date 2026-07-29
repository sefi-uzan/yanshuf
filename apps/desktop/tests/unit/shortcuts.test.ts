import { describe, expect, it } from 'vitest';
import { formatShortcutParts } from '@yanshuf/shared';

describe('formatShortcutParts', () => {
  it('formats modifier shortcuts for the current platform', () => {
    const mod = process.platform === 'darwin' ? '⌘' : 'Ctrl';
    expect(formatShortcutParts(['mod', 'shift', 'P'])).toEqual([mod, '⇧', 'P']);
  });
});
