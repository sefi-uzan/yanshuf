import { describe, expect, it } from 'vitest';
import {
  findNextReachableStepIndex,
  getNextTourStepIndex,
  getTourStepCount,
  isLastTourStep,
  TOUR_STEPS,
} from '../../src/renderer/features/guided-tour/tour-steps';

describe('guided tour steps', () => {
  it('defines three steps with stable selectors', () => {
    expect(getTourStepCount()).toBe(3);
    expect(TOUR_STEPS.map((step) => step.target)).toEqual([
      '[data-tour="status-bar-toggles"]',
      '[data-tour="capture-area"]',
      '[data-tour="rules-composer"]',
    ]);
  });

  it('identifies the last step', () => {
    expect(isLastTourStep(0)).toBe(false);
    expect(isLastTourStep(1)).toBe(false);
    expect(isLastTourStep(2)).toBe(true);
  });

  it('advances to the next step index', () => {
    expect(getNextTourStepIndex(0)).toBe(1);
    expect(getNextTourStepIndex(1)).toBe(2);
    expect(getNextTourStepIndex(2)).toBeNull();
  });

  it('finds the next reachable step from a custom query', () => {
    const present = new Set(['[data-tour="capture-area"]', '[data-tour="rules-composer"]']);
    const querySelector = (selector: string) => (present.has(selector) ? ({} as Element) : null);

    expect(findNextReachableStepIndex(0, TOUR_STEPS, querySelector)).toBe(1);
    expect(findNextReachableStepIndex(1, TOUR_STEPS, querySelector)).toBe(1);
    expect(findNextReachableStepIndex(2, TOUR_STEPS, querySelector)).toBe(2);
    expect(findNextReachableStepIndex(3, TOUR_STEPS, querySelector)).toBeNull();
  });

  it('returns null when no steps are reachable', () => {
    expect(findNextReachableStepIndex(0, TOUR_STEPS, () => null)).toBeNull();
  });
});

describe('getBubbleStyle', () => {
  it('anchors top placement just above the target using bottom offset', async () => {
    const { getBubbleStyle } = await import('../../src/renderer/features/guided-tour/tour-bubble');
    const rect = { top: 700, left: 100, width: 400, height: 40 };
    const style = getBubbleStyle(rect, 'top', { width: 1200, height: 800 });

    expect(style.bottom).toBe(800 - 700 + 8);
    expect(style.transform).toBeUndefined();
  });

  it('places bottom placement just below the target', async () => {
    const { getBubbleStyle } = await import('../../src/renderer/features/guided-tour/tour-bubble');
    const rect = { top: 48, left: 500, width: 200, height: 32 };
    const style = getBubbleStyle(rect, 'bottom', { width: 1200, height: 800 });

    expect(style.top).toBe(48 + 32 + 8);
  });

  it('places right placement beside the target near the top edge', async () => {
    const { getBubbleStyle } = await import('../../src/renderer/features/guided-tour/tour-bubble');
    const rect = { top: 80, left: 0, width: 360, height: 600 };
    const style = getBubbleStyle(rect, 'right', { width: 1200, height: 800 });

    expect(style.left).toBe(360 + 8);
    expect(style.top).toBe(80 + 56);
  });
});

describe('clampTargetRectToViewport', () => {
  it('keeps left edge inside the viewport when padding would overflow', async () => {
    const { clampTargetRectToViewport } = await import(
      '../../src/renderer/features/guided-tour/useTargetRect'
    );
    const clamped = clampTargetRectToViewport(
      { top: 80, left: -4, width: 364, height: 600 },
      { width: 1200, height: 800 },
    );

    expect(clamped.left).toBe(0);
    expect(clamped.width).toBe(360);
  });
});
