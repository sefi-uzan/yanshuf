import { Check, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { cn } from '@yanshuf/ui/lib/utils';
import {
  CERT_FLOW_STEPS,
  getCertFlowStep,
  isCertFlowStepComplete,
  type CertFlowStep,
} from './cert-flow';
import type { CertStatus } from '@yanshuf/shared';

type CertStepperVariant = 'stepper' | 'inline';

interface CertStepperProps {
  trusted: CertStatus['trusted'];
  variant?: CertStepperVariant;
  className?: string;
}

export function CertStepper({ trusted, variant = 'stepper', className }: CertStepperProps) {
  if (variant === 'inline') {
    return <InlineCertStepper trusted={trusted} className={className} />;
  }

  const current = getCertFlowStep(trusted);

  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {CERT_FLOW_STEPS.map((step, index) => {
        const done = isCertFlowStepComplete(step.id, trusted);
        const isCurrent = step.id === current && trusted !== 'installed';
        const isReady = step.id === 'ready' && trusted === 'installed';

        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <StepIndicator done={done} isCurrent={isCurrent} isReady={isReady} />
            <span
              className={cn(
                'text-xs font-medium',
                done || isCurrent || isReady ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
            {index < CERT_FLOW_STEPS.length - 1 && (
              <div className={cn('mx-1 h-px flex-1', done ? 'bg-emerald-600/40' : 'bg-border')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function InlineCertStepper({
  trusted,
  className,
}: {
  trusted: CertStatus['trusted'];
  className?: string;
}) {
  const allReady = trusted === 'installed';
  const keychainDetail =
    trusted === 'installed'
      ? 'Login keychain · trusted'
      : trusted === 'untrusted'
        ? 'Login keychain · needs Always Trust'
        : 'Login keychain · not installed';

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-md border px-3 py-2 text-xs',
        allReady
          ? 'border-border/60 bg-muted/30 text-muted-foreground'
          : 'border-amber-500/25 bg-amber-500/[0.04]',
        className,
      )}
    >
      {CERT_FLOW_STEPS.map((step, index) => {
        const done = isCertFlowStepComplete(step.id, trusted);
        const current = getCertFlowStep(trusted);
        const isCurrent = step.id === current && trusted !== 'installed';

        return (
          <div key={step.id} className="flex items-center gap-3">
            {index > 0 && <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />}
            <InlineStepChip done={done} isCurrent={isCurrent} label={step.label} />
          </div>
        );
      })}
      <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
      <span className="truncate text-muted-foreground">{keychainDetail}</span>
    </div>
  );
}

function InlineStepChip({
  done,
  isCurrent,
  label,
}: {
  done: boolean;
  isCurrent: boolean;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : isCurrent ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      ) : (
        <Circle className="h-3 w-3 shrink-0 text-muted-foreground/50" />
      )}
      <span
        className={cn(
          'font-medium',
          done && 'text-foreground/80',
          isCurrent && !done && 'text-amber-900 dark:text-amber-100',
          !done && !isCurrent && 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  );
}

function StepIndicator({
  done,
  isCurrent,
  isReady,
}: {
  done: boolean;
  isCurrent: boolean;
  isReady: boolean;
}) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
        done && 'border-emerald-600 bg-emerald-600 text-white',
        isCurrent && !done && 'border-primary bg-primary/10 text-primary',
        isReady && 'border-emerald-600 bg-emerald-600 text-white',
        !done && !isCurrent && !isReady && 'border-muted-foreground/30 text-muted-foreground',
      )}
      aria-current={isCurrent ? 'step' : undefined}
    >
      {done ? <Check className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}
    </div>
  );
}
