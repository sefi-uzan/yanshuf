import { useCallback, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@yanshuf/ui';
import { CheckCircle2, Circle, Loader2, Plug } from 'lucide-react';
import { cn } from '@yanshuf/ui/lib/utils';
import { notifyActionFailed } from '@/lib/toast-actions';

type IntegrationClient = 'cursor' | 'claude-code';
type SkillTargetKind = 'personal' | 'project';
type WizardStep = 0 | 1 | 2 | 3 | 4;

interface IntegrationVerifyResult {
  mcpConfigured: boolean;
  skillInstalled: boolean;
  hookInstalled: boolean;
  apiReachable: boolean;
  certTrusted: boolean;
  details: string[];
}

interface IntegrationStepResult {
  ok: boolean;
  message: string;
  path?: string;
}

interface McpIntegrationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: IntegrationClient;
  certTrusted: boolean;
}

const CLIENT_LABEL: Record<IntegrationClient, string> = {
  cursor: 'Cursor',
  'claude-code': 'Claude Code',
};

function StepIndicator({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <Circle className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
      )}
      <span className={cn(active || done ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
    </div>
  );
}

export function McpIntegrationPanel({
  open,
  onOpenChange,
  client,
  certTrusted,
}: McpIntegrationPanelProps) {
  const [step, setStep] = useState<WizardStep>(0);
  const [skillTarget, setSkillTarget] = useState<SkillTargetKind>('personal');
  const [projectRoot, setProjectRoot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepResults, setStepResults] = useState<Partial<Record<1 | 2 | 3, IntegrationStepResult>>>({});
  const [verify, setVerify] = useState<IntegrationVerifyResult | null>(null);

  const reset = useCallback(() => {
    setStep(0);
    setSkillTarget('personal');
    setProjectRoot(null);
    setStepResults({});
    setVerify(null);
  }, []);

  const skillTargetPayload = ():
    | { kind: 'personal' }
    | { kind: 'project'; repoRoot: string } => {
    if (skillTarget === 'project' && projectRoot) {
      return { kind: 'project', repoRoot: projectRoot };
    }
    return { kind: 'personal' };
  };

  const runStep = async (which: 1 | 2 | 3) => {
    setBusy(true);
    try {
      const result = await window.yanshuf.integration.installStep(
        which === 1 ? 'mcp' : which === 2 ? 'skill' : 'hook',
        client,
        which === 2 ? skillTargetPayload() : undefined,
      );
      setStepResults((prev) => ({ ...prev, [which]: result }));
      if (result.ok) setStep((which + 1) as WizardStep);
      else notifyActionFailed(`install step ${which}`, new Error(result.message));
    } catch (error) {
      notifyActionFailed(`install step ${which}`, error);
    } finally {
      setBusy(false);
    }
  };

  const runVerify = async () => {
    setBusy(true);
    try {
      const result = await window.yanshuf.integration.verify(client, skillTargetPayload());
      setVerify(result);
      setStep(4);
    } catch (error) {
      notifyActionFailed('verify integration', error);
    } finally {
      setBusy(false);
    }
  };

  const pickProject = async () => {
    const dir = await window.yanshuf.dialog.pickDirectory({
      title: 'Select repository root',
    });
    if (dir) setProjectRoot(dir);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Add to {CLIENT_LABEL[client]}
          </DialogTitle>
          <DialogDescription>
            Connect Yanshuf MCP, install the /yanshuf skill, and set up session cleanup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <StepIndicator done={step > 0} active={step === 0} label="Prerequisites" />
            <StepIndicator done={step > 1} active={step === 1} label="Add MCP entry" />
            <StepIndicator done={step > 2} active={step === 2} label="Add skills" />
            <StepIndicator done={step > 3} active={step === 3} label="Add sessionEnd hook" />
            <StepIndicator done={step === 4} active={step === 4} label="Verify" />
          </div>

          {step === 0 && (
            <div className="space-y-3 text-sm">
              <p>Yanshuf must be running (it is). For HTTPS capture, the root CA must be trusted.</p>
              <p className={cn(certTrusted ? 'text-emerald-600' : 'text-amber-600')}>
                Certificate: {certTrusted ? 'Trusted' : 'Not trusted — complete setup in Settings → Certificate'}
              </p>
              <Button onClick={() => setStep(1)} disabled={!certTrusted}>
                Continue
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3 text-sm">
              <p>Registers the Yanshuf MCP server in {CLIENT_LABEL[client]} config.</p>
              {stepResults[1] && (
                <p className={stepResults[1].ok ? 'text-emerald-600' : 'text-destructive'}>
                  {stepResults[1].message}
                </p>
              )}
              <Button onClick={() => void runStep(1)} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Install MCP entry
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 text-sm">
              <p>Copy the /yanshuf skill (actual files, not symlinks).</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={skillTarget === 'personal'}
                    onChange={() => setSkillTarget('personal')}
                  />
                  Personal skills directory
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={skillTarget === 'project'}
                    onChange={() => setSkillTarget('project')}
                  />
                  Project repository
                </label>
              </div>
              {skillTarget === 'project' && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void pickProject()}>
                    Choose folder…
                  </Button>
                  <span className="truncate text-xs text-muted-foreground">
                    {projectRoot ?? 'No folder selected'}
                  </span>
                </div>
              )}
              {stepResults[2] && (
                <p className={stepResults[2].ok ? 'text-emerald-600' : 'text-destructive'}>
                  {stepResults[2].message}
                </p>
              )}
              <Button
                onClick={() => void runStep(2)}
                disabled={busy || (skillTarget === 'project' && !projectRoot)}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Install skill
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <p>Installs a sessionEnd hook that clears captures when the chat session closes.</p>
              {stepResults[3] && (
                <p className={stepResults[3].ok ? 'text-emerald-600' : 'text-destructive'}>
                  {stepResults[3].message}
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={() => void runStep(3)} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Install hook
                </Button>
                <Button variant="outline" onClick={() => void runVerify()} disabled={busy}>
                  Verify setup
                </Button>
              </div>
            </div>
          )}

          {step === 4 && verify && (
            <div className="space-y-3 text-sm">
              <ul className="space-y-1">
                <li>{verify.mcpConfigured ? '✓' : '✗'} MCP configured</li>
                <li>{verify.skillInstalled ? '✓' : '✗'} Skill installed</li>
                <li>{verify.hookInstalled ? '✓' : '✗'} SessionEnd hook</li>
                <li>{verify.apiReachable ? '✓' : '✗'} API reachable</li>
                <li>{verify.certTrusted ? '✓' : '✗'} Certificate trusted</li>
              </ul>
              {verify.details.length > 0 && (
                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                  {verify.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground">Restart {CLIENT_LABEL[client]} to pick up changes. Invoke with /yanshuf.</p>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
