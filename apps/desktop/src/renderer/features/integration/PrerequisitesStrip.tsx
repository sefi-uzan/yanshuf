import { cn } from '@yanshuf/ui/lib/utils';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { IntegrationPrerequisites } from '@yanshuf/shared';
import { INTEGRATION_MIN_NODE_VERSION } from '@yanshuf/shared';

interface PrerequisitesStripProps {
  prereqs: IntegrationPrerequisites;
  compact?: boolean;
  onOpenCertificate?: () => void;
}

export function PrerequisitesStrip({
  prereqs,
  compact = false,
  onOpenCertificate,
}: PrerequisitesStripProps) {
  return (
    <div className={cn('space-y-2', compact ? 'text-xs' : 'text-sm')}>
      <PrereqRow
        ok={prereqs.node.ok}
        label="Node.js"
        detail={
          prereqs.node.ok
            ? prereqs.node.version
            : prereqs.node.message ?? `Node ${INTEGRATION_MIN_NODE_VERSION}+ required`
        }
      />
      <PrereqRow
        ok={prereqs.cert.ok}
        label="Certificate"
        detail={
          prereqs.cert.ok
            ? 'Trusted'
            : prereqs.cert.message ?? 'Not trusted'
        }
        action={
          !prereqs.cert.ok && onOpenCertificate ? (
            <button
              type="button"
              className="text-teal-600 underline-offset-2 hover:underline dark:text-teal-400"
              onClick={onOpenCertificate}
            >
              Open certificate setup
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

function PrereqRow({
  ok,
  label,
  detail,
  action,
}: {
  ok: boolean;
  label: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2',
        ok
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        {detail && <div className="text-muted-foreground">{detail}</div>}
        {action}
      </div>
    </div>
  );
}

interface PrerequisitesStepProps {
  prereqs: IntegrationPrerequisites;
  onContinue: () => void;
  onOpenCertificate?: () => void;
}

export function PrerequisitesStep({
  prereqs,
  onContinue,
  onOpenCertificate,
}: PrerequisitesStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Before you connect</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Cursor and Claude Code launch the Yanshuf MCP server with <strong>node</strong> from your
          PATH. HTTPS capture also needs a trusted certificate.
        </p>
      </div>
      <PrerequisitesStrip prereqs={prereqs} onOpenCertificate={onOpenCertificate} />
      {!prereqs.allMet && (
        <p className="text-xs text-muted-foreground">
          You can continue anyway — MCP or capture may not work until these are resolved.
        </p>
      )}
      <button
        type="button"
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-600/90"
        onClick={onContinue}
      >
        Continue
      </button>
    </div>
  );
}
