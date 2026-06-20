import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import { ArrowRightLeft, Check, ChevronDown, LayoutGrid, PauseCircle, PenLine, Zap } from 'lucide-react';
import type { RuleAction, RuleFilter } from './rule-types';
import { ruleActionLabel } from './rule-types';

const FILTER_OPTIONS: {
  value: RuleFilter;
  label: string;
  icon: typeof Zap;
  accent: string;
  activeBg: string;
}[] = [
  {
    value: 'all',
    label: 'All rules',
    icon: LayoutGrid,
    accent: 'text-foreground',
    activeBg: 'bg-accent',
  },
  {
    value: 'mock',
    label: ruleActionLabel('mock'),
    icon: Zap,
    accent: 'text-amber-600 dark:text-amber-400',
    activeBg: 'bg-amber-500/10',
  },
  {
    value: 'rewrite',
    label: ruleActionLabel('rewrite'),
    icon: PenLine,
    accent: 'text-sky-600 dark:text-sky-400',
    activeBg: 'bg-sky-500/10',
  },
  {
    value: 'breakpoint',
    label: ruleActionLabel('breakpoint'),
    icon: PauseCircle,
    accent: 'text-orange-600 dark:text-orange-400',
    activeBg: 'bg-orange-500/10',
  },
  {
    value: 'map-remote',
    label: ruleActionLabel('map-remote'),
    icon: ArrowRightLeft,
    accent: 'text-emerald-600 dark:text-emerald-400',
    activeBg: 'bg-emerald-500/10',
  },
];

export function ruleFilterLabel(filter: RuleFilter): string {
  if (filter === 'all') return 'all';
  return ruleActionLabel(filter);
}

function countForFilter(
  filter: RuleFilter,
  counts: Record<RuleAction, number>,
  total: number,
): number {
  if (filter === 'all') return total;
  return counts[filter];
}

function getFilterOption(filter: RuleFilter) {
  return FILTER_OPTIONS.find((option) => option.value === filter) ?? FILTER_OPTIONS[0];
}

interface RuleFilterBarProps {
  value: RuleFilter;
  onChange: (filter: RuleFilter) => void;
  counts: Record<RuleAction, number>;
  total: number;
}

export function RuleFilterBar({ value, onChange, counts, total }: RuleFilterBarProps) {
  const active = getFilterOption(value);
  const ActiveIcon = active.icon;
  const activeCount = countForFilter(value, counts, total);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between gap-2 px-2.5 font-normal"
          aria-label={`Filter rules: ${active.label}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <ActiveIcon className={cn('h-3.5 w-3.5 shrink-0', active.accent)} aria-hidden />
            <span className="truncate text-xs">{active.label}</span>
            <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
              {activeCount}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] p-1">
        {FILTER_OPTIONS.map((option) => {
          const selected = value === option.value;
          const count = countForFilter(option.value, counts, total);
          const Icon = option.icon;

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex items-center gap-2 rounded-sm px-2 py-1.5',
                selected && option.activeBg,
              )}
            >
              <Check
                className={cn('h-3.5 w-3.5 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              <Icon className={cn('h-3.5 w-3.5 shrink-0', option.accent)} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-xs">{option.label}</span>
              <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                {count}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
