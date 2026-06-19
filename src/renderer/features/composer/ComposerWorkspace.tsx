import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  ComposedEntry,
  ComposerEnvironment,
  ComposerRequest,
} from '../../../shared/types';
import { exportCurl } from '../../../shared/composer-curl';
import { HTTP_METHODS, methodSupportsBody, normalizeBodyForMethod } from '../../../shared/http';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  FloatingLabelTextarea,
} from '@/components/ui/floating-label-input';
import { CopyUrlButton } from '@/components/CopyUrlButton';
import { DropCaptureZone } from '@/components/DropCaptureZone';
import { cn } from '@/lib/utils';
import { captureToComposerRequest } from './captureToComposer';
import { composedListLabel, MAX_COMPOSED_ENTRIES, requestHostname } from './composerUtils';
import { EnvironmentManagerDialog } from './EnvironmentManagerDialog';
import { MoreVertical, Plus, Settings } from 'lucide-react';

const emptyRequest: ComposerRequest = {
  method: 'GET',
  url: 'https://httpbin.org/get',
  headers: { 'Content-Type': 'application/json' },
  body: '',
};

function normalizeRequest(request: ComposerRequest): ComposerRequest {
  return {
    ...request,
    body: normalizeBodyForMethod(request.method, request.body),
  };
}

interface ComposerWorkspaceProps {
  loadFromEntryId?: string | null;
  onLoadHandled?: () => void;
  onSent?: () => void;
}

