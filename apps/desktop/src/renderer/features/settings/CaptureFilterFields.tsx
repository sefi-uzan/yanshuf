import type { CaptureFilterMode } from '@yanshuf/shared';
import { Textarea } from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import { Check, Eye, EyeOff } from 'lucide-react';
import { SettingsField } from './SettingsLayout';

const FILTER_MODES: {
  mode: CaptureFilterMode;
  label: string;
  description: string;
  icon: typeof Eye;
}[] = [
  {
    mode: 'include',
    label: 'Show only',
    description: 'Only matching requests appear in the list.',
    icon: Eye,
  },
  {
    mode: 'exclude',
    label: "Don't show",
    description: 'Matching requests are hidden from the list.',
    icon: EyeOff,
  },
];

interface CaptureFilterFieldsProps {
  filterMode: CaptureFilterMode;
  filterUrls: string;
  compact?: boolean;
  onFilterModeChange: (mode: CaptureFilterMode) => void;
  onFilterUrlsChange: (urls: string) => void;
}

export function CaptureFilterFields({
  filterMode,
  filterUrls,
  compact = false,
  onFilterModeChange,
  onFilterUrlsChange,
}: CaptureFilterFieldsProps) {
  return (
    <div className={cn(compact ? 'space-y-3' : 'space-y-5')}>
      <div className="space-y-2">
        {!compact && <p className="text-sm font-medium">Match mode</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {FILTER_MODES.map(({ mode, label, description, icon: Icon }) => {
            const selected = filterMode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={selected}
                className={cn(
                  'relative rounded-md border text-left transition-colors',
                  compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border/60 bg-background hover:border-muted-foreground/30 hover:bg-muted/30',
                )}
                onClick={() => onFilterModeChange(mode)}
              >
                {selected ? (
                  <Check
                    className={cn(
                      'absolute text-primary',
                      compact ? 'right-2 top-2 h-3 w-3' : 'right-2.5 top-2.5 h-3.5 w-3.5',
                    )}
                    aria-hidden
                  />
                ) : null}
                <div className={cn('flex items-start gap-2', compact ? 'pr-4' : 'pr-5')}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span
                      className={cn(
                        'block text-muted-foreground',
                        compact ? 'mt-0.5 text-[11px] leading-snug' : 'mt-0.5 text-xs',
                      )}
                    >
                      {description}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <SettingsField
        id="filter-urls"
        label="Patterns"
        hint={
          compact ? (
            <>
              Semicolon-separated globs ·{' '}
              <span className="font-mono text-[11px]">*.google.com;*.example.com/api</span>
            </>
          ) : (
            <>
              Semicolon-separated globs. Example:{' '}
              <span className="font-mono text-[11px]">*.google.com;*.example.com/api</span>
            </>
          )
        }
      >
        <Textarea
          id="filter-urls"
          className={cn(
            'font-mono text-xs leading-relaxed',
            compact ? 'min-h-[60px]' : 'min-h-[88px]',
          )}
          placeholder="*.google.com;*.cdn.example.com"
          value={filterUrls}
          onChange={(e) => onFilterUrlsChange(e.target.value)}
        />
      </SettingsField>
    </div>
  );
}
