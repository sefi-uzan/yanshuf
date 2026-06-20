import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CaptureFilterMode, CertStatus } from '@yanshuf/shared';
import { DEFAULT_SETTINGS , SHORTCUTS, formatShortcutParts } from '@yanshuf/shared';
import { Button , Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle , Input , Separator , Tabs, TabsContent, TabsList, TabsTrigger } from '@yanshuf/ui';
import { Kbd, useShortcutHints } from '@/components/shortcut-hints';
import { cn } from '@yanshuf/ui/lib/utils';
import { Loader2, Bot, Shield, SlidersHorizontal } from 'lucide-react';
import { CaptureFilterFields } from './CaptureFilterFields';
import { CertificateSettings } from './CertificateSettings';
import { AiIntegrationSettings } from './AiIntegrationSettings';
import { IntegrationOnboarding } from '../integration/IntegrationOnboarding';
import { SettingsFooter, SettingsSection } from './SettingsLayout';
import { clearCapturedRequests, notifyActionFailed, notifySaved } from '@/lib/toast-actions';
import type { IntegrationClient } from '@yanshuf/shared';

export type SettingsTab = 'general' | 'certificate' | 'ai';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: SettingsTab;
  onCertStatusChange?: (status: CertStatus) => void;
  onOpenCertOnboarding?: () => void;
  certStatus?: CertStatus | null;
  focusAiUpdates?: boolean;
  integrationStatusNonce?: number;
  onIntegrationStatusChange?: () => void;
}

const BYTES_PER_MB = 1024 * 1024;

function bytesToMb(bytes: number): number {
  return Math.round(bytes / BYTES_PER_MB);
}

function mbToBytes(mb: number): number {
  return Math.max(1, mb) * BYTES_PER_MB;
}

const NAV_ITEMS: {
  value: SettingsTab;
  label: string;
  icon: typeof SlidersHorizontal;
}[] = [
  { value: 'general', label: 'General', icon: SlidersHorizontal },
  { value: 'certificate', label: 'Certificate', icon: Shield },
  { value: 'ai', label: 'AI', icon: Bot },
];

