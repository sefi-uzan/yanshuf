import { SHORTCUTS, formatShortcutParts } from '@yanshuf/shared';
import { Button } from '@yanshuf/ui';
import { Kbd } from '@/components/shortcut-hints';
import { Loader2 } from 'lucide-react';

interface GeneralSettingsFooterProps {
  isDirty: boolean;
  saving: boolean;
  hintsVisible: boolean;
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function GeneralSettingsFooter({
  isDirty,
  saving,
  hintsVisible,
  onReset,
  onCancel,
  onSave,
}: GeneralSettingsFooterProps) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-3">
      <Button variant="outline" size="sm" onClick={onReset} disabled={!isDirty || saving}>
        Reset
      </Button>
      <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button size="sm" onClick={() => void onSave()} disabled={!isDirty || saving}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : hintsVisible ? (
          <span className="inline-flex items-center gap-0.5" aria-hidden>
            {formatShortcutParts(SHORTCUTS.saveSettings.keys).map((part, index) => (
              <Kbd key={`${part}-${index}`}>{part}</Kbd>
            ))}
          </span>
        ) : (
          'Save'
        )}
      </Button>
    </div>
  );
}
