import { Button } from '@yanshuf/ui';
import { Loader2, X } from 'lucide-react';
import type { IntegrationStepResult } from '@yanshuf/shared';

interface SkillsStepProps {
  installPersonal: boolean;
  projectRoots: string[];
  busy: boolean;
  result?: IntegrationStepResult;
  onTogglePersonal: (value: boolean) => void;
  onAddProject: () => void;
  onRemoveProject: (root: string) => void;
  onInstall: () => void;
}

export function SkillsStep({
  installPersonal,
  projectRoots,
  busy,
  result,
  onTogglePersonal,
  onAddProject,
  onRemoveProject,
  onInstall,
}: SkillsStepProps) {
  const canInstall = installPersonal || projectRoots.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Add /yanshuf skill</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Copies the skill files (not symlinks). You can install to personal and multiple projects.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={installPersonal}
          onChange={(e) => onTogglePersonal(e.target.checked)}
        />
        Personal skills directory
      </label>
      <div className="space-y-2">
        <div className="text-sm font-medium">Project repositories</div>
        {projectRoots.length === 0 && (
          <p className="text-xs text-muted-foreground">No projects added yet.</p>
        )}
        <ul className="space-y-1">
          {projectRoots.map((root) => (
            <li
              key={root}
              className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1 text-xs"
            >
              <span className="min-w-0 flex-1 truncate">{root}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onRemoveProject(root)}
                aria-label={`Remove ${root}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" onClick={onAddProject} disabled={busy}>
          Add project…
        </Button>
      </div>
      {result && (
        <p className={result.ok ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}>
          {result.message}
        </p>
      )}
      <Button className="w-full" size="lg" onClick={onInstall} disabled={busy || !canInstall}>
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Installing…
          </>
        ) : (
          'Install skill(s)'
        )}
      </Button>
    </div>
  );
}
