import { useCallback, useEffect, useState } from 'react';
import type { CertStatus } from '@yanshuf/shared';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Separator,
} from '@yanshuf/ui';
import { Download, ExternalLink, KeyRound, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { CA_COMMON_NAME } from '../certificate/cert-flow';
import { CertStepper } from '../certificate/CertStepper';
import { useCertStatusPolling } from '../certificate/useCertStatusPolling';
import { SettingsAlert, SettingsCard, SettingsDangerZone, SettingsSection } from './SettingsLayout';
import { notifyActionFailed, notifyRemoved, notifyDeleted } from '@/lib/toast-actions';

type ConfirmAction = 'uninstall' | 'reset';

interface CertificateSettingsProps {
  active: boolean;
  initialStatus?: CertStatus | null;
  onStatusChange?: (status: CertStatus) => void;
  onOpenOnboarding?: () => void;
}

function trustBadgeVariant(trusted: CertStatus['trusted']) {
  if (trusted === 'installed') return 'success' as const;
  if (trusted === 'untrusted') return 'warning' as const;
  return 'secondary' as const;
}

function trustLabel(trusted: CertStatus['trusted']) {
  if (trusted === 'installed') return 'Trusted';
  if (trusted === 'untrusted') return 'Needs Always Trust';
  return 'Not installed';
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
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading certificate status…
      </div>
    );
  }

  const trusted = resolvedStatus?.trusted ?? 'unknown';

  return (
    <div className="space-y-6">
      <SettingsSection title="Trust status" description="Root CA used to decrypt HTTPS traffic locally.">
        <SettingsCard className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background">
                {trusted === 'installed' ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{CA_COMMON_NAME}</p>
                <p className="text-xs text-muted-foreground">
                  {resolvedStatus?.exists ? 'Local CA generated' : 'CA not generated yet'}
                </p>
              </div>
            </div>
            <Badge variant={trustBadgeVariant(trusted)}>{trustLabel(trusted)}</Badge>
          </div>

          <CertStepper trusted={trusted} />

          {trusted !== 'installed' ? (
            <SettingsAlert
              variant="warning"
              action={
                onOpenOnboarding ? (
                  <Button size="sm" variant="outline" onClick={onOpenOnboarding}>
                    Open setup guide
                  </Button>
                ) : undefined
              }
            >
              Certificate setup is incomplete. Install and trust <strong>{CA_COMMON_NAME}</strong> to
              decrypt HTTPS traffic.
            </SettingsAlert>
          ) : (
            <SettingsAlert variant="success">
              <strong>{CA_COMMON_NAME}</strong> is installed in your login keychain and trusted for
              SSL.
            </SettingsAlert>
          )}

          {resolvedStatus ? (
            <p className="text-xs text-muted-foreground">
              Login keychain:{' '}
              {resolvedStatus.trusted === 'installed'
                ? 'trusted'
                : resolvedStatus.trusted === 'untrusted'
                  ? 'installed — set Always Trust in Keychain Access'
                  : 'not installed'}
            </p>
          ) : null}
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Manage" description="Inspect, export, or open the certificate in Keychain Access.">
        <SettingsCard className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void window.yanshuf.cert.openKeychain()} disabled={busy}>
              <KeyRound className="mr-2 h-4 w-4" />
              Open Keychain Access
            </Button>
            <Button variant="outline" size="sm" onClick={exportCert} disabled={busy}>
              <Download className="mr-2 h-4 w-4" />
              Export certificate…
            </Button>
          </div>
          {exportPath ? (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-all">Exported to {exportPath}</span>
            </p>
          ) : null}
        </SettingsCard>
      </SettingsSection>

      <SettingsDangerZone>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmAction('uninstall')}
            disabled={busy}
          >
            Remove from Keychain
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmAction('reset')}
            disabled={busy}
          >
            Reset CA
          </Button>
        </div>
      </SettingsDangerZone>

      {actionError ? (
        <>
          <Separator />
          <p className="text-sm text-destructive">{actionError}</p>
        </>
      ) : null}

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
    </div>
  );
}
