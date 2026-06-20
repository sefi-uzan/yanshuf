import { useEffect, useMemo, useState } from 'react';
import type { CaptureFilterMode, CertStatus } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Loader2, Shield, SlidersHorizontal } from 'lucide-react';
import { CaptureFilterFields } from './CaptureFilterFields';
import { CertificateSettings } from './CertificateSettings';
import { SettingsFooter, SettingsSection } from './SettingsLayout';
import { clearCapturedRequests, notifyActionFailed, notifySaved } from '@/lib/toast-actions';

export type SettingsTab = 'general' | 'certificate';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: SettingsTab;
  onCertStatusChange?: (status: CertStatus) => void;
  onOpenCertOnboarding?: () => void;
  certStatus?: CertStatus | null;
}

const NAV_ITEMS: {
  value: SettingsTab;
  label: string;
  icon: typeof SlidersHorizontal;
}[] = [
  { value: 'general', label: 'General', icon: SlidersHorizontal },
  { value: 'certificate', label: 'Certificate', icon: Shield },
];

export function SettingsPanel({
  open,
  onOpenChange,
  defaultTab = 'general',
  onCertStatusChange,
  onOpenCertOnboarding,
  certStatus,
}: SettingsPanelProps) {
  const [port, setPort] = useState(8888);
  const [ringBufferSize, setRingBufferSize] = useState(10000);
  const [filterMode, setFilterMode] = useState<CaptureFilterMode>('exclude');
  const [filterUrls, setFilterUrls] = useState('');
  const [initialPort, setInitialPort] = useState(8888);
  const [initialRingBufferSize, setInitialRingBufferSize] = useState(10000);
  const [initialFilterMode, setInitialFilterMode] = useState<CaptureFilterMode>('exclude');
  const [initialFilterUrls, setInitialFilterUrls] = useState('');
  const [tab, setTab] = useState<SettingsTab>(defaultTab);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      void window.yanshuf.settings.get().then((s) => {
        setPort(s.port);
        setRingBufferSize(s.ringBufferSize);
        setFilterMode(s.captureFilter.mode);
        setFilterUrls(s.captureFilter.urls);
        setInitialPort(s.port);
        setInitialRingBufferSize(s.ringBufferSize);
        setInitialFilterMode(s.captureFilter.mode);
        setInitialFilterUrls(s.captureFilter.urls);
      });
    }
  }, [open, defaultTab]);

  const isDirty = useMemo(
    () =>
      port !== initialPort ||
      ringBufferSize !== initialRingBufferSize ||
      filterMode !== initialFilterMode ||
      filterUrls !== initialFilterUrls,
    [
      port,
      ringBufferSize,
      filterMode,
      filterUrls,
      initialPort,
      initialRingBufferSize,
      initialFilterMode,
      initialFilterUrls,
    ],
  );

  const reset = () => {
    setPort(initialPort);
    setRingBufferSize(initialRingBufferSize);
    setFilterMode(initialFilterMode);
    setFilterUrls(initialFilterUrls);
  };

  const save = async () => {
    setSaving(true);
    try {
      const filtersChanged = filterMode !== initialFilterMode || filterUrls !== initialFilterUrls;
      const current = await window.yanshuf.settings.get();
      await window.yanshuf.settings.save({
        ...current,
        port,
        ringBufferSize,
        captureFilter: {
          mode: filterMode,
          urls: filterUrls,
        },
      });
      setInitialPort(port);
      setInitialRingBufferSize(ringBufferSize);
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
  };

  const activeNav = NAV_ITEMS.find((item) => item.value === tab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-4rem)] max-w-2xl gap-0 overflow-hidden p-0">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as SettingsTab)}
          className="flex min-h-[min(480px,calc(100vh-4rem))] max-h-[calc(100vh-4rem)]"
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

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b px-6 py-3">
              <h2 className="text-sm font-semibold">{activeNav?.label}</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <TabsContent value="general" className="mt-0 space-y-6 focus-visible:outline-none">
                <div className="grid grid-cols-2 gap-3">
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
                    ) : (
                      'Save changes'
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
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
