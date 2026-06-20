import type { CSSProperties } from 'react';
import type { TargetRect } from './useTargetRect';
import type { TourPlacement } from './tour-steps';

export const BUBBLE_WIDTH = 320;
export const BUBBLE_GAP = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function getBubbleStyle(
  rect: TargetRect,
  placement: TourPlacement,
  viewport = { width: window.innerWidth, height: window.innerHeight },
): CSSProperties {
  const { width: vw, height: vh } = viewport;

  const style: CSSProperties = {
    position: 'fixed',
    width: BUBBLE_WIDTH,
    zIndex: 9999,
  };

  const centerLeft = clamp(rect.left + rect.width / 2 - BUBBLE_WIDTH / 2, 12, vw - BUBBLE_WIDTH - 12);

  switch (placement) {
    case 'top':
      style.left = centerLeft;
      style.bottom = clamp(vh - rect.top + BUBBLE_GAP, 12, vh - 12);
      break;
    case 'bottom':
      style.left = centerLeft;
      style.top = clamp(rect.top + rect.height + BUBBLE_GAP, 12, vh - 12);
      break;
    case 'right':
      style.left = clamp(rect.left + rect.width + BUBBLE_GAP, 12, vw - BUBBLE_WIDTH - 12);
      style.top = clamp(rect.top + Math.min(56, rect.height * 0.12), 12, vh - 12);
      break;
    case 'left':
      style.left = clamp(rect.left - BUBBLE_WIDTH - BUBBLE_GAP, 12, vw - BUBBLE_WIDTH - 12);
      style.top = clamp(rect.top + Math.min(56, rect.height * 0.12), 12, vh - 12);
      break;
  }

  return style;
}