export function ComposerWorkspace({ loadFromEntryId, onLoadHandled, onSent }: ComposerWorkspaceProps) {
  const [request, setRequest] = useState<ComposerRequest>(emptyRequest);
  const [environments, setEnvironments] = useState<ComposerEnvironment[]>([]);
  const [composed, setComposed] = useState<ComposedEntry[]>([]);
  const [activeEnvId, setActiveEnvId] = useState('default');
  const [selectedComposedId, setSelectedComposedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [envDialogOpen, setEnvDialogOpen] = useState(false);
  const [composedToDelete, setComposedToDelete] = useState<string | null>(null);

  const pendingDelete = composed.find((entry) => entry.id === composedToDelete);
  const activeEnv = environments.find((env) => env.id === activeEnvId);
  const variables = activeEnv?.variables ?? {};
  const bodyEnabled = methodSupportsBody(request.method);
  const curlPreview = useMemo(
    () => exportCurl(normalizeRequest(request)),
    [request],
  );

  useEffect(() => {
    void Promise.all([
      window.yanshuf.composer.getEnvironments(),
      window.yanshuf.composer.getSettings(),
    ]).then(([envs, settings]) => {
      setEnvironments(envs);
      const active = envs.find((env) => env.id === settings.activeEnvironmentId)?.id ?? envs[0]?.id ?? 'default';
      setActiveEnvId(active);
    });
    void window.yanshuf.composer.getComposed().then(setComposed);
  }, []);

  useEffect(() => {
    if (!loadFromEntryId) return;
    void window.yanshuf.capture.get(loadFromEntryId).then((entry) => {
      if (entry) {
        setRequest(normalizeRequest(captureToComposerRequest(entry)));
        setSelectedComposedId(null);
      }
      onLoadHandled?.();
    });
  }, [loadFromEntryId, onLoadHandled]);

  const saveEnvironments = async (envs: ComposerEnvironment[], nextActiveId: string) => {
    setEnvironments(envs);
    setActiveEnvId(nextActiveId);
    await window.yanshuf.composer.saveEnvironments(envs);
    await window.yanshuf.composer.saveSettings({ activeEnvironmentId: nextActiveId });
  };

  const saveComposed = async (next: ComposedEntry[]) => {
    setComposed(next);
    await window.yanshuf.composer.saveComposed(next);
  };

  const setActiveEnvironment = async (envId: string) => {
    setActiveEnvId(envId);
    await window.yanshuf.composer.saveSettings({ activeEnvironmentId: envId });
  };

  const loadFromCapture = async (entryId: string) => {
    const entry = await window.yanshuf.capture.get(entryId);
    if (!entry) return;
    setRequest(normalizeRequest(captureToComposerRequest(entry)));
    setSelectedComposedId(null);
  };

  const loadComposed = (entry: ComposedEntry) => {
    setSelectedComposedId(entry.id);
    setRequest(normalizeRequest({ ...entry.request }));
  };

  const startNewRequest = () => {
    setSelectedComposedId(null);
    setRequest(emptyRequest);
  };

  const deleteComposed = (id: string) => {
    const next = composed.filter((entry) => entry.id !== id);
    void saveComposed(next);
    if (selectedComposedId === id) {
      setSelectedComposedId(null);
      setRequest(emptyRequest);
    }
  };

  const send = async () => {
    setLoading(true);
    try {
      const response = await window.yanshuf.composer.send(normalizeRequest(request), variables);
      const entry: ComposedEntry = {
        id: uuidv4(),
        sentAt: Date.now(),
        name: request.name?.trim() || requestHostname(request.url),
        request: normalizeRequest({ ...request }),
        lastStatus: response.status,
        lastDurationMs: response.durationMs,
      };
      const next = [entry, ...composed].slice(0, MAX_COMPOSED_ENTRIES);
      await saveComposed(next);
      setSelectedComposedId(entry.id);
      onSent?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropCaptureZone
      className="h-full"
      hint="Drop capture to load request"
      onDropCapture={(id) => void loadFromCapture(id)}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <span className="text-sm font-medium">Composer</span>
          <div className="flex items-center gap-1">
            <select
              className="h-8 max-w-[160px] truncate rounded-md border border-input bg-background px-2 text-xs"
              value={activeEnvId}
              onChange={(e) => void setActiveEnvironment(e.target.value)}
              aria-label="Active environment"
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 px-2 text-xs"
              title="Manage environment variables"
              aria-label="Manage environment variables"
              onClick={() => setEnvDialogOpen(true)}
            >
              <Settings className="mr-1 h-3.5 w-3.5" />
              Manage
            </Button>
          </div>
        </div>
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[224px_minmax(0,1fr)] gap-4 p-3">
          <div className="flex min-h-0 flex-col gap-2">
            <Button size="sm" onClick={startNewRequest}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Request
            </Button>
            <ScrollArea className="min-h-0 flex-1 rounded-md border">
              <div className="pr-1">
                {composed.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Sent requests appear here as Composed history.
                  </div>
                ) : (
                  composed.map((entry) => (
                    <div
                      key={entry.id}
                      className={`group flex w-full items-center gap-1.5 border-b py-2 pl-2 pr-1 hover:bg-accent/50 ${selectedComposedId === entry.id ? 'bg-accent' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => loadComposed(entry)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm hover:bg-transparent"
                      >
                        <Badge
                          variant="outline"
                          className="shrink-0 px-1 py-0 font-mono text-[10px] leading-4"
                        >
                          {entry.request.method}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate">{composedListLabel(entry.request)}</span>
                        {entry.lastStatus !== undefined && (
                          <Badge
                            variant={entry.lastStatus >= 200 && entry.lastStatus < 300 ? 'success' : 'secondary'}
                            className="shrink-0 px-1 py-0 text-[10px]"
                          >
                            {entry.lastStatus}
                          </Badge>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                            aria-label={`Actions for ${composedListLabel(entry.request)}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setComposedToDelete(entry.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <ScrollArea className="min-h-0 min-w-0">
            <div className="min-w-0 space-y-3 pt-2.5 pr-3">
              <div className="flex min-w-0 items-end gap-2">
                <FloatingLabelSelect
                  wrapperClassName="w-[112px] shrink-0"
                  label="Method"
                  value={request.method}
                  onChange={(e) => setRequest(normalizeRequest({ ...request, method: e.target.value }))}
                >
                  {HTTP_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </FloatingLabelSelect>
                <FloatingLabelInput
                  wrapperClassName="min-w-0 flex-1"
                  className="font-mono"
                  label="URL"
                  value={request.url}
                  onChange={(e) => setRequest({ ...request, url: e.target.value })}
                />
                <CopyUrlButton value={request.url} title="Copy URL" className="mb-0.5 shrink-0" />
              </div>

              <div className="flex min-w-0 items-end gap-2">
                <FloatingLabelInput
                  wrapperClassName="min-w-0 flex-1"
                  label="Request name"
                  value={request.name ?? ''}
                  onChange={(e) => setRequest({ ...request, name: e.target.value })}
                />
                <Button className="mb-0.5 shrink-0" onClick={send} disabled={loading}>
                  {loading ? 'Sending…' : 'Send Request'}
                </Button>
              </div>

              <Tabs defaultValue="body">
                <TabsList>
                  <TabsTrigger value="body">Body</TabsTrigger>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                  <TabsTrigger value="env">Variables</TabsTrigger>
                </TabsList>
                <TabsContent value="body">
                  <FloatingLabelTextarea
                    className="min-h-[480px] font-mono text-xs"
                    label="Request body"
                    disabled={!bodyEnabled}
                    value={bodyEnabled ? (request.body ?? '{}') : ''}
                    onChange={(e) => setRequest({ ...request, body: e.target.value })}
                  />
                  {!bodyEnabled && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {request.method.toUpperCase()} requests cannot include a body.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="headers">
                  <FloatingLabelTextarea
                    className="min-h-[480px] font-mono text-xs"
                    label="Request headers"
                    value={Object.entries(request.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
                    onChange={(e) => {
                      const headers: Record<string, string> = {};
                      for (const line of e.target.value.split('\n')) {
                        const idx = line.indexOf(':');
                        if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                      }
                      setRequest({ ...request, headers });
                    }}
                  />
                </TabsContent>
                <TabsContent value="curl">
                  <div className="relative min-w-0">
                    <FloatingLabelTextarea
                      readOnly
                      wrapperClassName="w-full"
                      className="min-h-[320px] pr-10 font-mono text-xs"
                      label="cURL command"
                      value={curlPreview}
                    />
                    <CopyUrlButton
                      value={curlPreview}
                      title="Copy cURL"
                      className="absolute right-1.5 top-1.5 z-10 h-7 w-7 bg-background/90 hover:bg-accent"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="env">
                  <ActiveEnvironmentVariables
                    environment={activeEnv}
                    onManage={() => setEnvDialogOpen(true)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </div>
      </div>

      <EnvironmentManagerDialog
        open={envDialogOpen}
        environments={environments}
        activeEnvironmentId={activeEnvId}
        onOpenChange={setEnvDialogOpen}
        onSave={(envs, nextActiveId) => void saveEnvironments(envs, nextActiveId)}
      />

      <Dialog open={composedToDelete !== null} onOpenChange={(open) => !open && setComposedToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete composed request?</DialogTitle>
            <DialogDescription>
              This will remove &quot;{pendingDelete ? composedListLabel(pendingDelete.request) : 'this request'}&quot; from your history.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setComposedToDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (composedToDelete) deleteComposed(composedToDelete);
                setComposedToDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DropCaptureZone>
  );
}

function ActiveEnvironmentVariables({
  environment,
  onManage,
}: {
  environment: ComposerEnvironment | undefined;
  onManage: () => void;
}) {
  if (!environment) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">No environment selected.</p>
      </div>
    );
  }

  const entries = Object.entries(environment.variables);

  return (
    <div className="min-h-[280px] rounded-lg border bg-muted/10">
      <div className="flex items-start justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{environment.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entries.length === 0
              ? 'No variables configured'
              : `${entries.length} variable${entries.length === 1 ? '' : 's'} available for substitution`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          title="Manage environment variables"
          onClick={onManage}
        >
          <Settings className="mr-1 h-3.5 w-3.5" />
          Manage
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Add variables to reuse values across requests.
          </p>
          <p className="mt-2 max-w-sm text-xs text-muted-foreground/80">
            Reference them as{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{'{{baseUrl}}'}</code>
            {' '}in your URL, headers, or body.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onManage}>
            Open environment manager
          </Button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Variable</span>
            <span>Value</span>
          </div>
          <div className="divide-y">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 px-4 py-2.5 font-mono text-xs"
              >
                <span className="truncate text-muted-foreground">{key}</span>
                <span className={cn('truncate', !value && 'italic text-muted-foreground/60')}>
                  {value || 'empty'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
