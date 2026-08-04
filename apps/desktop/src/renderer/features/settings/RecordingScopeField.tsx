import { useState } from 'react';
import type { RecordingScope, RecordingScopeMode } from '@yanshuf/shared';
import { Button, Input } from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import { Plus, X } from 'lucide-react';

interface RecordingScopeFieldProps {
  scope: RecordingScope;
  onChange: (scope: RecordingScope) => void;
}

const MODES: { value: RecordingScopeMode; label: string }[] = [
  { value: 'exclude', label: 'Never record these' },
  { value: 'include', label: 'Only record these' },
];

/**
 * A deliberately small list for permanent noise or permanent focus. Day-to-day
 * filtering happens in the capture filter bar, which hides rows instead of
 * discarding them.
 */
export function RecordingScopeField({ scope, onChange }: RecordingScopeFieldProps) {
  const [draft, setDraft] = useState('');
  const { mode, patterns } = scope;

  const add = () => {
    const value = draft.trim();
    if (!value || patterns.includes(value)) {
      setDraft('');
      return;
    }
    onChange({ ...scope, patterns: [...patterns, value] });
    setDraft('');
  };

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Recording scope"
        className="inline-flex rounded-md border bg-background p-0.5"
      >
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={mode === option.value}
            onClick={() => onChange({ ...scope, mode: option.value })}
            className={cn(
              'rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors',
              mode === option.value
                ? 'bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="*.analytics.com"
          aria-label="Host pattern"
          className="h-8 font-mono text-xs"
        />
        <Button variant="outline" size="sm" className="h-8 shrink-0 px-2" onClick={add}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Add host pattern</span>
        </Button>
      </div>

      {patterns.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {patterns.map((pattern) => (
            <li key={pattern}>
              <span className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 font-mono text-[11px]">
                {pattern}
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...scope, patterns: patterns.filter((p) => p !== pattern) })
                  }
                  title={`Remove ${pattern}`}
                  aria-label={`Remove ${pattern}`}
                  className="rounded-sm text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
