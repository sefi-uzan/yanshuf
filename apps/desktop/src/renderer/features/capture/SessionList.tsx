import { useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CaptureEntrySummary } from '@yanshuf/shared';
import { Badge ,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import { copyToClipboard, urlWithoutQuery } from '@/lib/copy';
import { captureToComposerRequest , formatDuration , CAPTURE_DRAG_MIME , exportCurl } from '@yanshuf/shared';
import { Copy, Ellipsis, Lock, PauseCircle, PenLine, Zap, ArrowRightLeft } from 'lucide-react';

interface SessionListProps {
  entries: CaptureEntrySummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  draggable?: boolean;
  onAddToComposer?: (id: string) => void;
  onCreateRule?: (id: string) => void;
  onCreateMapRemoteRule?: (id: string) => void;
}

function statusVariant(status: number): 'success' | 'warning' | 'error' | 'secondary' {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'warning';
  if (status >= 400) return 'error';
  return 'secondary';
}

function matchesSearch(entry: CaptureEntrySummary, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    entry.url.toLowerCase().includes(q) ||
    entry.host.toLowerCase().includes(q) ||
    entry.method.toLowerCase().includes(q) ||
    String(entry.status).includes(q)
  );
}

const SESSION_LIST_GRID = 'grid-cols-[56px_minmax(0,1fr)_48px_72px]';
const TIME_CELL = 'relative pr-4 text-right';

