import { useEffect, useMemo, useRef, useState } from 'react';
import type { AutoResponderRule, InterceptRule, MapRemoteRule } from '@yanshuf/shared';
import { RULE_REORDER_MIME } from '@yanshuf/shared';
import {
  Badge,
  Button,
  Checkbox,
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
import { cn } from '@yanshuf/ui/lib/utils';
import {
  ArrowRightLeft,
  ChevronDown,
  GripVertical,
  MoreVertical,
  PauseCircle,
  PenLine,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import { notifyDeleted, notifyRemoved } from '@/lib/toast-actions';
import { setListItemDragImage, removeListItemDragImage } from '@/lib/dnd';
import { DropCaptureZone } from '@/components/DropCaptureZone';
import { WorkspaceEmptyCards, WorkspaceShell } from '@/components/workspace/WorkspaceShell';
import { captureToAutoResponderRule, captureToMapRemoteRule } from '@yanshuf/shared/capture-to-rule';
import { InterceptRuleEditor } from '@/features/rules/InterceptRuleEditor';
import { MapRemoteRuleEditor } from '@/features/rules/MapRemoteRuleEditor';
import { MockRuleEditor } from '@/features/rules/MockRuleEditor';
import { RuleActionPicker, ruleActionAccentClass } from '@/features/rules/RuleActionPicker';
import { RuleFilterBar, ruleFilterLabel } from '@/features/rules/RuleFilterBar';
import {
  emptyInterceptRule,
  emptyMapRemoteRule,
  emptyMockRule,
  reorderInterceptRules,
  reorderMapRemoteRules,
  reorderMockRules,
  ruleActionFromIntercept,
  ruleActionDescription,
  ruleActionLabel,
  type RuleAction,
  type RuleFilter,
  type SelectedRuleRef,
} from '@/features/rules/rule-types';

interface AutoResponderWorkspaceProps {
  loadFromEntryId?: string | null;
  loadFromEntryKind?: 'mock' | 'mapRemote';
  onLoadHandled?: () => void;
}

type ListEntry =
  | { kind: 'mock'; rule: AutoResponderRule; action: 'mock' }
  | { kind: 'intercept'; rule: InterceptRule; action: RuleAction }
  | { kind: 'mapRemote'; rule: MapRemoteRule; action: 'map-remote' };

export function AutoResponderWorkspace({
  loadFromEntryId,
  loadFromEntryKind = 'mock',
  onLoadHandled,
}: AutoResponderWorkspaceProps) {
  const [mockRules, setMockRules] = useState<AutoResponderRule[]>([]);
  const [interceptRules, setInterceptRules] = useState<InterceptRule[]>([]);
  const [mapRemoteRules, setMapRemoteRules] = useState<MapRemoteRule[]>([]);
  const [selected, setSelected] = useState<SelectedRuleRef | null>(null);
  const [headersDraft, setHeadersDraft] = useState('{}');
  const [requestHeadersDraft, setRequestHeadersDraft] = useState('{}');
  const [responseHeadersDraft, setResponseHeadersDraft] = useState('{}');
  const [ruleToDelete, setRuleToDelete] = useState<SelectedRuleRef | null>(null);
  const [clearRulesOpen, setClearRulesOpen] = useState(false);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<RuleFilter>('all');

  const selectedMock = selected?.kind === 'mock'
    ? mockRules.find((r) => r.id === selected.id)
    : undefined;
  const selectedIntercept = selected?.kind === 'intercept'
    ? interceptRules.find((r) => r.id === selected.id)
    : undefined;
  const selectedMapRemote = selected?.kind === 'mapRemote'
    ? mapRemoteRules.find((r) => r.id === selected.id)
    : undefined;

  const pendingDelete = ruleToDelete?.kind === 'mock'
    ? mockRules.find((r) => r.id === ruleToDelete.id)
    : ruleToDelete?.kind === 'intercept'
      ? interceptRules.find((r) => r.id === ruleToDelete.id)
      : ruleToDelete?.kind === 'mapRemote'
        ? mapRemoteRules.find((r) => r.id === ruleToDelete.id)
        : undefined;

  const listEntries = useMemo(() => {
    const mockEntries: ListEntry[] = mockRules.map((rule) => ({
      kind: 'mock',
      rule,
      action: 'mock',
    }));
    const interceptEntries: ListEntry[] = interceptRules.map((rule) => ({
      kind: 'intercept',
      rule,
      action: ruleActionFromIntercept(rule),
    }));
    const mapRemoteEntries: ListEntry[] = mapRemoteRules.map((rule) => ({
      kind: 'mapRemote',
      rule,
      action: 'map-remote',
    }));
    const merged = [...mockEntries, ...interceptEntries, ...mapRemoteEntries];
    if (filter === 'all') return merged;
    return merged.filter((entry) => entry.action === filter);
  }, [mockRules, interceptRules, mapRemoteRules, filter]);

  const filterCounts = useMemo(() => {
    const rewrite = interceptRules.filter((r) => r.mode !== 'breakpoint').length;
    const breakpoint = interceptRules.filter((r) => r.mode === 'breakpoint').length;
    return {
      mock: mockRules.length,
      rewrite,
      breakpoint,
      'map-remote': mapRemoteRules.length,
    } satisfies Record<RuleAction, number>;
  }, [mockRules, interceptRules, mapRemoteRules]);

  const selectedAction: RuleAction | null = selectedMock
    ? 'mock'
    : selectedMapRemote
      ? 'map-remote'
      : selectedIntercept
        ? ruleActionFromIntercept(selectedIntercept)
        : null;

  useEffect(() => {
    void Promise.all([
      window.yanshuf.rules.get(),
      window.yanshuf.intercept.getRules(),
      window.yanshuf.mapRemote.get(),
    ]).then(([mocks, intercepts, mapRemotes]) => {
      setMockRules(mocks);
      setInterceptRules(intercepts);
      setMapRemoteRules(mapRemotes);
      if (!selected) {
        if (mocks[0]) setSelected({ kind: 'mock', id: mocks[0].id });
        else if (intercepts[0]) setSelected({ kind: 'intercept', id: intercepts[0].id });
        else if (mapRemotes[0]) setSelected({ kind: 'mapRemote', id: mapRemotes[0].id });
      }
    });
  }, []);

  useEffect(() => {
    if (!loadFromEntryId) return;
    void (async () => {
      const entry = await window.yanshuf.capture.get(loadFromEntryId);
      if (!entry) {
        onLoadHandled?.();
        return;
      }
      if (loadFromEntryKind === 'mapRemote') {
        const existing = await window.yanshuf.mapRemote.get();
        const rule = captureToMapRemoteRule(entry, existing.length);
        const next = [...existing, rule];
        setMapRemoteRules(next);
        setSelected({ kind: 'mapRemote', id: rule.id });
        await window.yanshuf.mapRemote.save(next);
      } else {
        const existing = await window.yanshuf.rules.get();
        const rule = captureToAutoResponderRule(entry, existing.length);
        const next = [...existing, rule];
        setMockRules(next);
        setSelected({ kind: 'mock', id: rule.id });
        await window.yanshuf.rules.save(next);
      }
      onLoadHandled?.();
    })();
  }, [loadFromEntryId, loadFromEntryKind, onLoadHandled]);

  useEffect(() => {
    if (selectedMock) {
      setHeadersDraft(JSON.stringify(selectedMock.response.headers, null, 2));
      return;
    }
    if (selectedIntercept) {
      setRequestHeadersDraft(JSON.stringify(selectedIntercept.request?.headers ?? {}, null, 2));
      setResponseHeadersDraft(JSON.stringify(selectedIntercept.response?.headers ?? {}, null, 2));
    }
  }, [
    selectedMock?.id,
    selectedMock?.response.headers,
    selectedIntercept?.id,
    selectedIntercept?.request?.headers,
    selectedIntercept?.response?.headers,
  ]);

  const saveMockRules = async (next: AutoResponderRule[]) => {
    setMockRules(next);
    await window.yanshuf.rules.save(next);
  };

  const saveInterceptRules = async (next: InterceptRule[]) => {
    setInterceptRules(next);
    await window.yanshuf.intercept.saveRules(next);
  };

  const saveMapRemoteRules = async (next: MapRemoteRule[]) => {
    setMapRemoteRules(next);
    await window.yanshuf.mapRemote.save(next);
  };

  const updateSelectedMock = (patch: Partial<AutoResponderRule>) => {
    if (!selectedMock) return;
    const next = mockRules.map((r) => (r.id === selectedMock.id ? { ...r, ...patch } : r));
    void saveMockRules(next);
  };

  const updateSelectedIntercept = (patch: Partial<InterceptRule>) => {
    if (!selectedIntercept) return;
    const next = interceptRules.map((r) => (r.id === selectedIntercept.id ? { ...r, ...patch } : r));
    void saveInterceptRules(next);
  };

  const updateSelectedMapRemote = (patch: Partial<MapRemoteRule>) => {
    if (!selectedMapRemote) return;
    const next = mapRemoteRules.map((r) => (r.id === selectedMapRemote.id ? { ...r, ...patch } : r));
    void saveMapRemoteRules(next);
  };

  const selectFirstAvailable = (): SelectedRuleRef | null => {
    if (mockRules[0]) return { kind: 'mock', id: mockRules[0].id };
    if (interceptRules[0]) return { kind: 'intercept', id: interceptRules[0].id };
    if (mapRemoteRules[0]) return { kind: 'mapRemote', id: mapRemoteRules[0].id };
    return null;
  };

  const deleteRule = (ref: SelectedRuleRef) => {
    if (ref.kind === 'mock') {
      const removed = mockRules.find((r) => r.id === ref.id);
      const next = mockRules.filter((r) => r.id !== ref.id);
      void saveMockRules(next);
      if (removed) notifyDeleted(removed.name);
      if (selected?.kind === 'mock' && selected.id === ref.id) {
        setSelected(next[0] ? { kind: 'mock', id: next[0].id } : selectFirstAvailable());
      }
      return;
    }

    if (ref.kind === 'mapRemote') {
      const removed = mapRemoteRules.find((r) => r.id === ref.id);
      const next = mapRemoteRules.filter((r) => r.id !== ref.id);
      void saveMapRemoteRules(next);
      if (removed) notifyDeleted(removed.name);
      if (selected?.kind === 'mapRemote' && selected.id === ref.id) {
        setSelected(next[0] ? { kind: 'mapRemote', id: next[0].id } : selectFirstAvailable());
      }
      return;
    }

    const removed = interceptRules.find((r) => r.id === ref.id);
    const next = interceptRules.filter((r) => r.id !== ref.id);
    void saveInterceptRules(next);
    if (removed) notifyDeleted(removed.name);
    if (selected?.kind === 'intercept' && selected.id === ref.id) {
      setSelected(selectFirstAvailable());
    }
  };

  const clearAllRules = () => {
    void Promise.all([
      saveMockRules([]),
      saveInterceptRules([]),
      saveMapRemoteRules([]),
    ]);
    setSelected(null);
    notifyRemoved('All rules');
  };

  const addRule = (action: RuleAction) => {
    if (action === 'mock') {
      const rule = emptyMockRule(mockRules.length);
      void saveMockRules([...mockRules, rule]);
      setSelected({ kind: 'mock', id: rule.id });
      if (filter !== 'all' && filter !== 'mock') setFilter('mock');
      return;
    }

    if (action === 'map-remote') {
      const rule = emptyMapRemoteRule(mapRemoteRules.length);
      void saveMapRemoteRules([...mapRemoteRules, rule]);
      setSelected({ kind: 'mapRemote', id: rule.id });
      if (filter !== 'all' && filter !== 'map-remote') setFilter('map-remote');
      return;
    }

    const mode = action === 'breakpoint' ? 'breakpoint' : 'rewrite';
    const rule = emptyInterceptRule(interceptRules.length, mode);
    void saveInterceptRules([...interceptRules, rule]);
    setSelected({ kind: 'intercept', id: rule.id });
    if (filter !== 'all' && filter !== action) setFilter(action);
  };

  const loadFromCapture = async (entryId: string, kind: 'mock' | 'mapRemote' = 'mock') => {
    const entry = await window.yanshuf.capture.get(entryId);
    if (!entry) return;
    if (kind === 'mapRemote') {
      const rule = captureToMapRemoteRule(entry, mapRemoteRules.length);
      const next = [...mapRemoteRules, rule];
      await saveMapRemoteRules(next);
      setSelected({ kind: 'mapRemote', id: rule.id });
      return;
    }
    const rule = captureToAutoResponderRule(entry, mockRules.length);
    const next = [...mockRules, rule];
    await saveMockRules(next);
    setSelected({ kind: 'mock', id: rule.id });
  };

  const handleInterceptModeChange = (action: RuleAction) => {
    if (!selectedIntercept || action === 'mock') return;
    const mode = action === 'breakpoint' ? 'breakpoint' : 'rewrite';
    if (selectedIntercept.mode === mode) return;
    updateSelectedIntercept({ mode });
  };

  const entryKey = (entry: ListEntry) => `${entry.kind}:${entry.rule.id}`;

  const totalCount = mockRules.length + interceptRules.length + mapRemoteRules.length;

  return (
    <DropCaptureZone
      className="h-full min-h-0"
      hint="Drop capture to create mock rule"
      onDropCapture={(id) => void loadFromCapture(id, 'mock')}
    >
      <WorkspaceShell
        title="Traffic rules"
        description="Mock responses or intercept live traffic — first match wins."
        headerActions={(
          <>
            {totalCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setClearRulesOpen(true)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Clear rules
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add rule
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => addRule('mock')}>
                  <Zap className="mr-2 h-4 w-4 text-amber-600" />
                  Mock response
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addRule('rewrite')}>
                  <PenLine className="mr-2 h-4 w-4 text-sky-600" />
                  Rewrite traffic
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addRule('breakpoint')}>
                  <PauseCircle className="mr-2 h-4 w-4 text-orange-600" />
                  Breakpoint
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addRule('map-remote')}>
                  <ArrowRightLeft className="mr-2 h-4 w-4 text-emerald-600" />
                  Map Remote
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        empty={totalCount === 0}
        emptyContent={(
          <WorkspaceEmptyCards
            heading="Shape your traffic"
            description="Rules match requests by URL regex. Choose how matching traffic should behave."
            footer="Drag a captured request from the session list to pre-fill a mock rule from a real exchange."
            cards={[
              {
                key: 'mock',
                icon: <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
                title: ruleActionLabel('mock'),
                description: ruleActionDescription('mock'),
                accent: 'text-amber-600 dark:text-amber-400',
                border: 'hover:border-amber-500/40 hover:bg-amber-500/[0.04]',
                onClick: () => addRule('mock'),
              },
              {
                key: 'rewrite',
                icon: <PenLine className="h-5 w-5 text-sky-600 dark:text-sky-400" />,
                title: ruleActionLabel('rewrite'),
                description: ruleActionDescription('rewrite'),
                accent: 'text-sky-600 dark:text-sky-400',
                border: 'hover:border-sky-500/40 hover:bg-sky-500/[0.04]',
                onClick: () => addRule('rewrite'),
              },
              {
                key: 'breakpoint',
                icon: <PauseCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />,
                title: ruleActionLabel('breakpoint'),
                description: ruleActionDescription('breakpoint'),
                accent: 'text-orange-600 dark:text-orange-400',
                border: 'hover:border-orange-500/40 hover:bg-orange-500/[0.04]',
                onClick: () => addRule('breakpoint'),
              },
              {
                key: 'map-remote',
                icon: <ArrowRightLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
                title: ruleActionLabel('map-remote'),
                description: ruleActionDescription('map-remote'),
                accent: 'text-emerald-600 dark:text-emerald-400',
                border: 'hover:border-emerald-500/40 hover:bg-emerald-500/[0.04]',
                onClick: () => addRule('map-remote'),
              },
            ]}
          />
        )}
        sidebarHeader={(
          <div className="border-b px-2 py-2">
            <RuleFilterBar
              value={filter}
              onChange={setFilter}
              counts={filterCounts}
              total={totalCount}
            />
          </div>
        )}
        sidebar={(
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
              {listEntries.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    {totalCount === 0
                      ? 'No rules yet.'
                      : `No ${ruleFilterLabel(filter)} rules.`}
                  </p>
                  {totalCount > 0 && filter !== 'all' ? (
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-primary hover:underline"
                      onClick={() => setFilter('all')}
                    >
                      Show all {totalCount} rules
                    </button>
                  ) : null}
                </div>
              ) : (
                listEntries.map((entry) => (
                  <RuleListItem
                    key={entryKey(entry)}
                    entry={entry}
                    selected={selected?.kind === entry.kind && selected.id === entry.rule.id}
                    dragOver={dragOverKey === entryKey(entry)}
                    onSelect={() => setSelected({ kind: entry.kind, id: entry.rule.id })}
                    onToggleEnabled={(enabled) => {
                      if (entry.kind === 'mock') {
                        void saveMockRules(mockRules.map((r) => (r.id === entry.rule.id ? { ...r, enabled } : r)));
                      } else if (entry.kind === 'mapRemote') {
                        void saveMapRemoteRules(mapRemoteRules.map((r) => (r.id === entry.rule.id ? { ...r, enabled } : r)));
                      } else {
                        void saveInterceptRules(interceptRules.map((r) => (r.id === entry.rule.id ? { ...r, enabled } : r)));
                      }
                    }}
                    onDeleteRequest={() => setRuleToDelete({ kind: entry.kind, id: entry.rule.id })}
                    onReorder={(fromId, toId) => {
                      if (entry.kind === 'mock') {
                        void saveMockRules(reorderMockRules(mockRules, fromId, toId));
                      } else if (entry.kind === 'mapRemote') {
                        void saveMapRemoteRules(reorderMapRemoteRules(mapRemoteRules, fromId, toId));
                      } else {
                        void saveInterceptRules(reorderInterceptRules(interceptRules, fromId, toId));
                      }
                    }}
                    onDragOverChange={(key) => setDragOverKey(key)}
                    entryKey={entryKey(entry)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        )}
      >
        {selectedMock || selectedIntercept || selectedMapRemote ? (
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              {selectedAction && (
                <div className="mb-4 rounded-xl border bg-muted/20 p-3 shadow-sm">
                  {selectedMock ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Mock response</p>
                        <p className="text-xs text-muted-foreground">
                          {ruleActionDescription('mock')}
                        </p>
                      </div>
                    </div>
                  ) : selectedMapRemote ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <ArrowRightLeft className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Map Remote</p>
                        <p className="text-xs text-muted-foreground">
                          {ruleActionDescription('map-remote')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <RuleActionPicker
                      value={selectedAction}
                      options={['rewrite', 'breakpoint']}
                      onChange={(action) => handleInterceptModeChange(action)}
                    />
                  )}
                </div>
              )}
              {selectedMock ? (
                <MockRuleEditor
                  selected={selectedMock}
                  headersDraft={headersDraft}
                  onHeadersDraftChange={setHeadersDraft}
                  onUpdate={updateSelectedMock}
                />
              ) : selectedMapRemote ? (
                <MapRemoteRuleEditor
                  selected={selectedMapRemote}
                  onUpdate={updateSelectedMapRemote}
                />
              ) : selectedIntercept ? (
                <InterceptRuleEditor
                  selected={selectedIntercept}
                  requestHeadersDraft={requestHeadersDraft}
                  responseHeadersDraft={responseHeadersDraft}
                  onRequestHeadersDraftChange={setRequestHeadersDraft}
                  onResponseHeadersDraftChange={setResponseHeadersDraft}
                  onUpdate={updateSelectedIntercept}
                />
              ) : null}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <p className="text-sm text-muted-foreground">Select a rule to edit</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Or add a new rule from the toolbar above.
            </p>
          </div>
        )}
      </WorkspaceShell>

      <Dialog open={ruleToDelete !== null} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete rule?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{pendingDelete?.name ?? 'this rule'}&quot;. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRuleToDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (ruleToDelete) deleteRule(ruleToDelete);
                setRuleToDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clearRulesOpen} onOpenChange={setClearRulesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all rules?</DialogTitle>
            <DialogDescription>
              This will remove all {totalCount} saved rule{totalCount === 1 ? '' : 's'} — mock, rewrite,
              breakpoint, and map remote. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setClearRulesOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearAllRules();
                setClearRulesOpen(false);
              }}
            >
              Clear rules
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DropCaptureZone>
  );
}

function RuleListItem({
  entry,
  selected,
  dragOver,
  onSelect,
  onToggleEnabled,
  onDeleteRequest,
  onReorder,
  onDragOverChange,
  entryKey,
}: {
  entry: ListEntry;
  selected: boolean;
  dragOver: boolean;
  onSelect: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onDeleteRequest: () => void;
  onReorder: (fromId: string, toId: string) => void;
  onDragOverChange: (key: string | null) => void;
  entryKey: string;
}) {
  const { rule, action } = entry;
  const reorderMime = `${RULE_REORDER_MIME}:${entry.kind}`;
  const rowRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      ref={rowRef}
      className={cn(
        'group mb-1 flex w-full items-center gap-1 rounded-md border border-transparent border-l-[3px] py-2 pl-1 pr-1 transition-colors hover:bg-accent/50',
        ruleActionAccentClass(action),
        selected && 'border-border bg-accent shadow-sm',
        dragOver && 'border-t-2 border-t-primary bg-accent/30',
        !rule.enabled && 'opacity-50',
        dragging && 'opacity-40',
      )}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(reorderMime)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        onDragOverChange(entryKey);
      }}
      onDragLeave={() => onDragOverChange(null)}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes(reorderMime)) return;
        e.preventDefault();
        e.stopPropagation();
        const fromId = e.dataTransfer.getData(reorderMime);
        onDragOverChange(null);
        if (fromId && fromId !== rule.id) onReorder(fromId, rule.id);
      }}
    >
      <button
        type="button"
        draggable
        className="cursor-grab touch-none px-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${rule.name}`}
        onDragStart={(e) => {
          e.dataTransfer.setData(reorderMime, rule.id);
          e.dataTransfer.effectAllowed = 'move';
          if (rowRef.current) {
            setListItemDragImage(e.nativeEvent, rowRef.current);
          }
          setDragging(true);
        }}
        onDragEnd={() => {
          setDragging(false);
          removeListItemDragImage();
          onDragOverChange(null);
        }}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        checked={rule.enabled}
        aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`}
        onChange={(e) => onToggleEnabled(e.target.checked)}
      />
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col items-start text-left text-sm hover:bg-transparent"
      >
        <span className="truncate font-medium">{rule.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              'h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide',
              action === 'mock' && 'border-amber-500/30 text-amber-700 dark:text-amber-400',
              action === 'rewrite' && 'border-sky-500/30 text-sky-700 dark:text-sky-400',
              action === 'breakpoint' && 'border-orange-500/30 text-orange-700 dark:text-orange-400',
              action === 'map-remote' && 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
            )}
          >
            {ruleActionLabel(action)}
          </Badge>
          {entry.kind === 'intercept' && (
            <span className="truncate text-[10px] text-muted-foreground">
              {entry.rule.phase}
            </span>
          )}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label={`Actions for ${rule.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onDeleteRequest}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
