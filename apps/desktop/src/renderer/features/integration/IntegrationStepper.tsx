import { Check, Circle } from 'lucide-react';
import { cn } from '@yanshuf/ui/lib/utils';
import {
  INTEGRATION_FLOW_STEPS,
  getStepperFlowStep,
  isIntegrationStepComplete,
  type WizardStepIndex,
} from './integration-flow';
import type { IntegrationVerifyResult } from '@yanshuf/shared';

interface IntegrationStepperProps {
  step: WizardStepIndex;
  verify: IntegrationVerifyResult | null;
  hookInstalled: boolean;
  prerequisitesSkipped: boolean;
  className?: string;
}

export function IntegrationStepper({
  step,
  verify,
  hookInstalled,
  prerequisitesSkipped,
  className,
}: IntegrationStepperProps) {
  const current = getStepperFlowStep(step, hookInstalled);
  const visibleSteps = prerequisitesSkipped
    ? INTEGRATION_FLOW_STEPS.filter((s) => s.id !== 'prerequisites')
    : INTEGRATION_FLOW_STEPS;

  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {visibleSteps.map((flowStep, index) => {
        const done = isIntegrationStepComplete(flowStep.id, step, verify, hookInstalled);
        const isCurrent = flowStep.id === current;
        const isVerifyReady = flowStep.id === 'verify' && done;

        return (
          <li key={flowStep.id} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                done && 'border-teal-600 bg-teal-600 text-white',
                isCurrent && !done && 'border-teal-600/60 bg-teal-500/10 text-teal-700 dark:text-teal-300',
                isVerifyReady && 'border-teal-600 bg-teal-600 text-white',
                !done && !isCurrent && !isVerifyReady && 'border-muted-foreground/30 text-muted-foreground',
              )}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {done ? <Check className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}
            </div>
            <span
              className={cn(
                'text-xs font-medium',
                done || isCurrent || isVerifyReady ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {flowStep.label}
            </span>
            {index < visibleSteps.length - 1 && (
              <div className={cn('mx-1 h-px flex-1', done ? 'bg-teal-600/40' : 'bg-border')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
