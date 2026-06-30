export type TourPlacement = 'top' | 'right' | 'bottom' | 'left';

export interface TourStep {
  target: string;
  content: string;
  placement: TourPlacement;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="status-bar-toggles"]',
    content: 'Turn this on to start capturing requests.',
    placement: 'top',
  },
  {
    target: '[data-tour="capture-area"]',
    content: 'This is where you see your requests. Click on a request to get started.',
    placement: 'right',
  },
  {
    target: '[data-tour="rules-composer"]',
    content: 'This is where you make requests or mock responses.',
    placement: 'bottom',
  },
];

export function getTourStepCount(steps: TourStep[] = TOUR_STEPS): number {
  return steps.length;
}

export function isLastTourStep(stepIndex: number, steps: TourStep[] = TOUR_STEPS): boolean {
  return stepIndex >= steps.length - 1;
}

export function getNextTourStepIndex(stepIndex: number, steps: TourStep[] = TOUR_STEPS): number | null {
  if (isLastTourStep(stepIndex, steps)) return null;
  return stepIndex + 1;
}

export function findNextReachableStepIndex(
  startIndex: number,
  steps: TourStep[] = TOUR_STEPS,
  querySelector: (selector: string) => Element | null = (selector) =>
    typeof document !== 'undefined' ? document.querySelector(selector) : null,
): number | null {
  for (let i = startIndex; i < steps.length; i += 1) {
    if (querySelector(steps[i].target)) return i;
  }
  return null;
}
