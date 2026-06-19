import { useEffect, useState } from 'react';
import type { CertStatus } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CertWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: (status: CertStatus) => void;
}

const TRUST_INSTRUCTIONS =
  'In Keychain Access → System, double-click NodeMITMProxyCA → expand Trust → set "When using this certificate" to Always Trust → close the window and enter your password.';

export function CertWizard({ open, onOpenChange, onStatusChange }: CertWizardProps) {
  const [status, setStatus] = useState<CertStatus | null>(null);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [needsTrustStep, setNeedsTrustStep] = useState(false);

  const refreshStatus = () => void window.yanshuf.cert.status().then((s) => {
    setStatus(s);
    setNeedsTrustStep(s.trusted === 'untrusted');
    onStatusChange?.(s);
  });

  useEffect(() => {
    if (open) refreshStatus();
  }, [open]);

  const installCert = async () => {
    setActionError(null);
    setVerifyResult(null);
    setInstalling(true);
    try {
      const result = await window.yanshuf.cert.install();
      await refreshStatus();
      if (result.needsManualTrust) {
        setNeedsTrustStep(true);
        setVerifyResult(`Certificate imported. ${TRUST_INSTRUCTIONS} Then click Verify Trust.`);
      } else {
        setVerifyResult('Certificate is installed and trusted.');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setInstalling(false);
    }
  };

  const openKeychain = async () => {
    await window.yanshuf.cert.openKeychain();
  };

  const exportCert = async () => {
    setActionError(null);
    try {
      const path = await window.yanshuf.cert.export();
      setExportPath(path);
    } catch (err) {
      setExportPath(null);
      setActionError(err instanceof Error ? err.message : 'Failed to export certificate');
    }
  };

  const verify = async () => {
    setActionError(null);
    const result = await window.yanshuf.cert.verify();
    setVerifyResult(
      result.trusted
        ? 'Certificate trust verified. You can start capture and browse HTTPS sites.'
        : `Verification failed: ${result.error ?? 'unknown'}`,
    );
    await refreshStatus();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install Root Certificate</DialogTitle>
          <DialogDescription>
            Yanshuf needs a trusted root CA in your System keychain to decrypt HTTPS traffic locally.
          </DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Click <strong>Install to System Keychain</strong> and enter your Mac password.</li>
          <li>
            <strong>Set Always Trust</strong> — {TRUST_INSTRUCTIONS}
          </li>
          <li>Click <strong>Verify Trust</strong> to confirm.</li>
        </ol>
        {needsTrustStep && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
            <strong>Action required:</strong> The certificate is in your System keychain but marked
            &quot;not trusted&quot;. Complete step 2 above, then verify.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={installCert} disabled={installing}>
            {installing ? 'Installing…' : 'Install to System Keychain'}
          </Button>
          <Button variant="outline" onClick={openKeychain}>Open Keychain Access</Button>
          <Button variant="outline" onClick={verify}>Verify Trust</Button>
          <Button variant="ghost" onClick={exportCert}>Manual export…</Button>
        </div>
        {exportPath && <p className="text-xs text-muted-foreground">Exported to: {exportPath}</p>}
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        {verifyResult && <p className="text-sm">{verifyResult}</p>}
        {status && (
          <p className="text-xs text-muted-foreground">
            CA: {status.exists ? 'ready' : 'not generated'} · System keychain:{' '}
            {status.trusted === 'installed'
              ? 'trusted'
              : status.trusted === 'untrusted'
                ? 'installed — needs Always Trust'
                : 'not installed'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const [port, setPort] = useState(8888);
  const [ringBufferSize, setRingBufferSize] = useState(10000);

  useEffect(() => {
    if (open) {
      void window.yanshuf.settings.get().then((s) => {
        setPort(s.port);
        setRingBufferSize(s.ringBufferSize);
      });
    }
  }, [open]);

  const save = async () => {
    const current = await window.yanshuf.settings.get();
    await window.yanshuf.settings.save({ ...current, port, ringBufferSize });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
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
          <Button onClick={save}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
