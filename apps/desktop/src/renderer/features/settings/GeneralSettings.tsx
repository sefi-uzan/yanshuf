import type { ComponentProps } from 'react';
import type { CaptureFilterMode, ThrottlePreset } from '@yanshuf/shared';
import { THROTTLE_PRESET_VALUES } from '@yanshuf/shared';
import { Input, Switch } from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import { CaptureFilterFields } from './CaptureFilterFields';
import { SettingsCard, SettingsField, SettingsSection } from './SettingsLayout';

const THROTTLE_PRESET_OPTIONS: { value: ThrottlePreset; label: string }[] = [
  { value: 'edge', label: 'Edge' },
  { value: '3g', label: '3G' },
  { value: 'regular-3g', label: 'Regular 3G' },
  { value: 'regular-4g', label: 'Regular 4G' },
  { value: 'custom', label: 'Custom' },
];

interface GeneralSettingsProps {
  port: number;
  ringBufferSize: number;
  maxBodySizeMb: number;
  filterMode: CaptureFilterMode;
  filterUrls: string;
  captureLocalhost: boolean;
  throttleEnabled: boolean;
  throttlePreset: ThrottlePreset;
  throttleLatencyMs: number;
  throttleDownloadKbps: number;
  throttleUploadKbps: number;
  onPortChange: (port: number) => void;
  onRingBufferSizeChange: (size: number) => void;
  onMaxBodySizeMbChange: (mb: number) => void;
  onFilterModeChange: (mode: CaptureFilterMode) => void;
  onFilterUrlsChange: (urls: string) => void;
  onCaptureLocalhostChange: (enabled: boolean) => void;
  onThrottleEnabledChange: (enabled: boolean) => void;
  onThrottlePresetChange: (preset: ThrottlePreset) => void;
  onThrottleLatencyMsChange: (ms: number) => void;
  onThrottleDownloadKbpsChange: (kbps: number) => void;
  onThrottleUploadKbpsChange: (kbps: number) => void;
}

export function GeneralSettings({
  port,
  ringBufferSize,
  maxBodySizeMb,
  filterMode,
  filterUrls,
  captureLocalhost,
  throttleEnabled,
  throttlePreset,
  throttleLatencyMs,
  throttleDownloadKbps,
  throttleUploadKbps,
  onPortChange,
  onRingBufferSizeChange,
  onMaxBodySizeMbChange,
  onFilterModeChange,
  onFilterUrlsChange,
  onCaptureLocalhostChange,
  onThrottleEnabledChange,
  onThrottlePresetChange,
  onThrottleLatencyMsChange,
  onThrottleDownloadKbpsChange,
  onThrottleUploadKbpsChange,
}: GeneralSettingsProps) {
  const customThrottle = throttlePreset === 'custom';

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Capture"
        description="Proxy port, storage limits, and localhost routing."
      >
        <SettingsCard className="divide-y p-0">
          <div className="p-3">
            <div className="grid grid-cols-3 gap-3">
              <CompactField
                id="proxy-port"
                label="Port"
                type="number"
                min={1024}
                max={65535}
                value={port}
                onChange={(value) => onPortChange(Number(value))}
              />
              <CompactField
                id="ring-buffer-size"
                label="Max entries"
                type="number"
                min={100}
                step={100}
                value={ringBufferSize}
                onChange={(value) => onRingBufferSizeChange(Number(value))}
              />
              <CompactField
                id="max-body-size"
                label="Max body (MB)"
                type="number"
                min={1}
                step={1}
                value={maxBodySizeMb}
                onChange={(value) => onMaxBodySizeMbChange(Number(value))}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Capture localhost</p>
              <p className="text-xs text-muted-foreground">
                Route localhost traffic through the proxy and show it in the request list. Some apps
                still ignore system proxy for localhost.
              </p>
            </div>
            <Switch checked={captureLocalhost} onCheckedChange={onCaptureLocalhostChange} />
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Filters"
        description="Control which requests appear in the capture list."
      >
        <SettingsCard className="p-3">
          <CaptureFilterFields
            compact
            filterMode={filterMode}
            filterUrls={filterUrls}
            onFilterModeChange={onFilterModeChange}
            onFilterUrlsChange={onFilterUrlsChange}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Network throttling"
        description="Simulate slow networks for proxied traffic. Mock rules are not throttled."
      >
        <SettingsCard className="divide-y p-0">
          <div className="flex items-start justify-between gap-3 p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Enable throttling</p>
              <p className="text-xs text-muted-foreground">
                Adds latency and bandwidth limits to passthrough requests.
              </p>
            </div>
            <Switch checked={throttleEnabled} onCheckedChange={onThrottleEnabledChange} />
          </div>

          <div className="space-y-3 p-3">
            <SettingsField id="throttle-preset" label="Preset">
              <select
                id="throttle-preset"
                className={cn(
                  'flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                value={throttlePreset}
                onChange={(e) => {
                  const preset = e.target.value as ThrottlePreset;
                  onThrottlePresetChange(preset);
                  if (preset !== 'custom') {
                    const values = THROTTLE_PRESET_VALUES[preset];
                    onThrottleLatencyMsChange(values.latencyMs);
                    onThrottleDownloadKbpsChange(values.downloadKbps);
                    onThrottleUploadKbpsChange(values.uploadKbps);
                  }
                }}
              >
                {THROTTLE_PRESET_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </SettingsField>

            <div className="grid grid-cols-3 gap-3">
              <CompactField
                id="throttle-latency"
                label="Latency (ms)"
                type="number"
                min={0}
                step={10}
                value={throttleLatencyMs}
                disabled={!customThrottle}
                onChange={(value) => {
                  onThrottlePresetChange('custom');
                  onThrottleLatencyMsChange(Number(value));
                }}
              />
              <CompactField
                id="throttle-download"
                label="Download (KB/s)"
                type="number"
                min={0}
                step={10}
                value={throttleDownloadKbps}
                disabled={!customThrottle}
                onChange={(value) => {
                  onThrottlePresetChange('custom');
                  onThrottleDownloadKbpsChange(Number(value));
                }}
              />
              <CompactField
                id="throttle-upload"
                label="Upload (KB/s)"
                type="number"
                min={0}
                step={10}
                value={throttleUploadKbps}
                disabled={!customThrottle}
                onChange={(value) => {
                  onThrottlePresetChange('custom');
                  onThrottleUploadKbpsChange(Number(value));
                }}
              />
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}

function CompactField({
  id,
  label,
  value,
  onChange,
  disabled,
  ...inputProps
}: {
  id: string;
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: string) => void;
} & Omit<ComponentProps<typeof Input>, 'id' | 'value' | 'onChange' | 'className' | 'disabled'>) {
  return (
    <label htmlFor={id} className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        id={id}
        className="h-8"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
    </label>
  );
}
