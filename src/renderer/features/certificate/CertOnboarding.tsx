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
import { Loader2, ShieldCheck } from 'lucide-react';
import { CertStepper } from './CertStepper';
import { CA_COMMON_NAME, getCertFlowStep } from './cert-flow';
import { useCertStatusPolling } from './useCertStatusPolling';

interface CertOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: (status: CertStatus) => void;
  onComplete?: () => void;
}

export function CertOnboarding({ open, onOpenChange, onStatusChange, onComplete }: CertOnboardingProps) {
  const [status, setStatus] = useState<CertStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [openingKeychain, setOpeningKeychain] = useState(false);

  const trusted = status?.trusted ?? 'unknown';
  const step = getCertFlowStep(trusted);
  const isComplete = trusted === 'installed';

  const refreshStatus = useCallback(() => {
    void window.yanshuf.cert.status().then((s) => {
      setStatus(s);
      onStatusChange?.(s);
    });
  }, [onStatusChange]);

  useEffect(() => {
    if (open) refreshStatus();
  }, [open, refreshStatus]);

  useCertStatusPolling({
    enabled: open && !isComplete,
    onStatusChange: (s) => {
      setStatus(s);
      onStatusChange?.(s);
    },
  });

  const installCert = async () => {
    setActionError(null);
    setInstalling(true);
    try {
      await window.yanshuf.cert.install();
      refreshStatus();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setInstalling(false);
    }
  };

  const openKeychain = async () => {
    setActionError(null);
    setOpeningKeychain(true);
    try {
      await window.yanshuf.cert.openKeychain();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not open Keychain Access');
    } finally {
      setOpeningKeychain(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !isComplete) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose={!isComplete}
        className="max-w-lg gap-0 p-0"
        onPointerDownOutside={(e) => {
          if (!isComplete) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!isComplete) e.preventDefault();
        }}
      >
        <div className="border-b px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Setup</span>
            </div>
            <DialogTitle>Set up HTTPS decryption</DialogTitle>
            <DialogDescription>
              Yanshuf needs a trusted root certificate in your login keychain before it can inspect
              encrypted traffic.
            </DialogDescription>
          </DialogHeader>
          <CertStepper trusted={trusted} className="mt-5" />
        </div>

        <div className="space-y-5 px-6 py-5">
          {step === 'install' && (
            <InstallStep installing={installing} onInstall={installCert} />
          )}
          {step === 'trust' && (
            <TrustStep
              openingKeychain={openingKeychain}
              onOpenKeychain={openKeychain}
              onReinstall={installCert}
              reinstalling={installing}
              polling
            />
          )}
          {step === 'ready' && (
            <ReadyStep
              onContinue={() => {
                onComplete?.();
                onOpenChange(false);
              }}
            />
          )}
          {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InstallStep({
  installing,
  onInstall,
}: {
  installing: boolean;
  onInstall: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Step 1 — Install the root certificate</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Yanshuf will add <strong>{CA_COMMON_NAME}</strong> to your macOS login keychain. No
          administrator password is required.
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Click the button below.</li>
        <li>Continue to the next step to set trust.</li>
      </ol>
      <Button className="w-full" size="lg" onClick={onInstall} disabled={installing}>
        {installing ? 'Installing…' : 'Install Certificate'}
      </Button>
    </div>
  );
}

function TrustStep({
  openingKeychain,
  onOpenKeychain,
  onReinstall,
  reinstalling,
  polling,
}: {
  openingKeychain: boolean;
  onOpenKeychain: () => void;
  onReinstall: () => void;
  reinstalling: boolean;
  polling: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Step 2 — Set Always Trust</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The certificate is in your <strong>login</strong> keychain. macOS requires you to mark it
          as trusted manually.
        </p>
      </div>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          Open <strong>Keychain Access</strong> (button below).
        </li>
        <li>
          In the sidebar under <strong>Default Keychains</strong>, select <strong>login</strong>.
        </li>
        <li>
          Use the search box (top right) and type <strong>Yanshuf</strong>.
        </li>
        <li>
          Double-click <strong>{CA_COMMON_NAME}</strong>.
        </li>
        <li>
          Expand <strong>Trust</strong> and set <strong>When using this certificate</strong> to{' '}
          <strong>Always Trust</strong>.
        </li>
        <li>Close the window and enter your password to save.</li>
      </ol>
      <Button className="w-full" size="lg" variant="default" onClick={onOpenKeychain} disabled={openingKeychain}>
        {openingKeychain ? 'Opening…' : 'Open Keychain Access'}
      </Button>
      <Button className="w-full" variant="outline" onClick={onReinstall} disabled={reinstalling}>
        {reinstalling ? 'Reinstalling…' : "Can't find it? Reinstall certificate"}
      </Button>
      {polling && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for trust to be set…
        </div>
      )}
    </div>
  );
}

function ReadyStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">Step 3 — You&apos;re all set</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong>{CA_COMMON_NAME}</strong> is trusted. You can start capture and inspect HTTPS traffic.
        </p>
      </div>
      <Button className="w-full" size="lg" onClick={onContinue}>
        Get started
      </Button>
    </div>
  );
}
