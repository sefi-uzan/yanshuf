import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpotlightOverlay } from './SpotlightOverlay';
import { getBubbleStyle } from './tour-bubble';
import {
  findNextReachableStepIndex,
  getNextTourStepIndex,
  getTourStepCount,
  isLastTourStep,
  TOUR_STEPS,
  type TourStep,
} from './tour-steps';
import { useTargetRect, type TargetRect } from './useTargetRect';

interface GuidedTourProps {
  open: boolean;
  onComplete: () => void;
}

function TourBubble({
  step,
  stepIndex,
  rect,
  onNext,
  onDismiss,
}: {
  step: TourStep;
  stepIndex: number;
  rect: TargetRect;
  onNext: () => void;
  onDismiss: () => void;
}) {
  const total = getTourStepCount();
  const last = isLastTourStep(stepIndex);

  return (
    <div
      className="pointer-events-auto rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg"
      style={getBubbleStyle(rect, step.placement)}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm leading-relaxed">{step.content}</p>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onDismiss}
          aria-label="Close guided tour"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          I&apos;m ready
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {stepIndex + 1} / {total}
          </span>
          <Button size="sm" onClick={onNext}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GuidedTour({ open, onComplete }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const index = findNextReachableStepIndex(0);
    if (index === null) {
      onComplete();
      return;
    }
    setStepIndex(index);
  }, [open, onComplete]);

  const currentStep = TOUR_STEPS[stepIndex];
  const rect = useTargetRect(currentStep?.target ?? null, open);

  const handleNext = () => {
    if (isLastTourStep(stepIndex)) {
      onComplete();
      return;
    }
    const next = getNextTourStepIndex(stepIndex);
    if (next === null) {
      onComplete();
      return;
    }
    const reachable = findNextReachableStepIndex(next);
    if (reachable === null) {
      onComplete();
      return;
    }
    setStepIndex(reachable);
  };

  if (!open || !currentStep || !rect) return null;

  return createPortal(
    <>
      <SpotlightOverlay rect={rect} />
      <TourBubble
        step={currentStep}
        stepIndex={stepIndex}
        rect={rect}
        onNext={handleNext}
        onDismiss={onComplete}
      />
    </>,
    document.body,
  );
}
