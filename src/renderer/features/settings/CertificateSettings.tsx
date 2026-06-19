import { useCallback, useEffect, useState } from 'react';
import type { CertStatus } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { CA_COMMON_NAME } from '../certificate/cert-flow';
import { CertStepper } from '../certificate/CertStepper';
import { useCertStatusPolling } from '../certificate/useCertStatusPolling';
import { notifyActionFailed, notifyRemoved, notifyDeleted } from '@/lib/toast-actions';

type ConfirmAction = 'uninstall' | 'reset';

interface CertificateSettingsProps {
  active: boolean;
  initialStatus?: CertStatus | null;
  onStatusChange?: (status: CertStatus) => void;
  onOpenOnboarding?: () => void;
}

export function CertificateSettings({
  active,
  initialStatus,
  onStatusChange,
  onOpenOnboarding,
}: CertificateSettingsProps) {
  const [status, setStatus] = useState<CertStatus | null>(initialStatus ?? null);
  const [loading, setLoading] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await window.yanshuf.cert.status();
      setStatus(s);
      onStatusChange?.(s);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load certificate status');
    }
  }, [onStatusChange]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    void (async () => {
      setStatus((current) => {
        if (current == null && initialStatus == null) setLoading(true);
        return current;
      });

      try {
        const s = await window.yanshuf.cert.status();
        if (cancelled) return;
        setStatus(s);
        onStatusChange?.(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, initialStatus, onStatusChange]);

  useEffect(() => {
    if (initialStatus) {
      setStatus((current) => current ?? initialStatus);
    }
  }, [initialStatus]);

  useCertStatusPolling({
    enabled: active && status?.trusted !== 'installed',
    onStatusChange: (s) => {
      setStatus(s);
      onStatusChange?.(s);
    },
  });

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

  const uninstallCert = async () => {
    setActionError(null);
    setBusy(true);
    try {
      await window.yanshuf.cert.uninstall();
      notifyRemoved('Certificate from Keychain');
      refreshStatus();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Uninstall failed');
      notifyActionFailed('remove certificate from Keychain', err);
    } finally {
      setBusy(false);
    }
  };

  const resetCa = async () => {
    setActionError(null);
    setBusy(true);
    try {
      await window.yanshuf.cert.reset();
      notifyDeleted('Local CA');
      refreshStatus();
      onOpenOnboarding?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Reset failed');
      notifyActionFailed('reset CA', err);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    if (action === 'uninstall') {
      await uninstallCert();
    } else {
      await resetCa();
    }
  };

  const resolvedStatus = status ?? initialStatus ?? null;
  const showLoading = active && loading && resolvedStatus === null;

  if (showLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading certificate status…
      </div>
    );
  }

  const trusted = resolvedStatus?.trusted ?? 'unknown';

  return (
    <div className="space-y-4">
      <CertStepper trusted={trusted} />

      {trusted !== 'installed' ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="text-amber-900 dark:text-amber-100">
            Certificate setup is incomplete. Run the guided setup to install and trust{' '}
            <strong>{CA_COMMON_NAME}</strong>.
          </p>
          {onOpenOnboarding && (
            <Button size="sm" className="mt-3" variant="outline" onClick={onOpenOnboarding}>
              Open setup guide
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <strong>{CA_COMMON_NAME}</strong> is installed and trusted.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void window.yanshuf.cert.openKeychain()} disabled={busy}>
          Open Keychain Access
        </Button>
        <Button variant="outline" onClick={exportCert} disabled={busy}>
          Export certificate…
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setConfirmAction('uninstall')}
          disabled={busy}
        >
          Remove from Keychain
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setConfirmAction('reset')}
          disabled={busy}
        >
          Reset CA
        </Button>
      </div>

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'uninstall' ? 'Remove from Keychain?' : 'Reset CA?'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'uninstall'
                ? 'Remove the Yanshuf root certificate from your login keychain? HTTPS decryption will stop working.'
                : 'Reset the local CA? This stops capture, deletes local certificate files, and generates a new root CA. You must reinstall and trust it.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmAction()} disabled={busy}>
              {confirmAction === 'uninstall' ? 'Remove' : 'Reset CA'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {exportPath && <p className="text-xs text-muted-foreground">Exported to: {exportPath}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      {resolvedStatus && (
        <p className="text-xs text-muted-foreground">
          CA: {resolvedStatus.exists ? (resolvedStatus.commonName ?? 'ready') : 'not generated'} · Login keychain:{' '}
          {resolvedStatus.trusted === 'installed'
            ? 'trusted'
            : resolvedStatus.trusted === 'untrusted'
              ? 'installed — needs Always Trust'
              : 'not installed'}
        </p>
      )}
    </div>
  );
}
