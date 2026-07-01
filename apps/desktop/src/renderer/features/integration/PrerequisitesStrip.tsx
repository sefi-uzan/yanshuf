import { cn } from '@yanshuf/ui/lib/utils';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { IntegrationPrerequisites } from '@yanshuf/shared';
import { INTEGRATION_MIN_NODE_VERSION } from '@yanshuf/shared';

type PrerequisitesVariant = 'stack' | 'inline';

interface PrerequisitesStripProps {
  prereqs: IntegrationPrerequisites;
  variant?: PrerequisitesVariant;
  /** @deprecated use variant="inline" */
  compact?: boolean;
  onOpenCertificate?: () => void;
}

export function PrerequisitesStrip({
  prereqs,
  variant,
  compact = false,
  onOpenCertificate,
}: PrerequisitesStripProps) {
  const resolvedVariant = variant ?? (compact ? 'inline' : 'stack');

  if (resolvedVariant === 'inline') {
    return (
      <InlinePrerequisitesStrip prereqs={prereqs} onOpenCertificate={onOpenCertificate} />
    );
  }

  return (
    <div className="space-y-2 text-sm">
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

function InlinePrerequisitesStrip({
  prereqs,
  onOpenCertificate,
}: {
  prereqs: IntegrationPrerequisites;
  onOpenCertificate?: () => void;
}) {
  const nodeDetail = prereqs.node.ok
    ? prereqs.node.version
    : prereqs.node.message ?? `Node ${INTEGRATION_MIN_NODE_VERSION}+`;
  const certDetail = prereqs.cert.ok
    ? 'Trusted'
    : prereqs.cert.message ?? 'Not trusted';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-md border px-3 py-2 text-xs',
        prereqs.allMet
          ? 'border-border/60 bg-muted/30 text-muted-foreground'
          : 'border-amber-500/25 bg-amber-500/[0.04]',
      )}
    >
      <InlinePrereqChip ok={prereqs.node.ok} label="Node" detail={nodeDetail} />
      <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
      <InlinePrereqChip
        ok={prereqs.cert.ok}
        label="Certificate"
        detail={certDetail}
        action={
          !prereqs.cert.ok && onOpenCertificate ? (
            <button
              type="button"
              className="font-medium text-teal-600 underline-offset-2 hover:underline dark:text-teal-400"
              onClick={onOpenCertificate}
            >
              Fix
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

function InlinePrereqChip({
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
    <div className={cn('flex min-w-0 items-center gap-1.5', !ok && 'flex-wrap')}>
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <span className={cn('font-medium', ok ? 'text-foreground/80' : 'text-amber-900 dark:text-amber-100')}>
        {label}
      </span>
      {detail && (
        <span
          className={cn(
            'text-muted-foreground',
            ok ? 'truncate' : 'whitespace-normal',
          )}
          title={detail}
        >
          {detail}
        </span>
      )}
      {action}
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
        {detail && <div className="break-words text-muted-foreground">{detail}</div>}
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
          Cursor and Claude Code launch the Yanshuf MCP server with <strong>node</strong>. Yanshuf
          checks your shell PATH here — if Node is missing below, the AI client may still find it on
          its own. HTTPS capture also needs a trusted certificate.
        </p>
      </div>
      <PrerequisitesStrip prereqs={prereqs} onOpenCertificate={onOpenCertificate} />
      {!prereqs.allMet && (
        <p className="text-xs text-muted-foreground">
          You can continue anyway — undetected Node often still works in Cursor or Claude Code. Fix
          the certificate before relying on HTTPS capture.
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
