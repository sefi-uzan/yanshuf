import type { ThrottlePreset, ThrottleSettings } from './types';

export const THROTTLE_PRESET_VALUES: Record<
  Exclude<ThrottlePreset, 'custom'>,
  Pick<ThrottleSettings, 'latencyMs' | 'downloadKbps' | 'uploadKbps'>
> = {
  edge: { latencyMs: 840, downloadKbps: 240, uploadKbps: 200 },
  '3g': { latencyMs: 200, downloadKbps: 780, uploadKbps: 330 },
  'regular-3g': { latencyMs: 100, downloadKbps: 1500, uploadKbps: 750 },
  'regular-4g': { latencyMs: 20, downloadKbps: 9000, uploadKbps: 9000 },
};

export function resolveThrottleSettings(settings: ThrottleSettings): ThrottleSettings {
  if (settings.preset === 'custom') {
    return settings;
  }
  const preset = THROTTLE_PRESET_VALUES[settings.preset];
  return {
    ...settings,
    latencyMs: preset.latencyMs,
    downloadKbps: preset.downloadKbps,
    uploadKbps: preset.uploadKbps,
  };
}

export function mergeThrottleSettings(
  current: ThrottleSettings,
  patch: Partial<ThrottleSettings> | null | undefined,
): ThrottleSettings {
  if (patch === null || patch?.enabled === false) {
    return { ...current, enabled: false };
  }
  if (!patch) return current;

  const next: ThrottleSettings = {
    ...current,
    ...patch,
    enabled: patch.enabled ?? current.enabled,
    preset: patch.preset ?? current.preset,
  };

  if (next.preset !== 'custom' && patch.preset !== undefined && patch.preset !== 'custom') {
    const preset = THROTTLE_PRESET_VALUES[next.preset];
    next.latencyMs = preset.latencyMs;
    next.downloadKbps = preset.downloadKbps;
    next.uploadKbps = preset.uploadKbps;
  }

  return next;
}
