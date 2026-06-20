import type { TargetRect } from './useTargetRect';

interface SpotlightOverlayProps {
  rect: TargetRect;
}

export function SpotlightOverlay({ rect }: SpotlightOverlayProps) {
  const { top, left, width, height } = rect;
  const bottom = top + height;
  const right = left + width;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  return (
    <div className="fixed inset-0 z-[9998]">
      <div
        className="absolute left-0 right-0 top-0 bg-black/60"
        style={{ height: Math.max(0, top) }}
      />
      <div
        className="absolute left-0 bg-black/60"
        style={{ top, width: Math.max(0, left), height }}
      />
      <div
        className="absolute bg-black/60"
        style={{ top, left: right, width: Math.max(0, viewportWidth - right), height }}
      />
      <div
        className="absolute left-0 right-0 bg-black/60"
        style={{ top: bottom, height: Math.max(0, viewportHeight - bottom) }}
      />
      <div
        className="pointer-events-none absolute rounded-md"
        style={{
          top,
          left,
          width,
          height,
          boxShadow: 'inset 0 0 0 2px hsl(var(--primary))',
        }}
      />
    </div>
  );
}
