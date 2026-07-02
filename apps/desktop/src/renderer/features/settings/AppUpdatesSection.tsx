import { useEffect, useState } from 'react';
import { Button } from '@yanshuf/ui';
import { Loader2 } from 'lucide-react';
import { SettingsCard, SettingsField, SettingsSection } from './SettingsLayout';

export function AppUpdatesSection() {
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void window.yanshuf.app.getVersion().then(setVersion);
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await window.yanshuf.app.checkForUpdates();
    } finally {
      setChecking(false);
    }
  };

  return (
    <SettingsSection title="About" description="App version and updates.">
      <SettingsCard>
        <SettingsField id="app-version" label="Version" hint="Installed build of Yanshuf.">
          <p className="text-sm text-foreground">{version ?? '…'}</p>
        </SettingsField>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => void handleCheck()} disabled={checking}>
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking…
              </>
            ) : (
              'Check for updates'
            )}
          </Button>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
