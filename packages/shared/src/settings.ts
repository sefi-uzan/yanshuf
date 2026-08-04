import {
  DEFAULT_RECORDING_SCOPE,
  DEFAULT_SETTINGS,
  DEFAULT_THROTTLE,
  type AppSettings,
  type LegacyCaptureFilterSettings,
  type RecordingScope,
} from './types';
import { formatCaptureQuery, type QueryTerm } from './capture-query';

type StoredSettings = Partial<
  AppSettings & {
    systemProxyEnabled?: boolean;
    proxyRunning?: boolean;
    /** Pre-overhaul include/exclude glob filter. */
    captureFilter?: LegacyCaptureFilterSettings;
    /** Denylist-only predecessor of `recordingScope`. */
    recordingExclusions?: string[];
  }
>;

/** The old denylist is exactly today's scope in `exclude` mode. */
function readRecordingScope(stored: StoredSettings): RecordingScope {
  const scope = stored.recordingScope;
  if (scope && Array.isArray(scope.patterns)) {
    return { mode: scope.mode === 'include' ? 'include' : 'exclude', patterns: scope.patterns };
  }
  if (Array.isArray(stored.recordingExclusions)) {
    return { mode: 'exclude', patterns: stored.recordingExclusions };
  }
  return DEFAULT_RECORDING_SCOPE;
}

/**
 * The old capture filter dropped requests at record time. Its patterns become a
 * view query instead of exclusions: nothing is silently discarded, and the user
 * sees the filter in the new bar where it can be edited or cleared.
 */
export function migrateCaptureFilterToQuery(
  filter: LegacyCaptureFilterSettings | undefined,
): string | undefined {
  const patterns = (filter?.urls ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  if (patterns.length === 0) return undefined;

  const negated = filter?.mode === 'exclude';
  const terms: QueryTerm[] = patterns.map((value) => ({ field: 'host', value, negated }));
  return formatCaptureQuery({ terms });
}

export function normalizeAppSettings(stored: StoredSettings): AppSettings {
  const { systemProxyEnabled, proxyRunning, captureFilter, recordingExclusions, ...rest } = stored;

  const migratedViewQuery = stored.migratedViewQuery ?? migrateCaptureFilterToQuery(captureFilter);

  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...rest,
    recordingScope: readRecordingScope(stored),
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

  if (migratedViewQuery) settings.migratedViewQuery = migratedViewQuery;
  else delete settings.migratedViewQuery;

  return settings;
}