export function SessionList({
  entries,
  selectedId,
  onSelect,
  searchQuery,
  draggable,
  onAddToComposer,
  onCreateRule,
  onCreateMapRemoteRule,
}: SessionListProps) {
  const filtered = useMemo(
    () => entries.filter((e) => matchesSearch(e, searchQuery)),
    [entries, searchQuery],
  );
  const parentRef = useRef<HTMLDivElement>(null);
  const prevEntryCountRef = useRef(entries.length);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });
  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  useEffect(() => {
    const prevCount = prevEntryCountRef.current;
    prevEntryCountRef.current = entries.length;
    if (entries.length <= prevCount || filtered.length === 0) return;

    // Only auto-follow new rows when the user is already near the bottom,
    // so we don't yank them away while they're inspecting an earlier request.
    const el = parentRef.current;
    const nearBottom =
      !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (!nearBottom) return;

    requestAnimationFrame(() => {
      virtualizerRef.current.scrollToIndex(filtered.length - 1, { align: 'end' });
    });
  }, [entries.length, filtered.length]);

  return (
    <div className="flex h-full flex-col border-r" data-tour="capture-area">
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={cn(
            'sticky top-0 z-10 grid gap-2 border-b bg-background px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground',
            SESSION_LIST_GRID,
          )}
        >
          <span>Method</span>
          <span>URL</span>
          <span className="text-center">Status</span>
          <span className={TIME_CELL}>Time</span>
        </div>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = filtered[virtualRow.index];
              const isAutoResponded = Boolean(entry.matchedRuleId);
              const isMapRemote = Boolean(entry.matchedMapRemoteRuleId);
              const isAwaitingBreakpoint = Boolean(entry.awaitingBreakpoint);
              const isFromComposer = Boolean(entry.fromComposer);
              return (
                <div
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  draggable={draggable}
                  onDragStart={(e) => {
                    if (!draggable) return;
                    e.dataTransfer.setData(CAPTURE_DRAG_MIME, entry.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => onSelect(entry.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(entry.id);
                    }
                  }}
                  title={
                    draggable
                      ? 'Drag to Composer or Rules'
                      : isAwaitingBreakpoint
                        ? 'Paused at breakpoint'
                      : isAutoResponded
                        ? 'Matched by Auto Responder'
                        : isMapRemote
                          ? 'Forwarded via Map Remote'
                        : isFromComposer
                          ? 'Sent from Composer'
                          : undefined
                  }
                  className={cn(
                    'absolute left-0 top-0 grid w-full cursor-default items-center gap-2 border-b px-3 py-2 text-left text-xs hover:bg-accent/50 hover:[&_.capture-row-menu-hint]:opacity-80',
                    SESSION_LIST_GRID,
                    isAwaitingBreakpoint && 'border-l-2 border-l-sky-500 bg-sky-500/[0.08] hover:bg-sky-500/15',
                    isAutoResponded && !isAwaitingBreakpoint && 'border-l-2 border-l-amber-500 bg-amber-500/[0.08] hover:bg-amber-500/15',
                    isMapRemote && !isAutoResponded && !isAwaitingBreakpoint && 'border-l-2 border-l-emerald-500 bg-emerald-500/[0.08] hover:bg-emerald-500/15',
                    isFromComposer && !isAutoResponded && !isMapRemote && !isAwaitingBreakpoint && 'border-l-2 border-l-primary bg-primary/[0.08] hover:bg-primary/15',
                    selectedId === entry.id && !isAutoResponded && !isFromComposer && !isMapRemote && !isAwaitingBreakpoint && 'bg-accent',
                    selectedId === entry.id && isAwaitingBreakpoint && 'bg-sky-500/20',
                    selectedId === entry.id && isAutoResponded && !isAwaitingBreakpoint && 'bg-amber-500/20',
                    selectedId === entry.id && isMapRemote && !isAutoResponded && !isAwaitingBreakpoint && 'bg-emerald-500/20',
                    selectedId === entry.id && isFromComposer && !isAutoResponded && !isMapRemote && !isAwaitingBreakpoint && 'bg-primary/20',
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <span className="flex items-center">
                    <Badge
                      variant="outline"
                      className="shrink-0 px-1 py-0 font-mono text-[10px] leading-4"
                    >
                      {entry.method}
                    </Badge>
                  </span>
                  <span className="flex min-w-0 items-center gap-1 font-mono">
                    {isAwaitingBreakpoint && (
                      <PauseCircle className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" />
                    )}
                    {isAutoResponded && !isAwaitingBreakpoint && (
                      <Zap className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    {isMapRemote && !isAutoResponded && !isAwaitingBreakpoint && (
                      <ArrowRightLeft className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                    {isFromComposer && !isAutoResponded && !isMapRemote && (
                      <PenLine className="h-3 w-3 shrink-0 text-primary" />
                    )}
                    {entry.tls && <Lock className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{entry.host}{entry.path}</span>
                  </span>
                  <span className="flex items-center justify-center">
                    <Badge
                      variant={isAwaitingBreakpoint ? 'secondary' : statusVariant(entry.status)}
                      className="h-4 min-w-[2.25rem] px-1 py-0 font-mono text-[10px] leading-none tabular-nums"
                    >
                      {isAwaitingBreakpoint ? 'BP' : entry.status || '—'}
                    </Badge>
                  </span>
                  <span className={cn(TIME_CELL, 'text-muted-foreground')}>
                    {formatDuration(entry.durationMs)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          title="Request actions"
                          aria-label="Request actions"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="capture-row-menu-hint absolute -right-1 top-1/2 inline-flex -translate-y-1/2 rounded-sm p-0.5 text-foreground/70 opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground focus-visible:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:opacity-100"
                        >
                          <Ellipsis className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onSelect={() => onAddToComposer?.(entry.id)}>
                          <PenLine className="mr-2 h-4 w-4" />
                          Add to Composer
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onCreateRule?.(entry.id)}>
                          <Zap className="mr-2 h-4 w-4" />
                          Create Mock Rule
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onCreateMapRemoteRule?.(entry.id)}>
                          <ArrowRightLeft className="mr-2 h-4 w-4" />
                          Create Map Remote Rule
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onSelect={() => void copyToClipboard(urlWithoutQuery(entry.url))}
                            >
                              URL (no query)
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void copyToClipboard(entry.url)}>
                              Full URL
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                void (async () => {
                                  const full = await window.yanshuf.capture.get(entry.id);
                                  if (!full) return;
                                  await copyToClipboard(
                                    exportCurl(captureToComposerRequest(full)),
                                  );
                                })();
                              }}
                            >
                              cURL
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
              );
          })}
        </div>
      </div>
      <div className="border-t bg-muted/10 px-3 py-1.5 text-xs text-muted-foreground">
        {filtered.length} / {entries.length} requests
        {entries.some((e) => e.matchedRuleId) && (
          <span className="ml-2 text-amber-600 dark:text-amber-400">
            · {entries.filter((e) => e.matchedRuleId).length} mocked
          </span>
        )}
        {entries.some((e) => e.matchedMapRemoteRuleId) && (
          <span className="ml-2 text-emerald-600 dark:text-emerald-400">
            · {entries.filter((e) => e.matchedMapRemoteRuleId).length} mapped
          </span>
        )}
        {entries.some((e) => e.fromComposer) && (
          <span className="ml-2 text-primary">
            · {entries.filter((e) => e.fromComposer).length} composed
          </span>
        )}
      </div>
    </div>
  );
}
