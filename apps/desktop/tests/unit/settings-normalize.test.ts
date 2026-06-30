import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeAppSettings } from '@yanshuf/shared';

describe('normalizeAppSettings', () => {
  it('defaults capturing to false', () => {
    expect(normalizeAppSettings({})).toMatchObject({
      capturing: false,
    });
  });

  it('preserves explicit capturing flag', () => {
    expect(normalizeAppSettings({ capturing: true }).capturing).toBe(true);
  });

  it('migrates legacy flags only when both were enabled', () => {
    expect(
      normalizeAppSettings({
        systemProxyEnabled: true,
        proxyRunning: true,
      }).capturing,
    ).toBe(true);
  });

  it('does not migrate inconsistent legacy system-proxy-only state', () => {
    expect(
      normalizeAppSettings({
        systemProxyEnabled: true,
        proxyRunning: false,
      }).capturing,
    ).toBe(false);
  });

  it('drops legacy fields from persisted settings shape', () => {
    const settings = normalizeAppSettings({
      ...DEFAULT_SETTINGS,
      systemProxyEnabled: true,
      proxyRunning: true,
    });

    expect(settings).not.toHaveProperty('systemProxyEnabled');
    expect(settings).not.toHaveProperty('proxyRunning');
  });
});
