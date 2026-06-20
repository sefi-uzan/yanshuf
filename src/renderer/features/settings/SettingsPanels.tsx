import { useEffect, useState } from 'react';
import type { CertStatus } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CertificateSettings } from './CertificateSettings';
import { UserSettings } from './UserSettings';
import { notifyActionFailed, notifySaved } from '@/lib/toast-actions';

export type SettingsTab = 'general' | 'certificate' | 'user';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: SettingsTab;
  onCertStatusChange?: (status: CertStatus) => void;
  onOpenCertOnboarding?: () => void;
  onReplayTour?: () => void;
  certStatus?: CertStatus | null;
}

export function SettingsPanel({
  open,
  onOpenChange,
  defaultTab = 'general',
  onCertStatusChange,
  onOpenCertOnboarding,
  onReplayTour,
  certStatus,
}: SettingsPanelProps) {
  const [port, setPort] = useState(8888);
  const [ringBufferSize, setRingBufferSize] = useState(10000);
  const [tab, setTab] = useState<SettingsTab>(defaultTab);

  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      void window.yanshuf.settings.get().then((s) => {
        setPort(s.port);
        setRingBufferSize(s.ringBufferSize);
      });
    }
  }, [open, defaultTab]);

  const save = async () => {
    try {
      const current = await window.yanshuf.settings.get();
      await window.yanshuf.settings.save({ ...current, port, ringBufferSize });
      notifySaved('Settings');
      onOpenChange(false);
    } catch (error) {
      notifyActionFailed('save settings', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="certificate">Certificate</TabsTrigger>
            <TabsTrigger value="user">User</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="space-y-3">
              <label className="block text-sm">
                Proxy port
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                Max captured entries
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={ringBufferSize}
                  onChange={(e) => setRingBufferSize(Number(e.target.value))}
                />
              </label>
              <Button onClick={() => void save()}>Save</Button>
            </div>
          </TabsContent>
          <TabsContent value="certificate">
            <CertificateSettings
              active={open && tab === 'certificate'}
              initialStatus={certStatus}
              onStatusChange={onCertStatusChange}
              onOpenOnboarding={onOpenCertOnboarding}
            />
          </TabsContent>
          <TabsContent value="user">
            <UserSettings
              active={open && tab === 'user'}
              onReplayTour={onReplayTour}
              onApplied={() => onOpenChange(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
