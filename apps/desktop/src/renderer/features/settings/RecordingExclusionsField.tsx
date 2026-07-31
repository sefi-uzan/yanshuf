import { useState } from 'react';
import { Button, Input } from '@yanshuf/ui';
import { Plus, X } from 'lucide-react';

interface RecordingExclusionsFieldProps {
  exclusions: string[];
  onChange: (exclusions: string[]) => void;
}

/**
 * A deliberately small list for permanent noise. Day-to-day filtering happens in the
 * capture filter bar, which hides rows instead of discarding them.
 */
export function RecordingExclusionsField({
  exclusions,
  onChange,
}: RecordingExclusionsFieldProps) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value || exclusions.includes(value)) {
      setDraft('');
      return;
    }
    onChange([...exclusions, value]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
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
          aria-label="Host pattern to never record"
          className="h-8 font-mono text-xs"
        />
        <Button variant="outline" size="sm" className="h-8 shrink-0 px-2" onClick={add}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Add exclusion</span>
        </Button>
      </div>

      {exclusions.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {exclusions.map((pattern) => (
            <li key={pattern}>
              <span className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 font-mono text-[11px]">
                {pattern}
                <button
                  type="button"
                  onClick={() => onChange(exclusions.filter((p) => p !== pattern))}
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
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Nothing excluded — every proxied request is recorded.
        </p>
      )}
    </div>
  );
}
