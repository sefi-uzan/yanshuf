import { forwardRef } from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import {
  clearQueryField,
  getQueryFieldValues,
  hasQueryTerm,
  parseCaptureQuery,
  toggleQueryTerm,
  type CaptureQuery,
  type QueryField,
  type QueryTerm,
  type RecordingScopeStatus,
} from '@yanshuf/shared';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Settings2,
  X,
  Zap,
} from 'lucide-react';

/** Chips write tokens into the query string, so the field always shows what a click did. */
const CHIPS: { label: string; term: QueryTerm; icon: typeof Zap; accent: string }[] = [
  {
    label: 'Errors',
    term: { field: 'is', value: 'error', negated: false },
    icon: AlertCircle,
    accent: 'text-red-600 dark:text-red-400',
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

/** Predicates that are useful but too niche to earn a permanent chip. */
const EXTRA_PREDICATES: { label: string; term: QueryTerm }[] = [
  { label: 'Mapped to another host', term: { field: 'is', value: 'mapped', negated: false } },
  { label: 'Sent from Composer', term: { field: 'is', value: 'composed', negated: false } },
  { label: 'Paused at a breakpoint', term: { field: 'is', value: 'paused', negated: false } },
];

interface FilterBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  recordingScope?: RecordingScopeStatus;
  onOpenRecordingSettings?: () => void;
}

export const FilterBar = forwardRef<HTMLInputElement, FilterBarProps>(function FilterBar(
  { query, onQueryChange, recordingScope, onOpenRecordingSettings },
  ref,
) {
  const parsed = parseCaptureQuery(query);
  const activeMethods = getQueryFieldValues(parsed, 'method');
  const activeStatuses = getQueryFieldValues(parsed, 'status');
  const hasQuery = parsed.terms.length > 0;

  const toggleField = (field: QueryField, value: string) =>
    onQueryChange(toggleQueryTerm(query, { field, value, negated: false }));

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
          active={activeMethods}
          options={METHODS.map((value) => ({ value, label: value }))}
          onToggle={(value) => toggleField('method', value)}
          onClear={() => onQueryChange(clearQueryField(query, 'method'))}
        />
        <FilterDropdown
          label="Status"
          active={activeStatuses}
          options={STATUS_CLASSES}
          onToggle={(value) => toggleField('status', value)}
          onClear={() => onQueryChange(clearQueryField(query, 'status'))}
        />
        <MoreFilters
          parsed={parsed}
          onToggleTerm={(term) => onQueryChange(toggleQueryTerm(query, term))}
          recordingScope={recordingScope}
          onOpenRecordingSettings={onOpenRecordingSettings}
        />
      </div>
    </div>
  );
});

/** Describes what the never-record / only-record list is doing right now. */
function describeRecordingScope(scope: RecordingScopeStatus | undefined): string {
  if (!scope?.active) return 'Recording every host';
  const hosts = `${scope.patternCount} host pattern${scope.patternCount === 1 ? '' : 's'}`;
  return scope.mode === 'include' ? `Only recording ${hosts}` : `Never recording ${hosts}`;
}

/**
 * Holds the niche predicates plus the recording scope. The scope lives here rather
 * than in the status bar because it is the one setting that can silently explain an
 * empty list, so it belongs next to the other reasons rows go missing.
 */
function MoreFilters({
  parsed,
  onToggleTerm,
  recordingScope,
  onOpenRecordingSettings,
}: {
  parsed: CaptureQuery;
  onToggleTerm: (term: QueryTerm) => void;
  recordingScope?: RecordingScopeStatus;
  onOpenRecordingSettings?: () => void;
}) {
  const activeCount = EXTRA_PREDICATES.filter(({ term }) => hasQueryTerm(parsed, term)).length;
  const scopeActive = recordingScope?.active ?? false;
  const scopeSummary = describeRecordingScope(recordingScope);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-[22px] gap-1 px-1.5 text-[11px] font-medium',
            (activeCount > 0 || scopeActive) && 'border-primary/40 bg-primary/10',
          )}
          aria-label="More filters"
          title={scopeActive ? `More filters — ${scopeSummary}` : 'More filters'}
        >
          More
          <ChevronDown className="h-3 w-3 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60 p-1">
        {EXTRA_PREDICATES.map(({ label, term }) => {
          const active = hasQueryTerm(parsed, term);
          return (
            <DropdownMenuCheckboxItem
              key={term.value}
              checked={active}
              onCheckedChange={() => onToggleTerm(term)}
              // Stay open so several predicates can be toggled in one visit.
              onSelect={(event) => event.preventDefault()}
              className="gap-2 rounded-sm px-2 py-1.5 text-xs"
            >
              <Check
                className={cn('h-3.5 w-3.5', active ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              {label}
            </DropdownMenuCheckboxItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => onOpenRecordingSettings?.()}
          className="gap-2 rounded-sm px-2 py-1.5 text-xs"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          Change recording scope
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One selection keeps the old single-value look; more collapse into an overflow count
 * because the bar has no room to spell out `GET, POST, DELETE`.
 */
function summarizeSelection(label: string, active: string[]): string {
  if (active.length === 0) return label;
  if (active.length === 1) return active[0];
  return `${active[0]} +${active.length - 1}`;
}

function FilterDropdown({
  label,
  active,
  options,
  onToggle,
  onClear,
}: {
  label: string;
  active: string[];
  options: { value: string; label: string }[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  // The query is hand-editable, so a selection can be any casing the user typed.
  const isActive = (value: string) =>
    active.some((candidate) => candidate.toLowerCase() === value.toLowerCase());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-[22px] max-w-28 gap-1 px-1.5 text-[11px] font-medium',
            active.length > 0 && 'border-primary/40 bg-primary/10',
          )}
          aria-label={`Filter by ${label.toLowerCase()}`}
          title={active.length > 1 ? `${label}: ${active.join(', ')}` : undefined}
        >
          <span className="truncate">{summarizeSelection(label, active)}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="p-1">
        {active.length > 0 && (
          <DropdownMenuItem
            onClick={onClear}
            className="gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear {label.toLowerCase()}
          </DropdownMenuItem>
        )}
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={isActive(option.value)}
            onCheckedChange={() => onToggle(option.value)}
            // Stay open so several values can be toggled in one visit.
            onSelect={(event) => event.preventDefault()}
            className="gap-2 rounded-sm px-2 py-1.5 text-xs"
          >
            <Check
              className={cn('h-3.5 w-3.5', isActive(option.value) ? 'opacity-100' : 'opacity-0')}
              aria-hidden
            />
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
