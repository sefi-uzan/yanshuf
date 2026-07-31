import type { AppSettings } from '@yanshuf/shared';
import { Switch } from '@yanshuf/ui';
import { RecordingExclusionsField } from './RecordingExclusionsField';
import {
  NumberField,
  SettingsCard,
  SettingsSection,
  SettingsToggle,
} from './SettingsLayout';

const BYTES_PER_MB = 1024 * 1024;

interface CaptureSettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

export function CaptureSettings({ settings, onUpdate }: CaptureSettingsProps) {
  return (
    <div className="space-y-6">
      <SettingsSection title="Proxy" description="Where Yanshuf listens and what it routes.">
        <SettingsCard className="divide-y p-0">
          <div className="grid grid-cols-3 gap-3 p-3">
            <NumberField
              id="proxy-port"
              label="Port"
              min={1024}
              max={65535}
              value={settings.port}
              onCommit={(port) => onUpdate({ port })}
            />
            <NumberField
              id="ring-buffer-size"
              label="Max entries"
              min={100}
              step={100}
              value={settings.ringBufferSize}
              onCommit={(ringBufferSize) => onUpdate({ ringBufferSize })}
            />
            <NumberField
              id="max-body-size"
              label="Max body (MB)"
              min={1}
              step={1}
              value={Math.round(settings.maxBodySize / BYTES_PER_MB)}
              onCommit={(mb) => onUpdate({ maxBodySize: Math.max(1, mb) * BYTES_PER_MB })}
            />
          </div>

          <SettingsToggle
            label="Capture localhost"
            description="Route localhost traffic through the proxy and show it in the request list. Some apps still ignore the system proxy for localhost."
          >
            <Switch
              checked={settings.captureLocalhost}
              onCheckedChange={(captureLocalhost) => onUpdate({ captureLocalhost })}
            />
          </SettingsToggle>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Never record"
        description="Hosts that stay out of the request list entirely. They are still forwarded normally — this only stops Yanshuf from storing them. To filter what you're looking at right now, use the filter bar above the request list instead."
      >
        <SettingsCard className="p-3">
          <RecordingExclusionsField
            exclusions={settings.recordingExclusions}
            onChange={(recordingExclusions) => onUpdate({ recordingExclusions })}
          />
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
