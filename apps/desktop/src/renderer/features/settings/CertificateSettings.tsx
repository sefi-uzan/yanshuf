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
} from '@yanshuf/ui';
import { Download, ExternalLink, KeyRound, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@yanshuf/ui/lib/utils';
import { CA_COMMON_NAME } from '../certificate/cert-flow';
import { CertStepper } from '../certificate/CertStepper';
import { useCertStatusPolling } from '../certificate/useCertStatusPolling';
import { SettingsAlert, SettingsDangerZone, SettingsSection } from './SettingsLayout';
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
    <div className="space-y-5">
      <SettingsSection
        title="Certificate"
        description="Root CA used to decrypt HTTPS traffic locally."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background',
                trusted === 'installed'
                  ? 'border-emerald-500/30'
                  : 'border-amber-500/30',
              )}
            >
              {trusted === 'installed' ? (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{CA_COMMON_NAME}</p>
              <p className="text-[11px] text-muted-foreground">
                {resolvedStatus?.exists ? 'Local CA generated' : 'CA not generated yet'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={trustBadgeVariant(trusted)}>{trustLabel(trusted)}</Badge>
            {trusted !== 'installed' && onOpenOnboarding && (
              <Button size="sm" onClick={onOpenOnboarding} disabled={busy}>
                Set up
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void window.yanshuf.cert.openKeychain()}
              disabled={busy}
            >
              <KeyRound className="mr-1.5 h-4 w-4" />
              Keychain
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportCert()} disabled={busy}>
              <Download className="mr-1.5 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {exportPath ? (
          <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-all">Exported to {exportPath}</span>
          </p>
        ) : null}
      </SettingsSection>

      <CertStepper trusted={trusted} variant="inline" />

      {trusted !== 'installed' && (
        <SettingsAlert variant="warning">
          {trusted === 'untrusted'
            ? 'Certificate is installed but not fully trusted. Open Keychain Access and set Always Trust for SSL.'
            : 'Install and trust the root CA to decrypt HTTPS traffic.'}
        </SettingsAlert>
      )}

      <SettingsDangerZone>
        <div className="divide-y divide-destructive/10">
          <DangerActionRow
            title="Remove from Keychain"
            description="Deletes the root CA from your login keychain. HTTPS decryption stops until you reinstall."
            actionLabel="Remove"
            disabled={busy}
            onAction={() => setConfirmAction('uninstall')}
          />
          <DangerActionRow
            title="Reset CA"
            description="Stops capture, deletes local CA files, and generates a new root certificate."
            actionLabel="Reset"
            disabled={busy}
            onAction={() => setConfirmAction('reset')}
          />
        </div>
      </SettingsDangerZone>

      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
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

function DangerActionRow({
  title,
  description,
  actionLabel,
  disabled,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  disabled: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
