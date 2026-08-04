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

  it('defaults the recording scope to recording everything', () => {
    expect(normalizeAppSettings({}).recordingScope).toEqual({ mode: 'exclude', patterns: [] });
  });

  it('preserves an explicit recording scope', () => {
    expect(
      normalizeAppSettings({ recordingScope: { mode: 'include', patterns: ['*.x.com'] } })
        .recordingScope,
    ).toEqual({ mode: 'include', patterns: ['*.x.com'] });
  });

  it('reads the pre-scope exclusion list as exclude mode', () => {
    const settings = normalizeAppSettings({ recordingExclusions: ['*.x.com'] });

    expect(settings.recordingScope).toEqual({ mode: 'exclude', patterns: ['*.x.com'] });
    expect(settings).not.toHaveProperty('recordingExclusions');
  });

  describe('capture filter migration', () => {
    it('turns an old exclude filter into a negated view query', () => {
      const settings = normalizeAppSettings({
        captureFilter: { mode: 'exclude', urls: '*.analytics.com' },
      });

      expect(settings.migratedViewQuery).toBe('-host:*.analytics.com');
      // Nothing is dropped at record time until the user opts in.
      expect(settings.recordingScope).toEqual({ mode: 'exclude', patterns: [] });
    });

    it('turns an old include filter into a positive view query', () => {
      const settings = normalizeAppSettings({
        captureFilter: { mode: 'include', urls: '*.google.com;*.example.com/api' },
      });

      expect(settings.migratedViewQuery).toBe('host:*.google.com host:*.example.com/api');
    });

    it('drops the legacy field from the normalized shape', () => {
      const settings = normalizeAppSettings({
        captureFilter: { mode: 'exclude', urls: '*.analytics.com' },
      });

      expect(settings).not.toHaveProperty('captureFilter');
    });

    it('emits nothing when there was no filter to migrate', () => {
      expect(normalizeAppSettings({}).migratedViewQuery).toBeUndefined();
      expect(
        normalizeAppSettings({ captureFilter: { mode: 'exclude', urls: '' } }).migratedViewQuery,
      ).toBeUndefined();
    });

    it('is a no-op once the renderer has consumed the query', () => {
      const settings = normalizeAppSettings({ recordingScope: { mode: 'exclude', patterns: [] } });
      expect(settings.migratedViewQuery).toBeUndefined();
    });
  });
});
