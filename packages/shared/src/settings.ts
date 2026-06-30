import {
  DEFAULT_CAPTURE_FILTER,
  DEFAULT_SETTINGS,
  DEFAULT_THROTTLE,
  type AppSettings,
} from './types';

type StoredSettings = Partial<
  AppSettings & {
    systemProxyEnabled?: boolean;
    proxyRunning?: boolean;
  }
>;

export function normalizeAppSettings(stored: StoredSettings): AppSettings {
  const { systemProxyEnabled, proxyRunning, ...rest } = stored;

  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...rest,
    captureFilter: {
      ...DEFAULT_CAPTURE_FILTER,
      ...stored.captureFilter,
    },
    throttle: {
      ...DEFAULT_THROTTLE,
      ...stored.throttle,
    },
    captureLocalhost: stored.captureLocalhost ?? DEFAULT_SETTINGS.captureLocalhost,
    capturing:
      typeof stored.capturing === 'boolean'
        ? stored.capturing
        : Boolean(proxyRunning && systemProxyEnabled),
  };

  return settings;
}
