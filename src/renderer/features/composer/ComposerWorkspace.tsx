import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  ComposedEntry,
  ComposerRequest,
} from '../../../shared/types';
import { exportCurl } from '../../../shared/composer-curl';
import { HTTP_METHODS, methodSupportsBody, normalizeBodyForMethod } from '../../../shared/http';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
} from '@/components/ui/floating-label-input';
import { CopyUrlButton } from '@/components/CopyUrlButton';
import { DropCaptureZone } from '@/components/DropCaptureZone';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/copy';
import { withCertGate } from '@/lib/cert-gate';
import { captureToComposerRequest } from './captureToComposer';
import { composedListLabel, MAX_COMPOSED_ENTRIES } from './composerUtils';
import { notifyDeleted, notifyRemoved } from '@/lib/toast-actions';
import { Check, ChevronDown, ChevronRight, Copy, MoreVertical, PenLine, Plus, Trash2, X } from 'lucide-react';

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
  onCertBlocked?: () => void;
}

export function ComposerWorkspace({ loadFromEntryId, onLoadHandled, onCertBlocked }: ComposerWorkspaceProps) {
  const [request, setRequest] = useState<ComposerRequest>(emptyRequest);
  const [composed, setComposed] = useState<ComposedEntry[]>([]);
  const [selectedComposedId, setSelectedComposedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [composedToDelete, setComposedToDelete] = useState<string | null>(null);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  // Bumped whenever the request is replaced wholesale (load/reset) so the
  // headers editor re-seeds its local rows from the new request.
  const [editorKey, setEditorKey] = useState(0);

  const applyRequest = (next: ComposerRequest) => {
    setRequest(next);
    setEditorKey((key) => key + 1);
  };

  const pendingDelete = composed.find((entry) => entry.id === composedToDelete);
  const bodyEnabled = methodSupportsBody(request.method);
  const curlPreview = useMemo(
    () => exportCurl(normalizeRequest(request)),
    [request],
  );

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

          <div className="flex min-h-0 min-w-0 flex-col gap-3 pt-2.5">
            <div className="flex min-w-0 items-end gap-2">
              <FloatingLabelInput
                wrapperClassName="min-w-0 flex-1"
                className="font-mono"
                label="URL"
                value={request.url}
                onChange={(e) => setRequest({ ...request, url: e.target.value })}
              />
              <CopyUrlButton value={request.url} title="Copy URL" className="mb-0.5 shrink-0" />
            </div>

            <div className="flex items-end gap-2">
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
              <div className="flex-1" />
              <CopyCurlButton value={curlPreview} className="mb-0.5 shrink-0" />
              <Button className="mb-0.5 shrink-0" onClick={send} disabled={loading}>
                {loading ? 'Sending…' : 'Send Request'}
              </Button>
            </div>

            <RequestHeadersEditor
              key={editorKey}
              headers={request.headers}
              onChange={(headers) => setRequest((prev) => ({ ...prev, headers }))}
            />

            <div className="flex min-h-0 flex-1 flex-col rounded-md border">
              <div className="flex shrink-0 items-center justify-between border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Body</span>
                {!bodyEnabled && (
                  <span className="font-normal text-muted-foreground/70">
                    {request.method.toUpperCase()} has no body
                  </span>
                )}
              </div>
              <Textarea
                className="min-h-0 flex-1 resize-none rounded-none border-0 bg-muted/20 font-mono text-xs shadow-none focus-visible:ring-0 disabled:opacity-60"
                spellCheck={false}
                disabled={!bodyEnabled}
                placeholder={bodyEnabled ? 'Request body' : `${request.method.toUpperCase()} requests cannot include a body`}
                value={bodyEnabled ? (request.body ?? '') : ''}
                onChange={(e) => setRequest((prev) => ({ ...prev, body: e.target.value }))}
              />
            </div>
          </div>
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

function CopyCurlButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(value, { message: 'cURL copied to clipboard' });
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      title="Copy as cURL"
      disabled={!value}
      onClick={() => void handleCopy()}
    >
      {copied ? (
        <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="mr-1 h-3.5 w-3.5" />
      )}
      cURL
    </Button>
  );
}

interface HeaderRow {
  id: string;
  key: string;
  value: string;
}

function headersToRows(headers: Record<string, string>): HeaderRow[] {
  return Object.entries(headers).map(([key, value]) => ({ id: uuidv4(), key, value }));
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) headers[key] = row.value;
  }
  return headers;
}

function RequestHeadersEditor({
  headers,
  onChange,
}: {
  headers: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(true);
  const [rows, setRows] = useState<HeaderRow[]>(() => headersToRows(headers));

  const commit = (next: HeaderRow[]) => {
    setRows(next);
    onChange(rowsToHeaders(next));
  };

  const addRow = () => {
    setOpen(true);
    commit([...rows, { id: uuidv4(), key: '', value: '' }]);
  };

  const count = rows.filter((row) => row.key.trim()).length;

  return (
    <div className="rounded-md border">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent/50"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          Headers
          {count > 0 && <span className="font-normal text-muted-foreground/70">({count})</span>}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mr-1 h-7 shrink-0 px-2 text-xs"
          onClick={addRow}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      {open && (
        <div className="border-t">
          {rows.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No headers.{' '}
              <button type="button" className="text-foreground underline-offset-2 hover:underline" onClick={addRow}>
                Add one
              </button>
            </div>
          ) : (
            rows.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_32px] items-center gap-2 border-b px-2 py-1.5 last:border-b-0"
              >
                <Input
                  className="h-7 font-mono text-xs"
                  placeholder="Header"
                  value={row.key}
                  onChange={(e) => {
                    const next = [...rows];
                    next[index] = { ...row, key: e.target.value };
                    commit(next);
                  }}
                />
                <Input
                  className="h-7 font-mono text-xs"
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => {
                    const next = [...rows];
                    next[index] = { ...row, value: e.target.value };
                    commit(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  aria-label="Remove header"
                  onClick={() => commit(rows.filter((item) => item.id !== row.id))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
