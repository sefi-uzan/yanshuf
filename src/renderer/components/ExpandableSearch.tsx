import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShortcutHint } from '@/components/shortcut-hints';
import { SHORTCUTS } from '../../shared/shortcuts';

const EXPANDED_WIDTH_PX = 1120;
const VIEWPORT_LEFT_GUTTER_PX = 16;

interface ExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function maxExpandedWidth(slotRight: number): number {
  return Math.max(0, slotRight - VIEWPORT_LEFT_GUTTER_PX);
}

export function ExpandableSearch({ value, onChange, open, onOpenChange }: ExpandableSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const hasFilter = value.length > 0;

  const measureCollapsedWidth = () => measureRef.current?.offsetWidth ?? 0;

  const updateWidth = useCallback(() => {
    if (open) {
      const slotRight = slotRef.current?.getBoundingClientRect().right ?? 0;
      setWidth(Math.min(EXPANDED_WIDTH_PX, maxExpandedWidth(slotRight)));
      return;
    }
    setWidth(measureCollapsedWidth());
  }, [open]);

  useLayoutEffect(() => {
    updateWidth();
  }, [updateWidth, hasFilter]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [open, updateWidth]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (value) {
        onChange('');
      } else {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, value, onChange, onOpenChange]);

  const collapsedClassName = cn(
    'inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-[7px] px-2.5 text-xs font-medium',
    'hover:bg-accent hover:text-accent-foreground',
    hasFilter && 'bg-accent text-accent-foreground',
  );

  return (
    <div ref={slotRef} className="relative shrink-0">
      <div
        ref={measureRef}
        aria-hidden
        className={cn('pointer-events-none invisible absolute inline-flex', collapsedClassName)}
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span>Search</span>
        <ShortcutHint keys={SHORTCUTS.search.keys} className="ml-1" reserveSpace />
      </div>

      {/* In-flow ghost keeps the dock width stable while search overlays left */}
      <div className={cn(open && 'invisible')} aria-hidden={open}>
        <button
          type="button"
          title={`${SHORTCUTS.search.label} (${SHORTCUTS.search.keys.join('+')})`}
          onClick={() => onOpenChange(true)}
          className={collapsedClassName}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>Search</span>
          <ShortcutHint keys={SHORTCUTS.search.keys} className="ml-1" reserveSpace />
        </button>
      </div>

      {open && (
        <div
          style={width !== null ? { width } : undefined}
          className={cn(
            'absolute right-0 top-0 z-20 inline-flex h-7 items-center overflow-hidden',
            'rounded-[7px] border border-input bg-background px-2.5 shadow-md ring-1 ring-ring/10',
            'transition-[width] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => onOpenChange(false)}
            placeholder="Search URL, host, method, status…"
            className="ml-2 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange('');
                inputRef.current?.focus();
              }}
              className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {!open && hasFilter && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
          aria-label="Filter active"
        />
      )}
    </div>
  );
}
