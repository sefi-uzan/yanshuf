import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  ComposedEntry,
  ComposerRequest,
} from '@yanshuf/shared';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ScrollArea,
} from '@yanshuf/ui';
import { DropCaptureZone } from '@/components/DropCaptureZone';
import {
  WorkspaceEmptyCards,
  WorkspaceShell,
} from '@/components/workspace/WorkspaceShell';
import {
  formatRelativeTime,
  methodBadgeClass,
  methodBorderClass,
} from '@/components/workspace/method-styles';
import { cn } from '@yanshuf/ui/lib/utils';
import { withCertGate } from '@/lib/cert-gate';
import { captureToComposerRequest } from './captureToComposer';
import { composedListLabel, MAX_COMPOSED_ENTRIES } from './composerUtils';
import { notifyDeleted, notifyRemoved } from '@/lib/toast-actions';
import { normalizeRequest, RequestEditor } from './RequestEditor';
import { Clock, MoreVertical, PenLine, Plus, Send, Trash2 } from 'lucide-react';

const emptyRequest: ComposerRequest = {
  method: 'GET',
  url: 'https://httpbin.org/get',
  headers: { 'Content-Type': 'application/json' },
  body: '',
};

interface ComposerWorkspaceProps {
  loadFromEntryId?: string | null;
  onLoadHandled?: () => void;
  onCertBlocked?: () => void;
}

