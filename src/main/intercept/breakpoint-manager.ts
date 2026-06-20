import { EventEmitter } from 'node:events';
import type { BreakpointDecision, BreakpointSnapshot } from '../../shared/types';

interface PendingBreakpoint {
  snapshot: BreakpointSnapshot;
  resolve: (decision: BreakpointDecision) => void;
}

export class BreakpointManager extends EventEmitter {
  private pending = new Map<string, PendingBreakpoint>();

  wait(snapshot: BreakpointSnapshot): Promise<BreakpointDecision> {
    if (this.pending.has(snapshot.id)) {
      return Promise.resolve({ action: 'abort' });
    }
    return new Promise((resolve) => {
      this.pending.set(snapshot.id, { snapshot, resolve });
      this.emit('hit', snapshot);
    });
  }

  continue(id: string, modifications?: BreakpointSnapshot['modifications']): boolean {
    const pending = this.pending.get(id);
    if (!pending) return false;
    this.pending.delete(id);
    pending.resolve({ action: 'continue', modifications });
    return true;
  }

  abort(id: string): boolean {
    const pending = this.pending.get(id);
    if (!pending) return false;
    this.pending.delete(id);
    pending.resolve({ action: 'abort' });
    return true;
  }

  clear(): void {
    for (const pending of this.pending.values()) {
      pending.resolve({ action: 'abort' });
    }
    this.pending.clear();
  }
}
