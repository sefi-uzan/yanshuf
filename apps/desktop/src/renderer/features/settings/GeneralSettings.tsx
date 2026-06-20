import type { ComponentProps } from 'react';
import type { CaptureFilterMode } from '@yanshuf/shared';
import { Input } from '@yanshuf/ui';
import { CaptureFilterFields } from './CaptureFilterFields';
import { SettingsCard, SettingsSection } from './SettingsLayout';

interface GeneralSettingsProps {
  port: number;
  ringBufferSize: number;
  maxBodySizeMb: number;
  filterMode: CaptureFilterMode;
  filterUrls: string;
  onPortChange: (port: number) => void;
  onRingBufferSizeChange: (size: number) => void;
  onMaxBodySizeMbChange: (mb: number) => void;
  onFilterModeChange: (mode: CaptureFilterMode) => void;
  onFilterUrlsChange: (urls: string) => void;
}

export function GeneralSettings({
  port,
  ringBufferSize,
  maxBodySizeMb,
  filterMode,
  filterUrls,
  onPortChange,
  onRingBufferSizeChange,
  onMaxBodySizeMbChange,
  onFilterModeChange,
  onFilterUrlsChange,
}: GeneralSettingsProps) {
  return (
    <SettingsSection
      title="Capture"
      description="Proxy limits and URL filters for the request list."
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

        <div className="p-3">
          <p className="mb-2 text-xs font-semibold tracking-tight">Filters</p>
          <CaptureFilterFields
            compact
            filterMode={filterMode}
            filterUrls={filterUrls}
            onFilterModeChange={onFilterModeChange}
            onFilterUrlsChange={onFilterUrlsChange}
          />
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}

function CompactField({
  id,
  label,
  value,
  onChange,
  ...inputProps
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: string) => void;
} & Omit<ComponentProps<typeof Input>, 'id' | 'value' | 'onChange' | 'className'>) {
  return (
    <label htmlFor={id} className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        id={id}
        className="h-8"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
    </label>
  );
}
