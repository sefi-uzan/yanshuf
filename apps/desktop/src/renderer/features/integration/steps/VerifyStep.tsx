import { Button } from '@yanshuf/ui';
import { Loader2, Check, X } from 'lucide-react';
import { cn } from '@yanshuf/ui/lib/utils';
import type { IntegrationVerifyResult } from '@yanshuf/shared';
import { CLIENT_LABEL, type IntegrationClient } from '@yanshuf/shared';

interface VerifyStepProps {
  client: IntegrationClient;
  verify: IntegrationVerifyResult | null;
  busy: boolean;
  installPaths: string[];
  onRunVerify: () => void;
  onDone: () => void;
}

const CHECKS: { key: keyof IntegrationVerifyResult; label: string }[] = [
  { key: 'nodeOk', label: 'Node.js on PATH' },
  { key: 'mcpConfigured', label: 'MCP configured' },
  { key: 'skillInstalled', label: 'Skill installed' },
  { key: 'hookInstalled', label: 'SessionEnd hook' },
  { key: 'apiReachable', label: 'API reachable' },
  { key: 'certTrusted', label: 'Certificate trusted' },
];

export function VerifyStep({
  client,
  verify,
  busy,
  installPaths,
  onRunVerify,
  onDone,
}: VerifyStepProps) {
  if (!verify) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Run verification to confirm everything is set up.</p>
        <Button className="w-full" size="lg" onClick={onRunVerify} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            'Run verification'
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Verification</h3>
        <ul className="mt-3 space-y-2">
          {CHECKS.map(({ key, label }, i) => {
            const ok = Boolean(verify[key]);
            return (
              <li
                key={key}
                className={cn(
                  'flex items-center gap-2 text-sm animate-in fade-in slide-in-from-bottom-1',
                )}
                style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}
              >
                {ok ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
                <span>{label}</span>
                {key === 'nodeOk' && verify.nodeVersion && (
                  <span className="text-xs text-muted-foreground">({verify.nodeVersion})</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {installPaths.length > 0 && (
        <div className="rounded-md border bg-muted/20 p-3 text-xs">
          <div className="font-medium text-foreground">Installed to</div>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {installPaths.map((p) => (
              <li key={p} className="truncate">
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {verify.details.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {verify.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">
        Restart {CLIENT_LABEL[client]} to pick up changes. Invoke with /yanshuf.
      </p>
      <Button className="w-full" size="lg" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
