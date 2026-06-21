import { describe, expect, it } from 'vitest';
import { mergeThrottleSettings, resolveThrottleSettings, THROTTLE_PRESET_VALUES } from '@yanshuf/shared';
import { DEFAULT_THROTTLE } from '@yanshuf/shared';

describe('throttle settings', () => {
  it('resolves preset values', () => {
    const resolved = resolveThrottleSettings({
      enabled: true,
      preset: 'edge',
      latencyMs: 0,
      downloadKbps: 0,
      uploadKbps: 0,
    });
    expect(resolved.latencyMs).toBe(THROTTLE_PRESET_VALUES.edge.latencyMs);
  });

  it('disables throttle when patch sets enabled false', () => {
    const next = mergeThrottleSettings(
      { ...DEFAULT_THROTTLE, enabled: true },
      { enabled: false },
    );
    expect(next.enabled).toBe(false);
  });

  it('applies preset values when preset changes', () => {
    const next = mergeThrottleSettings(DEFAULT_THROTTLE, { preset: 'regular-4g', enabled: true });
    expect(next.preset).toBe('regular-4g');
    expect(next.downloadKbps).toBe(THROTTLE_PRESET_VALUES['regular-4g'].downloadKbps);
  });
});
