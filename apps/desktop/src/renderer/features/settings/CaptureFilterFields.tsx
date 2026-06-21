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
  onFilterModeChange: (mode: CaptureFilterMode) => void;
  onFilterUrlsChange: (urls: string) => void;
}

export function CaptureFilterFields({
  filterMode,
  filterUrls,
  onFilterModeChange,
  onFilterUrlsChange,
}: CaptureFilterFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {FILTER_MODES.map(({ mode, label, description, icon: Icon }) => {
          const selected = filterMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={selected}
              className={cn(
                'relative rounded-lg border px-3 py-3 text-left transition-all',
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'hover:border-muted-foreground/30 hover:bg-muted/40',
              )}
              onClick={() => onFilterModeChange(mode)}
            >
              {selected ? (
                <Check className="absolute right-3 top-3 h-4 w-4 text-primary" aria-hidden />
              ) : null}
              <div className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <SettingsField
        id="filter-urls"
        label="Patterns"
        hint={
          <>
            Semicolon-separated globs. Example:{' '}
            <span className="font-mono text-[11px]">*.google.com;*.example.com/api</span>
          </>
        }
      >
        <Textarea
          id="filter-urls"
          className="min-h-[96px] font-mono text-xs leading-relaxed"
          placeholder="*.google.com;*.cdn.example.com"
          value={filterUrls}
          onChange={(e) => onFilterUrlsChange(e.target.value)}
        />
      </SettingsField>
    </div>
  );
}
