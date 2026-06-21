import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  IntegrationClient,
  IntegrationClientStatus,
  IntegrationSkillStatus,
  IntegrationStatusResult,
  IntegrationUninstallPayload,
} from '@yanshuf/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@yanshuf/ui';
import { ChevronDown, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@yanshuf/ui/lib/utils';
import { CLIENT_LABEL } from '@yanshuf/shared';
import { PrerequisitesStrip } from '../integration/PrerequisitesStrip';
import { SettingsAlert, SettingsSection } from './SettingsLayout';
import { notifyActionFailed } from '@/lib/toast-actions';

interface AiIntegrationSettingsProps {
  active: boolean;
  focusUpdates?: boolean;
  integrationStatusNonce?: number;
  onOpenOnboarding: (client: IntegrationClient) => void;
  onOpenCertificate?: () => void;
  onStatusChange?: () => void;
}

const REFRESH_MIN_MS = 400;

const STATUS_LABEL = {
  not_installed: 'Not set up',
  installed: 'Connected',
  update_available: 'Update available',
} as const;

type PendingUninstall = IntegrationUninstallPayload & {
  title: string;
  description: string;
};

export function AiIntegrationSettings({
  active,
  focusUpdates = false,
  integrationStatusNonce = 0,
  onOpenOnboarding,
  onOpenCertificate,
  onStatusChange,
}: AiIntegrationSettingsProps) {
  const [status, setStatus] = useState<IntegrationStatusResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [pendingUninstall, setPendingUninstall] = useState<PendingUninstall | null>(null);
  const updatePanelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(
    async (options?: { animate?: boolean; notifyParent?: boolean }) => {
      if (options?.animate) setRefreshing(true);
      const minDelay = options?.animate
        ? new Promise<void>((resolve) => setTimeout(resolve, REFRESH_MIN_MS))
        : Promise.resolve();
      try {
        const [result] = await Promise.all([
          window.yanshuf.integration.status(),
          minDelay,
        ]);
        setStatus(result);
        if (options?.notifyParent) onStatusChange?.();
      } finally {
        if (options?.animate) setRefreshing(false);
      }
    },
    [onStatusChange],
  );

  useEffect(() => {
    if (active) void refresh();
  }, [active, integrationStatusNonce, refresh]);

  useEffect(() => {
    if (active && focusUpdates && status?.status === 'update_available') {
      updatePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [active, focusUpdates, status?.status]);

  const handleUpdateAll = async () => {
    setUpdating(true);
    try {
      const result = await window.yanshuf.integration.update();
      if (!result.ok) {
        notifyActionFailed('update integrations', new Error('Some updates failed'));
      }
      await refresh({ notifyParent: true });
    } catch (error) {
      notifyActionFailed('update integrations', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateClient = async (client: IntegrationClient) => {
    setBusy(true);
    try {
      await window.yanshuf.integration.update({ client });
      await refresh({ notifyParent: true });
    } catch (error) {
      notifyActionFailed('update integration', error);
    } finally {
      setBusy(false);
    }
  };

  const handleInstallProject = async (client: IntegrationClient) => {
    const dir = await window.yanshuf.dialog.pickDirectory({ title: 'Select repository root' });
    if (!dir) return;
    setBusy(true);
    try {
      await window.yanshuf.integration.installStep('skill', client, { kind: 'project', repoRoot: dir });
      await window.yanshuf.integration.record(client, [{ kind: 'project', repoRoot: dir }], true);
      await refresh({ notifyParent: true });
    } catch (error) {
      notifyActionFailed('install to project', error);
    } finally {
      setBusy(false);
    }
  };

  const confirmUninstall = async () => {
    if (!pendingUninstall) return;
    setBusy(true);
    try {
      const result = await window.yanshuf.integration.uninstall(pendingUninstall);
      if (!result.ok) {
        notifyActionFailed('uninstall', new Error(result.message));
      }
      setPendingUninstall(null);
      await refresh({ notifyParent: true });
    } catch (error) {
      notifyActionFailed('uninstall', error);
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Integrations"
        description="Connect Cursor or Claude Code via MCP."
        actions={
          <IntegrationActionsMenu
            hasAnyInstall={status.hasAnyInstall}
            busy={busy}
            onOpenOnboarding={onOpenOnboarding}
            onInstallProject={(client) => void handleInstallProject(client)}
          />
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Bundle {status.manifest.bundleVersion}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status.status} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refresh({ animate: true })}
              disabled={busy || refreshing}
              aria-label={refreshing ? 'Refreshing' : 'Refresh'}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </SettingsSection>

      {status.prerequisites && (
        <PrerequisitesStrip
          prereqs={status.prerequisites}
          variant="inline"
          onOpenCertificate={onOpenCertificate}
        />
      )}

      {status.status === 'update_available' && (
        <div ref={updatePanelRef}>
          <SettingsAlert
            variant="warning"
            action={
              <Button
                size="sm"
                onClick={() => void handleUpdateAll()}
                disabled={updating || busy}
              >
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Update all'
                )}
              </Button>
            }
          >
            <p>Updates available for one or more components.</p>
          </SettingsAlert>
        </div>
      )}

      {status.clients.length === 0 ? (
        <EmptyIntegrationsState
          busy={busy}
          onOpenOnboarding={onOpenOnboarding}
        />
      ) : (
        <div className="space-y-3">
          {status.clients.map((clientStatus) => (
            <ClientIntegrationCard
              key={clientStatus.client}
              clientStatus={clientStatus}
              busy={busy}
              onUpdate={() => void handleUpdateClient(clientStatus.client)}
              onUninstall={(payload, title, description) =>
                setPendingUninstall({ ...payload, title, description })
              }
            />
          ))}
        </div>
      )}

      <UninstallConfirmDialog
        open={Boolean(pendingUninstall)}
        title={pendingUninstall?.title ?? ''}
        description={pendingUninstall?.description ?? ''}
        busy={busy}
        onConfirm={() => void confirmUninstall()}
        onCancel={() => setPendingUninstall(null)}
      />
    </div>
  );
}

function IntegrationActionsMenu({
  hasAnyInstall,
  busy,
  onOpenOnboarding,
  onInstallProject,
}: {
  hasAnyInstall: boolean;
  busy: boolean;
  onOpenOnboarding: (client: IntegrationClient) => void;
  onInstallProject: (client: IntegrationClient) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={busy}>
          <Plus className="mr-1.5 h-4 w-4" />
          {hasAnyInstall ? 'Add' : 'Set up'}
          <ChevronDown className="ml-1.5 h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onOpenOnboarding('cursor')}>
          {hasAnyInstall ? 'Set up Cursor…' : 'Cursor'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpenOnboarding('claude-code')}>
          {hasAnyInstall ? 'Set up Claude Code…' : 'Claude Code'}
        </DropdownMenuItem>
        {hasAnyInstall && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Add skills to project</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => onInstallProject('cursor')}>
                  For Cursor…
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onInstallProject('claude-code')}>
                  For Claude Code…
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyIntegrationsState({
  busy,
  onOpenOnboarding,
}: {
  busy: boolean;
  onOpenOnboarding: (client: IntegrationClient) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">
        No AI integrations configured yet.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenOnboarding('cursor')}
          disabled={busy}
        >
          Set up Cursor
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenOnboarding('claude-code')}
          disabled={busy}
        >
          Set up Claude Code
        </Button>
      </div>
    </div>
  );
}

function ClientIntegrationCard({
  clientStatus,
  busy,
  onUpdate,
  onUninstall,
}: {
  clientStatus: IntegrationClientStatus;
  busy: boolean;
  onUpdate: () => void;
  onUninstall: (payload: IntegrationUninstallPayload, title: string, description: string) => void;
}) {
  const label = CLIENT_LABEL[clientStatus.client];

  return (
    <div className="rounded-lg border bg-muted/10">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="font-medium text-sm">{label}</div>
        <div className="flex items-center gap-1">
          {clientStatus.outdated && (
            <Button variant="outline" size="sm" onClick={onUpdate} disabled={busy}>
              Update
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() =>
              onUninstall(
                { client: clientStatus.client, scope: 'client' },
                `Uninstall all from ${label}?`,
                `Removes the MCP entry, sessionEnd hook, and all tracked /yanshuf skills for ${label}. This cannot be undone.`,
              )
            }
          >
            Uninstall all
          </Button>
        </div>
      </div>
      <ul className="divide-y text-sm">
        {(clientStatus.mcp.configured || clientStatus.mcp.tracked) && (
          <ComponentRow
            name="MCP server"
            path={clientStatus.mcp.configPath ?? clientStatus.mcp.path}
            configured={clientStatus.mcp.configured}
            outdated={clientStatus.mcp.outdated}
            busy={busy}
            onRemove={() =>
              onUninstall(
                { client: clientStatus.client, scope: 'mcp' },
                `Remove MCP from ${label}?`,
                `Removes the yanshuf MCP server entry from ${clientStatus.mcp.configPath ?? 'config'}.`,
              )
            }
          />
        )}
        {(clientStatus.hook.configured || clientStatus.hook.tracked) && (
          <ComponentRow
            name="Hook - SessionEnd"
            path={clientStatus.hook.configPath ?? clientStatus.hook.path}
            configured={clientStatus.hook.configured}
            outdated={false}
            busy={busy}
            onRemove={() =>
              onUninstall(
                { client: clientStatus.client, scope: 'hook' },
                `Remove hook from ${label}?`,
                `Removes the Yanshuf sessionEnd cleanup hook from ${clientStatus.hook.configPath ?? 'config'}.`,
              )
            }
          />
        )}
        {clientStatus.skills.map((skill) => (
          <ComponentRow
            key={skill.id}
            name={formatSkillLabel(skill)}
            path={skill.path}
            configured={skill.configured}
            outdated={skill.outdated}
            busy={busy}
            onRemove={() =>
              onUninstall(
                { client: clientStatus.client, scope: 'skill', skillId: skill.id },
                `Remove skill from ${label}?`,
                `Deletes the /yanshuf skill files at ${skill.path}. This cannot be undone.`,
              )
            }
          />
        ))}
      </ul>
    </div>
  );
}

function formatSkillLabel(skill: IntegrationSkillStatus): string {
  if (skill.kind === 'personal') {
    return 'Skill personal (applies to all projects)';
  }

  const projectName = skill.repoRoot
    ? skill.repoRoot.replace(/\/+$/, '').split('/').pop() ?? skill.repoRoot
    : 'project';

  return `Skill ${projectName}`;
}

function ComponentRow({
  name,
  path,
  configured,
  outdated,
  busy,
  onRemove,
}: {
  name: string;
  path: string;
  configured: boolean;
  outdated: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{name}</span>
          {!configured && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              missing
            </span>
          )}
          {outdated && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              outdated
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{path}</div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        aria-label={`Remove ${name}`}
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </li>
  );
}

function StatusBadge({ status }: { status: IntegrationStatusResult['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'installed' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        status === 'update_available' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
        status === 'not_installed' && 'bg-muted text-muted-foreground',
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function UninstallConfirmDialog({
  open,
  title,
  description,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Removing…
              </>
            ) : (
              'Remove'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
