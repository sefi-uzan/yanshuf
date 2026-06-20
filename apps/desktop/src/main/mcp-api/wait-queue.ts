import type { CaptureEntrySummary, BreakpointSnapshot } from '@yanshuf/shared';
import type { CaptureWaitParams } from '@yanshuf/shared';
import { MCP_WAIT_DEFAULT_TIMEOUT_MS, MCP_WAIT_MAX_TIMEOUT_MS, searchCaptures } from '@yanshuf/shared';

type CaptureWaiter = {
  params: CaptureWaitParams;
  sinceStartedAt?: number;
  resolve: (entry: CaptureEntrySummary | null) => void;
  timer: ReturnType<typeof setTimeout>;
};

type BreakpointWaiter = {
  resolve: (snapshot: BreakpointSnapshot | null) => void;
  timer: ReturnType<typeof setTimeout>;
};

function clampTimeout(ms?: number): number {
  const value = ms ?? MCP_WAIT_DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(value, 100), MCP_WAIT_MAX_TIMEOUT_MS);
}

function entryMatchesWaitParams(
  entry: CaptureEntrySummary,
  params: CaptureWaitParams,
  sinceStartedAt?: number,
): boolean {
  if (sinceStartedAt !== undefined && entry.startedAt <= sinceStartedAt) return false;
  const [match] = searchCaptures([entry], params);
  return Boolean(match);
}

export class McpWaitQueue {
  private captureWaiters: CaptureWaiter[] = [];
  private breakpointWaiters: BreakpointWaiter[] = [];

  notifyCapture(entry: CaptureEntrySummary): void {
    const remaining: CaptureWaiter[] = [];
    for (const waiter of this.captureWaiters) {
      if (entryMatchesWaitParams(entry, waiter.params, waiter.sinceStartedAt)) {
        clearTimeout(waiter.timer);
        waiter.resolve(entry);
      } else {
        remaining.push(waiter);
      }
    }
    this.captureWaiters = remaining;
  }

  notifyBreakpoint(snapshot: BreakpointSnapshot): void {
    for (const waiter of this.breakpointWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(snapshot);
    }
    this.breakpointWaiters = [];
  }

  waitForCapture(params: CaptureWaitParams, sinceStartedAt?: number): Promise<CaptureEntrySummary | null> {
    return new Promise((resolve) => {
      const timeoutMs = clampTimeout(params.timeoutMs);
      const timer = setTimeout(() => {
        this.captureWaiters = this.captureWaiters.filter((w) => w.resolve !== resolve);
        resolve(null);
      }, timeoutMs);

      this.captureWaiters.push({
        params,
        sinceStartedAt,
        resolve: (entry) => {
          clearTimeout(timer);
          resolve(entry);
        },
        timer,
      });
    });
  }

  waitForBreakpoint(timeoutMs?: number): Promise<BreakpointSnapshot | null> {
    return new Promise((resolve) => {
      const ms = clampTimeout(timeoutMs);
      const timer = setTimeout(() => {
        this.breakpointWaiters = this.breakpointWaiters.filter((w) => w.resolve !== resolve);
        resolve(null);
      }, ms);

      this.breakpointWaiters.push({
        resolve: (snapshot) => {
          clearTimeout(timer);
          resolve(snapshot);
        },
        timer,
      });
    });
  }

  clear(): void {
    for (const waiter of this.captureWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
    for (const waiter of this.breakpointWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
    this.captureWaiters = [];
    this.breakpointWaiters = [];
  }
}
