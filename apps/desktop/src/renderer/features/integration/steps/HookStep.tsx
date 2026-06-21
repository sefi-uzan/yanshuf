import { Button } from '@yanshuf/ui';
import { Loader2 } from 'lucide-react';
import type { IntegrationStepResult } from '@yanshuf/shared';

interface HookStepProps {
  busy: boolean;
  result?: IntegrationStepResult;
  hookInstalled: boolean;
  onInstall: () => void;
  onVerify: () => void;
}

export function HookStep({ busy, result, hookInstalled, onInstall, onVerify }: HookStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Add sessionEnd hook</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Clears captures when the chat session closes.
        </p>
      </div>
      {result && (
        <p className={result.ok ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}>
          {result.message}
        </p>
      )}
      {!hookInstalled ? (
        <Button className="w-full" size="lg" onClick={onInstall} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Installing…
            </>
          ) : (
            'Install hook'
          )}
        </Button>
      ) : (
        <Button className="w-full" size="lg" onClick={onVerify} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            'Verify setup'
          )}
        </Button>
      )}
    </div>
  );
}
