import { useEffect, useState } from 'react';

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 4;

export function clampTargetRectToViewport(
  rect: TargetRect,
  viewport = { width: window.innerWidth, height: window.innerHeight },
): TargetRect {
  let { top, left, width, height } = rect;

  if (left < 0) {
    width += left;
    left = 0;
  }
  if (top < 0) {
    height += top;
    top = 0;
  }
  if (left + width > viewport.width) {
    width = viewport.width - left;
  }
  if (top + height > viewport.height) {
    height = viewport.height - top;
  }

  return {
    top,
    left,
    width: Math.max(0, width),
    height: Math.max(0, height),
  };
}

export function measureTargetRect(element: Element | null): TargetRect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  const clamped = clampTargetRectToViewport({
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  });

  if (clamped.width <= 0 || clamped.height <= 0) return null;
  return clamped;
}

export function useTargetRect(selector: string | null, enabled: boolean): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (!enabled || !selector) {
      setRect(null);
      return;
    }

    const measure = () => {
      const element = document.querySelector(selector);
      setRect(measureTargetRect(element));
    };

    measure();

    const element = document.querySelector(selector);
    const resizeObserver =
      element && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : null;
    resizeObserver?.observe(element as Element);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector, enabled]);

  return rect;
}