export function ComposerWorkspace({
  loadFromEntryId,
  onLoadHandled,
  onCertBlocked,
}: ComposerWorkspaceProps) {
  const [request, setRequest] = useState<ComposerRequest>(emptyRequest);
  const [composed, setComposed] = useState<ComposedEntry[]>([]);
  const [selectedComposedId, setSelectedComposedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [composedToDelete, setComposedToDelete] = useState<string | null>(null);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const applyRequest = (next: ComposerRequest) => {
    setRequest(next);
    setEditorKey((key) => key + 1);
  };

  const pendingDelete = composed.find((entry) => entry.id === composedToDelete);

  useEffect(() => {
    void window.yanshuf.composer.getComposed().then(setComposed);
  }, []);

  useEffect(() => {
    if (!loadFromEntryId) return;
    void window.yanshuf.capture.get(loadFromEntryId).then((entry) => {
      if (entry) {
        applyRequest(normalizeRequest(captureToComposerRequest(entry)));
        setSelectedComposedId(null);
      }
      onLoadHandled?.();
    });
  }, [loadFromEntryId, onLoadHandled]);

  const saveComposed = async (next: ComposedEntry[]) => {
    setComposed(next);
    await window.yanshuf.composer.saveComposed(next);
  };

  const loadFromCapture = async (entryId: string) => {
    const entry = await window.yanshuf.capture.get(entryId);
    if (!entry) return;
    applyRequest(normalizeRequest(captureToComposerRequest(entry)));
    setSelectedComposedId(null);
  };

  const loadComposed = (entry: ComposedEntry) => {
    setSelectedComposedId(entry.id);
    applyRequest(normalizeRequest({ ...entry.request }));
  };

  const startNewRequest = () => {
    setSelectedComposedId(null);
    applyRequest(emptyRequest);
  };

  const deleteComposed = (id: string) => {
    const removed = composed.find((entry) => entry.id === id);
    const next = composed.filter((entry) => entry.id !== id);
    void saveComposed(next);
    if (removed) {
      notifyDeleted(composedListLabel(removed.request));
    }
    if (selectedComposedId === id) {
      setSelectedComposedId(null);
      applyRequest(emptyRequest);
    }
  };

  const clearHistory = () => {
    void saveComposed([]);
    setSelectedComposedId(null);
    applyRequest(emptyRequest);
    notifyRemoved('Composer history');
  };

  const send = async () => {
    setLoading(true);
    try {
      const response = await withCertGate(
        () => window.yanshuf.composer.send(normalizeRequest(request)),
        () => onCertBlocked?.(),
      );
      if (!response) return;
      const entry: ComposedEntry = {
        id: uuidv4(),
        sentAt: Date.now(),
        request: normalizeRequest({ ...request }),
        lastStatus: response.status,
        lastDurationMs: response.durationMs,
      };
      const next = [entry, ...composed].slice(0, MAX_COMPOSED_ENTRIES);
      await saveComposed(next);
      setSelectedComposedId(entry.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropCaptureZone
      className="h-full min-h-0"
      hint="Drop capture to load request"
      onDropCapture={(id) => void loadFromCapture(id)}
    >
      <WorkspaceShell
        title="Composer"
        description="Build and send HTTP requests — results appear in the session list."
        headerActions={(
          <>
            {composed.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setClearHistoryOpen(true)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Clear history
              </Button>
            )}
            <Button size="sm" onClick={startNewRequest}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New request
            </Button>
          </>
        )}
        sidebar={(
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
              {composed.length === 0 ? (
                <div className="px-1 py-2">
                  <WorkspaceEmptyCards
                    compact
                    heading="No history yet"
                    description="Quick-start templates:"
                    cards={[
                      {
                        key: 'new',
                        icon: <Send className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
                        title: 'Blank GET',
                        description: 'httpbin.org/get starter.',
                        accent: 'text-violet-600 dark:text-violet-400',
                        border: 'hover:border-violet-500/40 hover:bg-violet-500/[0.04]',
                        onClick: startNewRequest,
                      },
                      {
                        key: 'sample-post',
                        icon: <PenLine className="h-4 w-4 text-sky-600 dark:text-sky-400" />,
                        title: 'Sample POST',
                        description: 'JSON body template.',
                        accent: 'text-sky-600 dark:text-sky-400',
                        border: 'hover:border-sky-500/40 hover:bg-sky-500/[0.04]',
                        onClick: () => {
                          setSelectedComposedId(null);
                          applyRequest({
                            method: 'POST',
                            url: 'https://httpbin.org/post',
                            headers: { 'Content-Type': 'application/json' },
                            body: '{\n  "hello": "world"\n}',
                          });
                        },
                      },
                    ]}
                  />
                </div>
              ) : (
                composed.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'group mb-1 flex w-full items-center gap-1 rounded-md border border-transparent border-l-[3px] py-2 pl-1 pr-1 transition-colors hover:bg-accent/50',
                      methodBorderClass(entry.request.method),
                      selectedComposedId === entry.id && 'border-border bg-accent shadow-sm',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => loadComposed(entry)}
                      className="flex min-w-0 flex-1 flex-col items-start px-1 text-left text-sm hover:bg-transparent"
                    >
                      <span className="flex w-full min-w-0 items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-4 shrink-0 px-1.5 font-mono text-[9px] font-semibold uppercase',
                            methodBadgeClass(entry.request.method),
                          )}
                        >
                          {entry.request.method}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {composedListLabel(entry.request)}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center gap-2 pl-0.5">
                        {entry.lastStatus !== undefined && (
                          <Badge
                            variant={entry.lastStatus >= 200 && entry.lastStatus < 300 ? 'success' : 'secondary'}
                            className="h-4 px-1.5 text-[9px] tabular-nums"
                          >
                            {entry.lastStatus}
                          </Badge>
                        )}
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(entry.sentAt)}
                        </span>
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
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
        )}
        sidebarHeader={composed.length > 0 ? (
          <div className="border-b px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              History
            </p>
            <p className="text-[11px] text-muted-foreground">
              {composed.length} sent request{composed.length === 1 ? '' : 's'}
            </p>
          </div>
        ) : undefined}
      >
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            {composed.length === 0 && (
              <p className="mb-4 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Drag a captured request from the session list to pre-fill the editor, or pick a template from history.
              </p>
            )}
            <RequestEditor
              request={request}
              onChange={setRequest}
              editorKey={editorKey}
              loading={loading}
              onSend={send}
            />
          </div>
        </ScrollArea>
      </WorkspaceShell>

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

      <Dialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear composer history?</DialogTitle>
            <DialogDescription>
              This will remove all {composed.length} sent request{composed.length === 1 ? '' : 's'} from your history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setClearHistoryOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearHistory();
                setClearHistoryOpen(false);
              }}
            >
              Clear history
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DropCaptureZone>
  );
}
