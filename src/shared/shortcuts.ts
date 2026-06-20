export type ShortcutKey = 'mod' | 'shift' | 'alt' | string;

export interface ShortcutDefinition {
  id: string;
  label: string;
  keys: ShortcutKey[];
}

export const SHORTCUTS = {
  search: { id: 'search', label: 'Search', keys: ['mod', 'F'] },
  composer: { id: 'composer', label: 'Composer', keys: ['mod', 'K'] },
  autoResponder: { id: 'autoResponder', label: 'Auto Responder', keys: ['mod', 'R'] },
  clearSession: { id: 'clearSession', label: 'Clear captured requests', keys: ['mod', 'X'] },
  toggleCapture: { id: 'toggleCapture', label: 'Toggle capture', keys: ['mod', 'shift', 'P'] },
  settings: { id: 'settings', label: 'Settings', keys: ['mod', 'S'] },
} as const satisfies Record<string, ShortcutDefinition>;

export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
}

const KEY_SYMBOLS: Record<string, string> = {
  mod: '⌘',
  shift: '⇧',
  alt: '⌥',
  ctrl: '⌃',
};

export function formatShortcut(keys: ShortcutKey[]): string {
  return keys
    .map((key) => {
      const lower = key.toLowerCase();
      if (lower === 'mod') return isMac() ? KEY_SYMBOLS.mod : 'Ctrl';
      if (KEY_SYMBOLS[lower]) return KEY_SYMBOLS[lower];
      return key.length === 1 ? key.toUpperCase() : key;
    })
    .join(isMac() ? '' : '+');
}

export function formatShortcutParts(keys: ShortcutKey[]): string[] {
  return keys.map((key) => {
    const lower = key.toLowerCase();
    if (lower === 'mod') return isMac() ? '⌘' : 'Ctrl';
    if (KEY_SYMBOLS[lower]) return KEY_SYMBOLS[lower];
    return key.length === 1 ? key.toUpperCase() : key;
  });
}
