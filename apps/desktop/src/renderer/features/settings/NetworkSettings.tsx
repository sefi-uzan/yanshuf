import type { AppSettings, ThrottlePreset } from '@yanshuf/shared';
import { THROTTLE_PRESET_VALUES } from '@yanshuf/shared';
import { Switch } from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import {
  NumberField,
  SettingsCard,
  SettingsField,
  SettingsSection,
  SettingsToggle,
} from './SettingsLayout';

const THROTTLE_PRESET_OPTIONS: { value: ThrottlePreset; label: string }[] = [
  { value: 'edge', label: 'Edge' },
  { value: '3g', label: '3G' },
  { value: 'regular-3g', label: 'Regular 3G' },
  { value: 'regular-4g', label: 'Regular 4G' },
  { value: 'custom', label: 'Custom' },
];

interface NetworkSettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export function NetworkSettings({ settings, onUpdate }: NetworkSettingsProps) {
  const { throttle } = settings;
  const customThrottle = throttle.preset === 'custom';

  const updateThrottle = (patch: Partial<AppSettings['throttle']>) => {
    onUpdate({ throttle: { ...throttle, ...patch } });
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Network throttling"
        description="Simulate slow networks for proxied traffic. Mock rules are not throttled."
      >
        <SettingsCard className="divide-y p-0">
          <SettingsToggle
            label="Enable throttling"
            description="Adds latency and bandwidth limits to passthrough requests."
          >
            <Switch
              checked={throttle.enabled}
              onCheckedChange={(enabled) => updateThrottle({ enabled })}
            />
          </SettingsToggle>

          <div className="space-y-3 p-3">
            <SettingsField id="throttle-preset" label="Preset">
              <select
                id="throttle-preset"
                className={cn(
                  'flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                value={throttle.preset}
                onChange={(e) => {
                  const preset = e.target.value as ThrottlePreset;
                  if (preset === 'custom') {
                    updateThrottle({ preset });
                    return;
                  }
                  updateThrottle({ preset, ...THROTTLE_PRESET_VALUES[preset] });
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
              <NumberField
                id="throttle-latency"
                label="Latency (ms)"
                min={0}
                step={10}
                value={throttle.latencyMs}
                disabled={!customThrottle}
                onCommit={(latencyMs) => updateThrottle({ preset: 'custom', latencyMs })}
              />
              <NumberField
                id="throttle-download"
                label="Download (KB/s)"
                min={0}
                step={10}
                value={throttle.downloadKbps}
                disabled={!customThrottle}
                onCommit={(downloadKbps) => updateThrottle({ preset: 'custom', downloadKbps })}
              />
              <NumberField
                id="throttle-upload"
                label="Upload (KB/s)"
                min={0}
                step={10}
                value={throttle.uploadKbps}
                disabled={!customThrottle}
                onCommit={(uploadKbps) => updateThrottle({ preset: 'custom', uploadKbps })}
              />
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
