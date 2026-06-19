import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CERT_FLOW_STEPS,
  getCertFlowStep,
  isCertFlowStepComplete,
  type CertFlowStep,
} from './cert-flow';
import type { CertStatus } from '../../../shared/types';

interface CertStepperProps {
  trusted: CertStatus['trusted'];
  className?: string;
}

export function CertStepper({ trusted, className }: CertStepperProps) {
  const current = getCertFlowStep(trusted);

  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {CERT_FLOW_STEPS.map((step, index) => {
        const done = isCertFlowStepComplete(step.id, trusted);
        const isCurrent = step.id === current && trusted !== 'installed';
        const isReady = step.id === 'ready' && trusted === 'installed';

        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <StepIndicator step={step.id} done={done} isCurrent={isCurrent} isReady={isReady} />
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

function StepIndicator({
  step,
  done,
  isCurrent,
  isReady,
}: {
  step: CertFlowStep;
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
