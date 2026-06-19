import { useState, type ReactNode } from 'react';
import { CAPTURE_DRAG_MIME } from '../../shared/dnd';
import { cn } from '@/lib/utils';

interface DropCaptureZoneProps {
  children: ReactNode;
  onDropCapture: (entryId: string) => void;
  className?: string;
  activeClassName?: string;
  hint?: string;
}

export function DropCaptureZone({
  children,
  onDropCapture,
  className,
  activeClassName,
  hint,
}: DropCaptureZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={cn(
        'relative h-full min-h-0',
        className,
        dragOver && (activeClassName ?? 'ring-2 ring-inset ring-primary/50 bg-primary/5'),
      )}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(CAPTURE_DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData(CAPTURE_DRAG_MIME);
        if (id) onDropCapture(id);
      }}
    >
      {dragOver && hint && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 mx-auto w-fit rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
          {hint}
        </div>
      )}
      {children}
    </div>
  );
}
