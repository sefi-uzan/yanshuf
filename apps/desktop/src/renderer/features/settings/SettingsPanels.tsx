import { useEffect, useState } from 'react';
import type { AppSettings, CertStatus, IntegrationClient } from '@yanshuf/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import { Bot, Gauge, Info, Radio, Shield } from 'lucide-react';
import { CertificateSettings } from './CertificateSettings';
import { AiIntegrationSettings } from './AiIntegrationSettings';
import { AboutSettings } from './AboutSettings';
import { CaptureSettings } from './CaptureSettings';
import { NetworkSettings } from './NetworkSettings';
import { useAppSettings } from './useAppSettings';
import { IntegrationOnboarding } from '../integration/IntegrationOnboarding';
import { notifySaved } from '@/lib/toast-actions';

export type SettingsTab = 'capture' | 'network' | 'certificate' | 'ai' | 'about';

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

const LOCALHOST_HINT_KEY = 'yanshuf.localhost-hint-shown';

const NAV_ITEMS: {
  value: SettingsTab;
  label: string;
  icon: typeof Radio;
}[] = [
  { value: 'capture', label: 'Capture', icon: Radio },
  { value: 'network', label: 'Network', icon: Gauge },
  { value: 'certificate', label: 'Certificate', icon: Shield },
  { value: 'ai', label: 'AI', icon: Bot },
  { value: 'about', label: 'About', icon: Info },
];

export function SettingsPanel({
  open,
  onOpenChange,
  defaultTab = 'capture',
  onCertStatusChange,
  onOpenCertOnboarding,
  certStatus,
  focusAiUpdates = false,
  integrationStatusNonce = 0,
  onIntegrationStatusChange,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>(defaultTab);
  const [integrationClient, setIntegrationClient] = useState<IntegrationClient | null>(null);
  const { settings, loaded, update } = useAppSettings(open);

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  const handleUpdate = (patch: Partial<AppSettings>) => {
    update(patch);
    if (
      patch.captureLocalhost &&
      !settings.captureLocalhost &&
      !localStorage.getItem(LOCALHOST_HINT_KEY)
    ) {
      localStorage.setItem(LOCALHOST_HINT_KEY, '1');
      notifySaved(
        'Localhost capture enabled. Some apps still bypass localhost — point them at the proxy if traffic does not appear.',
      );
    }
  };

  const activeNav = NAV_ITEMS.find((item) => item.value === tab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed height so switching tabs never resizes the dialog — short tabs keep the
          same frame and tall ones scroll in the content column below. */}
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[min(36rem,calc(100vh-4rem))] max-w-3xl flex-col gap-0 overflow-hidden p-0"
      >
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as SettingsTab)}
          className="flex min-h-0 flex-1"
        >
          <aside className="flex w-44 shrink-0 flex-col border-r bg-muted/30">
            <DialogHeader className="border-b px-3 py-3 text-left">
              <DialogTitle className="text-sm font-semibold">Settings</DialogTitle>
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

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="capture" className="mt-0 focus-visible:outline-none">
                {loaded && <CaptureSettings settings={settings} onUpdate={handleUpdate} />}
              </TabsContent>

              <TabsContent value="network" className="mt-0 focus-visible:outline-none">
                {loaded && <NetworkSettings settings={settings} onUpdate={handleUpdate} />}
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

              <TabsContent value="about" className="mt-0 focus-visible:outline-none">
                <AboutSettings />
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
