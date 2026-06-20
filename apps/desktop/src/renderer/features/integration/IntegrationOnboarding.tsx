import { useCallback, useEffect, useState } from 'react';
import type {
  IntegrationClient,
  IntegrationPrerequisites,
  IntegrationStepResult,
  IntegrationVerifyResult,
  SkillInstallTarget,
} from '@yanshuf/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@yanshuf/ui';
import { Bot } from 'lucide-react';
import { CLIENT_LABEL } from '@yanshuf/shared';
import { IntegrationStepper } from './IntegrationStepper';
import { getInitialStep, verifyAllCritical, type WizardStepIndex } from './integration-flow';
import { PrerequisitesStep } from './PrerequisitesStrip';
import { McpEntryStep } from './steps/McpEntryStep';
import { SkillsStep } from './steps/SkillsStep';
import { HookStep } from './steps/HookStep';
import { VerifyStep } from './steps/VerifyStep';
import { notifyActionFailed } from '@/lib/toast-actions';

interface IntegrationOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: IntegrationClient;
  onOpenCertificate?: () => void;
  onComplete?: () => void;
}

export function IntegrationOnboarding({
  open,
  onOpenChange,
  client,
  onOpenCertificate,
  onComplete,
}: IntegrationOnboardingProps) {
  const [step, setStep] = useState<WizardStepIndex>(0);
  const [prereqs, setPrereqs] = useState<IntegrationPrerequisites | null>(null);
  const [installPersonal, setInstallPersonal] = useState(true);
  const [projectRoots, setProjectRoots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [stepResults, setStepResults] = useState<Partial<Record<1 | 2 | 3, IntegrationStepResult>>>({});
  const [hookInstalled, setHookInstalled] = useState(false);
  const [verify, setVerify] = useState<IntegrationVerifyResult | null>(null);
  const [installPaths, setInstallPaths] = useState<string[]>([]);

  const prerequisitesSkipped = prereqs?.allMet ?? false;

  const reset = useCallback(() => {
    setStep(0);
    setPrereqs(null);
    setInstallPersonal(true);
    setProjectRoots([]);
    setStepResults({});
    setHookInstalled(false);
    setVerify(null);
    setInstallPaths([]);
  }, []);

  const loadPrerequisites = useCallback(async () => {
    const result = await window.yanshuf.integration.prerequisites();
    setPrereqs(result);
    setStep(getInitialStep(result));
  }, []);

  useEffect(() => {
    if (open) void loadPrerequisites();
  }, [open, loadPrerequisites]);

  const skillTargets = (): SkillInstallTarget[] => {
    const targets: SkillInstallTarget[] = [];
    if (installPersonal) targets.push({ kind: 'personal' });
    for (const repoRoot of projectRoots) {
      targets.push({ kind: 'project', repoRoot });
    }
    return targets;
  };

  const verifyParams = () => ({
    personalSkill: installPersonal,
    projectRoots,
  });

  const runStep = async (which: 1 | 2 | 3) => {
    setBusy(true);
    try {
      if (which === 2) {
        const targets = skillTargets();
        const paths: string[] = [];
        for (const target of targets) {
          const result = await window.yanshuf.integration.installStep('skill', client, target);
          if (!result.ok) {
            notifyActionFailed('install skill', new Error(result.message));
            setStepResults((prev) => ({ ...prev, [2]: result }));
            return;
          }
          if (result.path) paths.push(result.path);
        }
        const okResult: IntegrationStepResult = {
          ok: true,
          message: `Installed skill to ${paths.length} location(s).`,
        };
        setStepResults((prev) => ({ ...prev, [2]: okResult }));
        setInstallPaths((prev) => [...prev, ...paths]);
        setStep(3);
        return;
      }

      const result = await window.yanshuf.integration.installStep(
        which === 1 ? 'mcp' : 'hook',
        client,
      );
      setStepResults((prev) => ({ ...prev, [which]: result }));
      if (!result.ok) {
        notifyActionFailed(`install step ${which}`, new Error(result.message));
        return;
      }
      if (which === 1) {
        setStep(2);
      } else {
        setHookInstalled(true);
      }
    } catch (error) {
      notifyActionFailed(`install step ${which}`, error);
    } finally {
      setBusy(false);
    }
  };

  const runVerify = async () => {
    setBusy(true);
    try {
      const result = await window.yanshuf.integration.verify(client, verifyParams());
      setVerify(result);
      setStep(4);
      const criticalOk = verifyAllCritical(result);
      if (criticalOk) {
        await window.yanshuf.integration.record(client, skillTargets(), true);
        onComplete?.();
      }
    } catch (error) {
      notifyActionFailed('verify integration', error);
    } finally {
      setBusy(false);
    }
  };

  const addProject = async () => {
    const dir = await window.yanshuf.dialog.pickDirectory({
      title: 'Select repository root',
    });
    if (dir && !projectRoots.includes(dir)) {
      setProjectRoots((prev) => [...prev, dir]);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg gap-0 p-0">
        <div className="border-b px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
              <Bot className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">AI Setup</span>
            </div>
            <DialogTitle>Add to {CLIENT_LABEL[client]}</DialogTitle>
            <DialogDescription>
              Connect Yanshuf MCP, install the /yanshuf skill, and set up session cleanup.
            </DialogDescription>
          </DialogHeader>
          {prereqs && (
            <IntegrationStepper
              step={step}
              verify={verify}
              hookInstalled={hookInstalled}
              prerequisitesSkipped={prerequisitesSkipped}
              className="mt-5"
            />
          )}
        </div>

        <div className="space-y-5 px-6 py-5">
          {step === 0 && prereqs && (
            <PrerequisitesStep
              prereqs={prereqs}
              onContinue={() => setStep(1)}
              onOpenCertificate={onOpenCertificate}
            />
          )}
          {step === 1 && (
            <McpEntryStep
              client={client}
              busy={busy}
              result={stepResults[1]}
              onInstall={() => void runStep(1)}
            />
          )}
          {step === 2 && (
            <SkillsStep
              installPersonal={installPersonal}
              projectRoots={projectRoots}
              busy={busy}
              result={stepResults[2]}
              onTogglePersonal={setInstallPersonal}
              onAddProject={() => void addProject()}
              onRemoveProject={(root) =>
                setProjectRoots((prev) => prev.filter((r) => r !== root))
              }
              onInstall={() => void runStep(2)}
            />
          )}
          {step === 3 && (
            <HookStep
              busy={busy}
              result={stepResults[3]}
              hookInstalled={hookInstalled}
              onInstall={() => void runStep(3)}
              onVerify={() => void runVerify()}
            />
          )}
          {step === 4 && (
            <VerifyStep
              client={client}
              verify={verify}
              busy={busy}
              installPaths={installPaths}
              onRunVerify={() => void runVerify()}
              onDone={() => {
                onComplete?.();
                onOpenChange(false);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
