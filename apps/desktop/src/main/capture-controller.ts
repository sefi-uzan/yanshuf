import type { AppSettings, ProxyStatus } from '@yanshuf/shared';
import { isCaptureFilterActive, parseFilterPatterns, resolveThrottleSettings } from '@yanshuf/shared';
import type { CertificateManager } from './cert/manager';
import { assertCertTrusted } from './cert/cert-gate';
import type { CaptureStore } from './proxy/capture-store';
import type { ProxyServer } from './proxy/server';
import type { SystemProxyManager } from './system-proxy/macos';

export interface CaptureControllerDeps {
  settings: AppSettings;
  saveSettings: () => Promise<void>;
  systemProxy: SystemProxyManager;
  proxyServer: ProxyServer;
  certManager: CertificateManager;
  captureStore: CaptureStore;
}

export class CaptureController {
  constructor(private readonly deps: CaptureControllerDeps) {}

  isCapturing(): boolean {
    return this.deps.systemProxy.isEnabled() && this.deps.proxyServer.isRunning();
  }

  getStatus(): ProxyStatus {
    const filter = this.deps.settings.captureFilter;
    return {
      running: this.isCapturing(),
      port: this.deps.settings.port,
      entryCount: this.deps.captureStore.count,
      throttle: resolveThrottleSettings(this.deps.settings.throttle),
      captureFilter: {
        active: isCaptureFilterActive(filter),
        mode: filter.mode,
        patternCount: parseFilterPatterns(filter.urls).length,
        hiddenCount: this.deps.proxyServer.getHiddenCount(),
      },
    };
  }

  async setCapturing(enabled: boolean): Promise<void> {
    if (enabled) {
      if (this.isCapturing()) return;
      await assertCertTrusted(this.deps.certManager);
      await this.deps.systemProxy.enable('127.0.0.1', this.deps.settings.port, {
        captureLocalhost: this.deps.settings.captureLocalhost,
      });
      await this.deps.proxyServer.start();
      this.deps.settings.capturing = true;
    } else {
      if (this.deps.proxyServer.isRunning()) {
        await this.deps.proxyServer.stop();
      }
      if (this.deps.systemProxy.isEnabled()) {
        await this.deps.systemProxy.disable();
      }
      this.deps.settings.capturing = false;
    }
    await this.deps.saveSettings();
  }

  async toggle(): Promise<void> {
    await this.setCapturing(!this.isCapturing());
  }

  async restoreOnLaunch(): Promise<void> {
    if (this.deps.settings.capturing) {
      try {
        await this.setCapturing(true);
      } catch {
        await this.setCapturing(false);
      }
      return;
    }

    await this.deps.systemProxy.releaseIfPointingAt('127.0.0.1', this.deps.settings.port);
    if (this.deps.proxyServer.isRunning()) {
      await this.deps.proxyServer.stop();
    }
  }

  async withProxyServer<T>(fn: () => Promise<T>): Promise<T> {
    const wasRunning = this.deps.proxyServer.isRunning();
    if (!wasRunning) {
      await assertCertTrusted(this.deps.certManager);
      await this.deps.proxyServer.start();
    }

    try {
      return await fn();
    } finally {
      if (!wasRunning && !this.isCapturing()) {
        await this.deps.proxyServer.stop();
      }
    }
  }

  async updateCaptureLocalhost(): Promise<void> {
    if (!this.isCapturing()) return;
    await this.deps.systemProxy.updateCaptureLocalhost(
      this.deps.settings.captureLocalhost,
      '127.0.0.1',
      this.deps.settings.port,
    );
  }

  async applyPortChange(): Promise<void> {
    if (!this.isCapturing()) return;

    await this.deps.systemProxy.updatePort('127.0.0.1', this.deps.settings.port, {
      captureLocalhost: this.deps.settings.captureLocalhost,
    });
    await this.deps.proxyServer.stop();
    try {
      await this.deps.proxyServer.start();
    } catch {
      await this.setCapturing(false);
    }
  }

  async shutdown(): Promise<void> {
    await this.setCapturing(false);
  }
}
