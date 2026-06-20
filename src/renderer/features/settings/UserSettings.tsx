import { useEffect, useState } from 'react';
import type { CaptureFilterMode } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { clearCapturedRequests, notifyActionFailed, notifyApplied } from '@/lib/toast-actions';

interface UserSettingsProps {
  active?: boolean;
  onReplayTour?: () => void;
  onApplied?: () => void;
}

const FILTER_MODES: {
  mode: CaptureFilterMode;
  label: string;
  description: string;
}[] = [
  {
    mode: 'include',
    label: 'Show only',
    description: 'Only requests matching these patterns will appear.',
  },
  {
    mode: 'exclude',
    label: "Don't show",
    description: 'Requests matching these patterns will be hidden.',
  },
];

export function UserSettings({ active, onReplayTour, onApplied }: UserSettingsProps) {
  const [filterMode, setFilterMode] = useState<CaptureFilterMode>('exclude');
  const [filterUrls, setFilterUrls] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!active) return;
    void window.yanshuf.settings.get().then((settings) => {
      setFilterMode(settings.captureFilter.mode);
      setFilterUrls(settings.captureFilter.urls);
    });
  }, [active]);

  const applyFilters = async () => {
    setApplying(true);
    try {
      const current = await window.yanshuf.settings.get();
      await window.yanshuf.settings.save({
        ...current,
        captureFilter: {
          mode: filterMode,
          urls: filterUrls,
        },
      });
      await clearCapturedRequests({ toast: false });
      notifyApplied('Filters', 'Captured requests cleared');
      onApplied?.();
    } catch (error) {
      notifyActionFailed('apply filters', error);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">Filters</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter request URL patterns separated by semicolons. Example:{' '}
          <span className="font-mono">*.google.com;*.example.com/api</span>
        </p>
        <div className="mt-3 space-y-2">
          {FILTER_MODES.map(({ mode, label, description }) => (
            <button
              key={mode}
              type="button"
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left transition-colors',
                filterMode === mode ? 'border-primary bg-accent' : 'hover:bg-muted/50',
              )}
              onClick={() => setFilterMode(mode)}
            >
              <div className="text-sm font-medium">{label}</div>
              <div className="text-sm text-muted-foreground">{description}</div>
            </button>
          ))}
        </div>
        <Textarea
          className="mt-3 font-mono text-xs"
          rows={4}
          placeholder="*.google.com;*.cdn.example.com"
          value={filterUrls}
          onChange={(e) => setFilterUrls(e.target.value)}
        />
        <Button className="mt-3" onClick={() => void applyFilters()} disabled={applying}>
          Apply
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-medium">Guided tour</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Walk through the main areas of Yanshuf — capture toggles, the request list, and Rules &
          Composer.
        </p>
        <Button variant="outline" className="mt-3" onClick={onReplayTour}>
          Replay tour
        </Button>
      </div>
    </div>
  );
}
