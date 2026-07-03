import { useCallback, useEffect, useState } from 'react';
import type { CertStatus } from '@yanshuf/shared';
import { Button ,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@yanshuf/ui';
import { ShieldCheck } from 'lucide-react';
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
      const result = await window.yanshuf.cert.install();
      refreshStatus();
      if (!result.trusted) {
        setActionError(
          'The certificate was not trusted. You need to enter your password at the prompt to finish setup.',
        );
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Install failed');
    } finally {
      setInstalling(false);
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
              Yanshuf needs a trusted root certificate before it can inspect encrypted traffic.
            </DialogDescription>
          </DialogHeader>
          <CertStepper trusted={trusted} className="mt-5" />
        </div>

        <div className="space-y-5 px-6 py-5">
          {step === 'install' && (
            <InstallStep installing={installing} onInstall={installCert} />
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
        <h3 className="text-sm font-semibold">Install and trust the root certificate</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Yanshuf will add <strong>{CA_COMMON_NAME}</strong> to your login keychain and mark it as
          trusted in one step.
        </p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Click the button below.</li>
        <li>
          Enter your <strong>macOS password</strong> at the prompt so the certificate can be trusted.
        </li>
      </ol>
      <Button className="w-full" size="lg" onClick={onInstall} disabled={installing}>
        {installing ? 'Installing…' : 'Install & Trust Certificate'}
      </Button>
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
        <h3 className="text-sm font-semibold">You&apos;re all set</h3>
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
