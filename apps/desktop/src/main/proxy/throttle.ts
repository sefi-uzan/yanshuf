import type { ThrottleSettings } from '@yanshuf/shared';
import { resolveThrottleSettings } from '@yanshuf/shared';

export interface ThrottleConfig {
  enabled: boolean;
  latencyMs: number;
  downloadKbps: number;
  uploadKbps: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class BandwidthLimiter {
  private nextAvailableAt = 0;

  constructor(private kbps: number) {}

  setKbps(kbps: number): void {
    this.kbps = kbps;
  }

  async waitForBytes(byteCount: number): Promise<void> {
    if (this.kbps <= 0 || byteCount <= 0) return;

    const bytesPerMs = (this.kbps * 1024) / 1000;
    const durationMs = byteCount / bytesPerMs;
    const now = Date.now();
    const startAt = Math.max(now, this.nextAvailableAt);
    this.nextAvailableAt = startAt + durationMs;
    const waitMs = startAt - now;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
  }
}

/** Per-connection upload/download limiters (Fiddler-style session throttling). */
export class SessionThrottle {
  private uploadLimiter: BandwidthLimiter;
  private downloadLimiter: BandwidthLimiter;

  constructor(uploadKbps: number, downloadKbps: number) {
    this.uploadLimiter = new BandwidthLimiter(uploadKbps);
    this.downloadLimiter = new BandwidthLimiter(downloadKbps);
  }

  async throttleUpload(chunk: Buffer): Promise<void> {
    await this.uploadLimiter.waitForBytes(chunk.length);
  }

  async throttleDownload(chunk: Buffer): Promise<void> {
    await this.downloadLimiter.waitForBytes(chunk.length);
  }
}

export function toThrottleConfig(settings: ThrottleSettings): ThrottleConfig {
  const resolved = resolveThrottleSettings(settings);
  return {
    enabled: resolved.enabled,
    latencyMs: resolved.latencyMs,
    downloadKbps: resolved.downloadKbps,
    uploadKbps: resolved.uploadKbps,
  };
}

export class ThrottleController {
  private config: ThrottleConfig;

  constructor(config: ThrottleConfig) {
    this.config = config;
  }

  update(config: ThrottleConfig): void {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  createSessionLimiters(): SessionThrottle | undefined {
    if (!this.config.enabled) return undefined;
    return new SessionThrottle(this.config.uploadKbps, this.config.downloadKbps);
  }

  async applyLatency(): Promise<void> {
    if (!this.config.enabled || this.config.latencyMs <= 0) return;
    await sleep(this.config.latencyMs);
  }
}
