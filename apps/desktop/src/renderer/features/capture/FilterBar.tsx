import { forwardRef } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import {
  getQueryField,
  hasQueryTerm,
  parseCaptureQuery,
  setQueryField,
  toggleQueryTerm,
  type QueryTerm,
} from '@yanshuf/shared';
import { AlertCircle, Check, ChevronDown, Timer, X, Zap } from 'lucide-react';

/** Chips write tokens into the query string, so the field always shows what a click did. */
const CHIPS: { label: string; term: QueryTerm; icon: typeof Zap; accent: string }[] = [
  {
    label: 'Errors',
    term: { field: 'is', value: 'error', negated: false },
    icon: AlertCircle,
    accent: 'text-red-600 dark:text-red-400',
  },
  {
    label: 'Slow',
    term: { field: 'is', value: 'slow', negated: false },
    icon: Timer,
    accent: 'text-orange-600 dark:text-orange-400',
  },
  {
    label: 'Mocked',
    term: { field: 'is', value: 'mocked', negated: false },
    icon: Zap,
    accent: 'text-amber-600 dark:text-amber-400',
  },
];

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const STATUS_CLASSES = [
  { value: '2xx', label: '2xx Success' },
  { value: '3xx', label: '3xx Redirect' },
  { value: '4xx', label: '4xx Client error' },
  { value: '5xx', label: '5xx Server error' },
];

interface FilterBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  shown: number;
  total: number;
}

export const FilterBar = forwardRef<HTMLInputElement, FilterBarProps>(function FilterBar(
  { query, onQueryChange, shown, total },
  ref,
) {
  const parsed = parseCaptureQuery(query);
  const activeMethod = getQueryField(parsed, 'method');
  const activeStatus = getQueryField(parsed, 'status');
  const hasQuery = parsed.terms.length > 0;

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b bg-muted/10 px-2 py-2">
      <div className="relative">
        <Input
          ref={ref}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.preventDefault();
              onQueryChange('');
            }
          }}
          placeholder="Filter — host:api.example.com status:5xx -host:analytics"
          aria-label="Filter captured requests"
          className="h-8 pr-7 font-mono text-xs"
        />
        {hasQuery && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            title="Clear filter"
            aria-label="Clear filter"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        {CHIPS.map(({ label, term, icon: Icon, accent }) => {
          const active = hasQueryTerm(parsed, term);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              onClick={() => onQueryChange(toggleQueryTerm(query, term))}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors',
                active
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border/60 bg-background text-muted-foreground hover:bg-muted/60',
              )}
            >
              <Icon className={cn('h-3 w-3', active && accent)} aria-hidden />
              {label}
            </button>
          );
        })}

        <FilterDropdown
          label="Method"
          active={activeMethod}
          options={METHODS.map((value) => ({ value, label: value }))}
          onSelect={(value) => onQueryChange(setQueryField(query, 'method', value))}
        />
        <FilterDropdown
          label="Status"
          active={activeStatus}
          options={STATUS_CLASSES}
          onSelect={(value) => onQueryChange(setQueryField(query, 'status', value))}
        />

        <span className="ml-auto shrink-0 tabular-nums text-[11px] text-muted-foreground">
          {hasQuery ? `${shown} / ${total}` : `${total}`}
        </span>
      </div>
    </div>
  );
});

function FilterDropdown({
  label,
  active,
  options,
  onSelect,
}: {
  label: string;
  active: string | null;
  options: { value: string; label: string }[];
  onSelect: (value: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-[22px] gap-1 px-1.5 text-[11px] font-medium',
            active && 'border-primary/40 bg-primary/10',
          )}
          aria-label={`Filter by ${label.toLowerCase()}`}
        >
          {active ?? label}
          <ChevronDown className="h-3 w-3 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="p-1">
        {active && (
          <DropdownMenuItem
            onClick={() => onSelect(null)}
            className="gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear {label.toLowerCase()}
          </DropdownMenuItem>
        )}
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onSelect(option.value)}
            className="gap-2 rounded-sm px-2 py-1.5 text-xs"
          >
            <Check
              className={cn('h-3.5 w-3.5', active === option.value ? 'opacity-100' : 'opacity-0')}
              aria-hidden
            />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
