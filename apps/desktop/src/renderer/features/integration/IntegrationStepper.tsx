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
    <ol className={cn('flex min-w-0 items-center gap-1 overflow-x-auto pb-0.5', className)}>
      {visibleSteps.map((flowStep, index) => {
        const done = isIntegrationStepComplete(flowStep.id, step, verify, hookInstalled);
        const isCurrent = flowStep.id === current;
        const isVerifyReady = flowStep.id === 'verify' && done;

        return (
          <li key={flowStep.id} className="flex shrink-0 items-center gap-1.5">
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                done && 'border-teal-600 bg-teal-600 text-white',
                isCurrent && !done && 'border-teal-600/60 bg-teal-500/10 text-teal-700 dark:text-teal-300',
                isVerifyReady && 'border-teal-600 bg-teal-600 text-white',
                !done && !isCurrent && !isVerifyReady && 'border-muted-foreground/30 text-muted-foreground',
              )}
              aria-current={isCurrent ? 'step' : undefined}
              title={flowStep.label}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
            </div>
            <span
              className={cn(
                'whitespace-nowrap text-xs font-medium',
                isCurrent || done || isVerifyReady ? 'text-foreground' : 'text-muted-foreground',
                !isCurrent && !done && !isVerifyReady && 'hidden sm:inline',
              )}
            >
              {flowStep.label}
            </span>
            {index < visibleSteps.length - 1 && (
              <div
                className={cn(
                  'mx-0.5 h-px w-3 shrink-0 sm:w-5',
                  done ? 'bg-teal-600/40' : 'bg-border',
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
