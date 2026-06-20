import { useCallback, useEffect, useRef } from 'react';
import type { CaptureEntrySummary } from '../../../shared/types';

function oldestAwaiting(entries: CaptureEntrySummary[]): CaptureEntrySummary | undefined {
  const awaiting = entries.filter((entry) => entry.awaitingBreakpoint);
  if (awaiting.length === 0) return undefined;
  return awaiting.reduce((oldest, entry) => (entry.startedAt < oldest.startedAt ? entry : oldest));
}

export function useBreakpointNavigation({
  entries,
  selectedId,
  onSelect,
  onNavigateToCapture,
}: {
  entries: CaptureEntrySummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNavigateToCapture?: () => void;
}) {
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const navigateToOldestAwaiting = useCallback((nextEntries: CaptureEntrySummary[]) => {
    const target = oldestAwaiting(nextEntries);
    if (!target) return;
    onSelect(target.id);
    onNavigateToCapture?.();
  }, [onNavigateToCapture, onSelect]);

  useEffect(() => {
    return window.yanshuf.intercept.onBreakpoint(() => {
      void window.yanshuf.capture.list().then((next) => {
        const selectedIsAwaiting = selectedIdRef.current
          && next.some((entry) => entry.id === selectedIdRef.current && entry.awaitingBreakpoint);
        if (!selectedIsAwaiting) {
          navigateToOldestAwaiting(next);
        }
      });
    });
  }, [navigateToOldestAwaiting]);

  const handleBreakpointResolved = useCallback(() => {
    void window.yanshuf.capture.list().then((next) => {
      navigateToOldestAwaiting(next);
    });
  }, [navigateToOldestAwaiting]);

  return { handleBreakpointResolved };
}
