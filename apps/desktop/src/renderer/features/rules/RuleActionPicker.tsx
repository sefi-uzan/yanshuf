import { cn } from '@yanshuf/ui/lib/utils';
import { PauseCircle, PenLine, Zap } from 'lucide-react';
import type { RuleAction } from './rule-types';
import { ruleActionDescription, ruleActionLabel } from './rule-types';

const ACTIONS: {
  value: RuleAction;
  icon: typeof Zap;
  accent: string;
  activeRing: string;
  activeBg: string;
}[] = [
  {
    value: 'mock',
    icon: Zap,
    accent: 'text-amber-600 dark:text-amber-400',
    activeRing: 'ring-amber-500/40',
    activeBg: 'bg-amber-500/[0.08] border-amber-500/30',
  },
  {
    value: 'rewrite',
    icon: PenLine,
    accent: 'text-sky-600 dark:text-sky-400',
    activeRing: 'ring-sky-500/40',
    activeBg: 'bg-sky-500/[0.08] border-sky-500/30',
  },
  {
    value: 'breakpoint',
    icon: PauseCircle,
    accent: 'text-orange-600 dark:text-orange-400',
    activeRing: 'ring-orange-500/40',
    activeBg: 'bg-orange-500/[0.08] border-orange-500/30',
  },
];

interface RuleActionPickerProps {
  value: RuleAction;
  onChange: (action: RuleAction) => void;
  options?: RuleAction[];
  compact?: boolean;
}

export function RuleActionPicker({
  value,
  onChange,
  options = ['mock', 'rewrite', 'breakpoint'],
  compact,
}: RuleActionPickerProps) {
  const visibleActions = ACTIONS.filter(({ value: action }) => options.includes(action));

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      {!compact && (
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Rule behavior
          </p>
          <p className="text-[11px] text-muted-foreground">{ruleActionDescription(value)}</p>
        </div>
      )}
      <div
        className={cn(
          'grid gap-1.5 rounded-lg border bg-muted/20 p-1',
          visibleActions.length === 2 && 'grid-cols-2',
          visibleActions.length === 3 && 'grid-cols-3',
        )}
        role="radiogroup"
        aria-label="Rule behavior"
      >
        {visibleActions.map(({ value: action, icon: Icon, accent, activeRing, activeBg }) => {
          const active = value === action;
          return (
            <button
              key={action}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(action)}
              className={cn(
                'group relative flex flex-col items-center gap-1 rounded-md border border-transparent px-2 py-2.5 text-center transition-all duration-200',
                'hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && cn('shadow-sm ring-1', activeRing, activeBg),
                !active && 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-transform duration-200 group-hover:scale-110',
                  active ? accent : 'opacity-70',
                )}
              />
              <span className={cn('text-[11px] font-medium leading-none', active && 'text-foreground')}>
                {ruleActionLabel(action)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ruleActionAccentClass(action: RuleAction): string {
  switch (action) {
    case 'mock':
      return 'border-l-amber-500';
    case 'rewrite':
      return 'border-l-sky-500';
    case 'breakpoint':
      return 'border-l-orange-500';
  }
}