export function SettingsPanel({
  open,
  onOpenChange,
  defaultTab = 'general',
  onCertStatusChange,
  onOpenCertOnboarding,
  certStatus,
  focusAiUpdates = false,
  integrationStatusNonce = 0,
  onIntegrationStatusChange,
}: SettingsPanelProps) {
  const [port, setPort] = useState(DEFAULT_SETTINGS.port);
  const [ringBufferSize, setRingBufferSize] = useState(DEFAULT_SETTINGS.ringBufferSize);
  const [maxBodySizeMb, setMaxBodySizeMb] = useState(bytesToMb(DEFAULT_SETTINGS.maxBodySize));
  const [filterMode, setFilterMode] = useState<CaptureFilterMode>('exclude');
  const [filterUrls, setFilterUrls] = useState('');
  const [initialPort, setInitialPort] = useState(DEFAULT_SETTINGS.port);
  const [initialRingBufferSize, setInitialRingBufferSize] = useState(DEFAULT_SETTINGS.ringBufferSize);
  const [initialMaxBodySizeMb, setInitialMaxBodySizeMb] = useState(bytesToMb(DEFAULT_SETTINGS.maxBodySize));
  const [initialFilterMode, setInitialFilterMode] = useState<CaptureFilterMode>('exclude');
  const [initialFilterUrls, setInitialFilterUrls] = useState('');
  const [tab, setTab] = useState<SettingsTab>(defaultTab);
  const [saving, setSaving] = useState(false);
  const [integrationClient, setIntegrationClient] = useState<IntegrationClient | null>(null);
  const { hintsVisible } = useShortcutHints();

  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      void window.yanshuf.settings.get().then((s) => {
        setPort(s.port);
        setRingBufferSize(s.ringBufferSize);
        setMaxBodySizeMb(bytesToMb(s.maxBodySize));
        setFilterMode(s.captureFilter.mode);
        setFilterUrls(s.captureFilter.urls);
        setInitialPort(s.port);
        setInitialRingBufferSize(s.ringBufferSize);
        setInitialMaxBodySizeMb(bytesToMb(s.maxBodySize));
        setInitialFilterMode(s.captureFilter.mode);
        setInitialFilterUrls(s.captureFilter.urls);
      });
    }
  }, [open, defaultTab]);

  const isDirty = useMemo(
    () =>
      port !== initialPort ||
      ringBufferSize !== initialRingBufferSize ||
      maxBodySizeMb !== initialMaxBodySizeMb ||
      filterMode !== initialFilterMode ||
      filterUrls !== initialFilterUrls,
    [
      port,
      ringBufferSize,
      maxBodySizeMb,
      filterMode,
      filterUrls,
      initialPort,
      initialRingBufferSize,
      initialMaxBodySizeMb,
      initialFilterMode,
      initialFilterUrls,
    ],
  );

  const reset = () => {
    setPort(initialPort);
    setRingBufferSize(initialRingBufferSize);
    setMaxBodySizeMb(initialMaxBodySizeMb);
    setFilterMode(initialFilterMode);
    setFilterUrls(initialFilterUrls);
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const filtersChanged = filterMode !== initialFilterMode || filterUrls !== initialFilterUrls;
      const current = await window.yanshuf.settings.get();
      await window.yanshuf.settings.save({
        ...current,
        port,
        ringBufferSize,
        maxBodySize: mbToBytes(maxBodySizeMb),
        captureFilter: {
          mode: filterMode,
          urls: filterUrls,
        },
      });
      setInitialPort(port);
      setInitialRingBufferSize(ringBufferSize);
      setInitialMaxBodySizeMb(maxBodySizeMb);
      setInitialFilterMode(filterMode);
      setInitialFilterUrls(filterUrls);
      if (filtersChanged) {
        await clearCapturedRequests({ toast: false });
      }
      notifySaved('Settings');
      onOpenChange(false);
    } catch (error) {
      notifyActionFailed('save settings', error);
    } finally {
      setSaving(false);
    }
  }, [
    filterMode,
    filterUrls,
    initialFilterMode,
    initialFilterUrls,
    maxBodySizeMb,
    onOpenChange,
    port,
    ringBufferSize,
  ]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 's' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (saving) return;
        if (isDirty) {
          void save();
        } else {
          onOpenChange(false);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isDirty, saving, save, onOpenChange]);

  const activeNav = NAV_ITEMS.find((item) => item.value === tab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(36rem,calc(100vh-4rem))] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as SettingsTab)}
          className="flex h-full min-h-0 flex-1"
        >
          <aside className="flex w-44 shrink-0 flex-col border-r bg-muted/30">
            <DialogHeader className="space-y-0.5 border-b px-3 py-3 text-left">
              <DialogTitle className="text-sm font-semibold">Settings</DialogTitle>
              <DialogDescription className="text-xs">Configure Yanshuf</DialogDescription>
            </DialogHeader>
            <TabsList className="flex h-auto flex-col items-stretch justify-start gap-0.5 bg-transparent p-2">
              {NAV_ITEMS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    'h-9 w-full justify-start gap-2.5 rounded-md px-2.5 py-0 text-sm font-medium',
                    'data-[state=active]:bg-background data-[state=active]:shadow-sm',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-70" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="shrink-0 border-b px-6 py-3">
              <h2 className="text-sm font-semibold">{activeNav?.label}</h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <TabsContent value="general" className="mt-0 space-y-6 focus-visible:outline-none">
                <div className="grid grid-cols-3 gap-3">
                  <label htmlFor="proxy-port" className="space-y-1">
                    <span className="text-xs text-muted-foreground">Port</span>
                    <Input
                      id="proxy-port"
                      type="number"
                      min={1024}
                      max={65535}
                      className="h-8"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                    />
                  </label>
                  <label htmlFor="ring-buffer-size" className="space-y-1">
                    <span className="text-xs text-muted-foreground">Max entries</span>
                    <Input
                      id="ring-buffer-size"
                      type="number"
                      min={100}
                      step={100}
                      className="h-8"
                      value={ringBufferSize}
                      onChange={(e) => setRingBufferSize(Number(e.target.value))}
                    />
                  </label>
                  <label htmlFor="max-body-size" className="space-y-1">
                    <span className="text-xs text-muted-foreground">Max body size (MB)</span>
                    <Input
                      id="max-body-size"
                      type="number"
                      min={1}
                      step={1}
                      className="h-8"
                      value={maxBodySizeMb}
                      onChange={(e) => setMaxBodySizeMb(Number(e.target.value))}
                    />
                  </label>
                </div>

                <Separator />

                <SettingsSection title="Filters">
                  <CaptureFilterFields
                    filterMode={filterMode}
                    filterUrls={filterUrls}
                    onFilterModeChange={setFilterMode}
                    onFilterUrlsChange={setFilterUrls}
                  />
                </SettingsSection>

                <SettingsFooter>
                  <Button variant="outline" onClick={reset} disabled={!isDirty || saving}>
                    Reset
                  </Button>
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={() => void save()} disabled={!isDirty || saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : hintsVisible ? (
                      <span className="inline-flex items-center gap-0.5" aria-hidden>
                        {formatShortcutParts(SHORTCUTS.saveSettings.keys).map((part, index) => (
                          <Kbd key={`${part}-${index}`}>{part}</Kbd>
                        ))}
                      </span>
                    ) : (
                      'Save'
                    )}
                  </Button>
                </SettingsFooter>
              </TabsContent>

              <TabsContent value="certificate" className="mt-0 focus-visible:outline-none">
                <CertificateSettings
                  active={open && tab === 'certificate'}
                  initialStatus={certStatus}
                  onStatusChange={onCertStatusChange}
                  onOpenOnboarding={onOpenCertOnboarding}
                />
              </TabsContent>

              <TabsContent value="ai" className="mt-0 focus-visible:outline-none">
                <AiIntegrationSettings
                  active={open && tab === 'ai'}
                  focusUpdates={focusAiUpdates && tab === 'ai'}
                  integrationStatusNonce={integrationStatusNonce}
                  onOpenOnboarding={setIntegrationClient}
                  onOpenCertificate={onOpenCertOnboarding}
                  onStatusChange={onIntegrationStatusChange}
                />
              </TabsContent>
            </div>
          </div>
        </Tabs>

        {integrationClient && (
          <IntegrationOnboarding
            open={Boolean(integrationClient)}
            onOpenChange={(next) => {
              if (!next) {
                setIntegrationClient(null);
                onIntegrationStatusChange?.();
              }
            }}
            client={integrationClient}
            onOpenCertificate={onOpenCertOnboarding}
            onComplete={onIntegrationStatusChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
