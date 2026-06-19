import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatShortcutParts, isMac, type ShortcutKey } from '../../shared/shortcuts';

interface ShortcutHintsContextValue {
  hintsVisible: boolean;
}

const ShortcutHintsContext = createContext<ShortcutHintsContextValue>({ hintsVisible: false });

export function ShortcutHintsProvider({ children }: { children: ReactNode }) {
  const [hintsVisible, setHintsVisible] = useState(false);

  useEffect(() => {
    const show = () => setHintsVisible(true);
    const hide = () => setHintsVisible(false);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') show();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Meta' || e.key === 'Control') hide();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', hide);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', hide);
    };
  }, []);

  return (
    <ShortcutHintsContext.Provider value={{ hintsVisible }}>
      {children}
    </ShortcutHintsContext.Provider>
  );
}

export function useShortcutHints(): ShortcutHintsContextValue {
  return useContext(ShortcutHintsContext);
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

interface ShortcutHintProps {
  keys: ShortcutKey[];
  className?: string;
  /** Always show a muted hint (e.g. in search placeholder area). */
  alwaysVisible?: boolean;
}

export function ShortcutHint({ keys, className, alwaysVisible = false }: ShortcutHintProps) {
  const { hintsVisible } = useShortcutHints();
  if (!hintsVisible && !alwaysVisible) return null;

  const parts = formatShortcutParts(keys);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5',
        alwaysVisible && !hintsVisible && 'opacity-50',
        className,
      )}
      aria-hidden
    >
      {parts.map((part, index) => (
        <Kbd key={`${part}-${index}`}>{part}</Kbd>
      ))}
    </span>
  );
}

interface ShortcutLegendProps {
  className?: string;
}

export function ShortcutLegend({ className }: ShortcutLegendProps) {
  const { hintsVisible } = useShortcutHints();
  if (!hintsVisible) {
    return (
      <span className={cn('text-[10px] text-muted-foreground/70', className)}>
        Hold {isMac() ? '⌘' : 'Ctrl'} for shortcuts
      </span>
    );
  }
  return null;
}
