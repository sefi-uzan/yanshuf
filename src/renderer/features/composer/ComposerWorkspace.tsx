import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  ComposedEntry,
  ComposerRequest,
} from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { DropCaptureZone } from '@/components/DropCaptureZone';
import { cn } from '@/lib/utils';
import { withCertGate } from '@/lib/cert-gate';
import { captureToComposerRequest } from './captureToComposer';
import { composedListLabel, MAX_COMPOSED_ENTRIES } from './composerUtils';
import { notifyDeleted, notifyRemoved } from '@/lib/toast-actions';
import { normalizeRequest, RequestEditor } from './RequestEditor';
import { MoreVertical, PenLine, Plus, Trash2 } from 'lucide-react';

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
      className="h-full"
      hint="Drop capture to load request"
      onDropCapture={(id) => void loadFromCapture(id)}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <span className="text-sm font-medium">Composer</span>
          <div className="flex items-center gap-1.5">
            {composed.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                title="Clear composer history"
                aria-label="Clear composer history"
                onClick={() => setClearHistoryOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" onClick={startNewRequest}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Request
            </Button>
          </div>
        </div>
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[224px_minmax(0,1fr)] gap-4 p-3">
          <div className="flex min-h-0 flex-col gap-2">
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
                      className={cn(
                        'group flex w-full items-center gap-1.5 border-b py-2 pl-2 pr-1 hover:bg-accent/50',
                        selectedComposedId === entry.id && 'bg-accent',
                      )}
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
                        <PenLine className="h-3 w-3 shrink-0 text-primary" />
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

          <RequestEditor
            request={request}
            onChange={setRequest}
            editorKey={editorKey}
            loading={loading}
            onSend={send}
          />
        </div>
      </div>

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
