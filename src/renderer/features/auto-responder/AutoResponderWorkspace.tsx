import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { HTTP_METHODS } from '../../../shared/http';
import type { AutoResponderRule } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FloatingLabelInput,
  FloatingLabelSelect,
  FloatingLabelTextarea,
} from '@/components/ui/floating-label-input';
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
import { MoreVertical, Plus, Zap, FolderOpen } from 'lucide-react';
import { CopyUrlButton } from '@/components/CopyUrlButton';
import { DropCaptureZone } from '@/components/DropCaptureZone';
import { captureToAutoResponderRule } from './captureToRule';

interface AutoResponderWorkspaceProps {
  loadFromEntryId?: string | null;
  onLoadHandled?: () => void;
}

function emptyRule(order: number): AutoResponderRule {
  return {
    id: uuidv4(),
    name: 'New Rule',
    enabled: true,
    order,
    match: { urlRegex: '.*', method: 'GET' },
    response: {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { type: 'inline', content: '{"mock": true}' },
      delayMs: 0,
    },
  };
}

function ruleListLabel(rule: AutoResponderRule): string {
  const method = rule.match.method?.toUpperCase();
  if (method && rule.name.toUpperCase().startsWith(`${method} `)) {
    return rule.name.slice(method.length + 1);
  }
  return rule.name;
}

export function AutoResponderWorkspace({ loadFromEntryId, onLoadHandled }: AutoResponderWorkspaceProps) {
  const [rules, setRules] = useState<AutoResponderRule[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [headersDraft, setHeadersDraft] = useState('{}');
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  const selected = rules.find((r) => r.id === selectedId) ?? rules[0];
  const pendingDeleteRule = rules.find((r) => r.id === ruleToDelete);

  useEffect(() => {
    void window.yanshuf.rules.get().then(setRules);
  }, []);

  useEffect(() => {
    if (!loadFromEntryId) return;
    void (async () => {
      const entry = await window.yanshuf.capture.get(loadFromEntryId);
      if (!entry) {
        onLoadHandled?.();
        return;
      }
      const existing = await window.yanshuf.rules.get();
      const rule = captureToAutoResponderRule(entry, existing.length);
      const next = [...existing, rule];
      setRules(next);
      setSelectedId(rule.id);
      await window.yanshuf.rules.save(next);
      onLoadHandled?.();
    })();
  }, [loadFromEntryId, onLoadHandled]);

  useEffect(() => {
    if (!selected) return;
    setHeadersDraft(JSON.stringify(selected.response.headers, null, 2));
  }, [selected?.id, selected?.response.headers]);

  const save = async (next: AutoResponderRule[]) => {
    setRules(next);
    await window.yanshuf.rules.save(next);
  };

  const updateSelected = (patch: Partial<AutoResponderRule>) => {
    if (!selected) return;
    const next = rules.map((r) => (r.id === selected.id ? { ...r, ...patch } : r));
    void save(next);
  };

  const deleteRule = (id: string) => {
    const next = rules.filter((r) => r.id !== id);
    void save(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null);
    }
  };

  const confirmDeleteRule = () => {
    if (!ruleToDelete) return;
    deleteRule(ruleToDelete);
    setRuleToDelete(null);
  };

  const moveRule = (id: string, direction: -1 | 1) => {
    const idx = rules.findIndex((r) => r.id === id);
    const target = idx + direction;
    if (target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[idx], next[target]] = [next[target], next[idx]];
    next.forEach((r, i) => { r.order = i; });
    void save(next);
  };

  const addRule = () => {
    const rule = emptyRule(rules.length);
    void save([...rules, rule]);
    setSelectedId(rule.id);
  };

  const loadFromCapture = async (entryId: string) => {
    const entry = await window.yanshuf.capture.get(entryId);
    if (!entry) return;
    const rule = captureToAutoResponderRule(entry, rules.length);
    const next = [...rules, rule];
    await save(next);
    setSelectedId(rule.id);
  };

  return (
    <DropCaptureZone
      className="h-full"
      hint="Drop capture to create rule"
      onDropCapture={(id) => void loadFromCapture(id)}
    >
      <div className="flex h-full flex-col">
        <div className="border-b px-3 py-2 text-sm font-medium">Auto Responder</div>
        {rules.length === 0 ? (
          <RulesEmptyState onAddRule={addRule} />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[224px_1fr] gap-4 p-3">
            <div className="flex min-h-0 flex-col gap-2">
              <Button size="sm" onClick={addRule}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Rule
              </Button>
              <ScrollArea className="min-h-0 flex-1 rounded-md border">
                <div className="pr-1">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`group flex w-full items-center gap-1.5 border-b py-2 pl-2 pr-1 hover:bg-accent/50 ${selected?.id === rule.id ? 'bg-accent' : ''}`}
                  >
                    <Checkbox
                      checked={rule.enabled}
                      aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`}
                      onChange={(e) => {
                        void save(rules.map((r) => (r.id === rule.id ? { ...r, enabled: e.target.checked } : r)));
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedId(rule.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm hover:bg-transparent"
                    >
                      <Badge
                        variant="outline"
                        className="shrink-0 px-1 py-0 font-mono text-[10px] leading-4"
                      >
                        {rule.match.method?.toUpperCase() || 'ANY'}
                      </Badge>
                      <span className="truncate">{ruleListLabel(rule)}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-accent/80 hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                          aria-label={`Actions for ${rule.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setRuleToDelete(rule.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                </div>
              </ScrollArea>
            </div>
            {selected ? (
              <ScrollArea className="min-h-0">
                <RuleEditor
                  selected={selected}
                  headersDraft={headersDraft}
                  onHeadersDraftChange={setHeadersDraft}
                  onUpdate={updateSelected}
                  onMove={(direction) => moveRule(selected.id, direction)}
                  onDelete={() => setRuleToDelete(selected.id)}
                />
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                Select a rule to edit
              </div>
            )}
          </div>
        )}
      </div>
      <Dialog open={ruleToDelete !== null} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete rule?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{pendingDeleteRule?.name ?? 'this rule'}&quot;. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRuleToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteRule}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DropCaptureZone>
  );
}

function RulesEmptyState({ onAddRule }: { onAddRule: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Zap className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium">No rules yet</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Auto Responder intercepts matching requests and returns a synthetic response — useful for
        mocking APIs without changing your app.
      </p>
      <p className="mt-4 max-w-md text-xs text-muted-foreground">
        Drag a captured request from the session list here to pre-fill a rule from a real exchange.
      </p>
      <Button className="mt-6" onClick={onAddRule}>
        <Plus className="mr-1 h-4 w-4" />
        Create Rule
      </Button>
    </div>
  );
}

function RuleEditor({
  selected,
  headersDraft,
  onHeadersDraftChange,
  onUpdate,
  onMove,
  onDelete,
}: {
  selected: AutoResponderRule;
  headersDraft: string;
  onHeadersDraftChange: (value: string) => void;
  onUpdate: (patch: Partial<AutoResponderRule>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3 pt-2.5 pr-3">
      <FloatingLabelInput
        label="Rule name"
        value={selected.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
      />
      <div className="flex w-full items-center gap-1">
        <div className="min-w-0 flex-1">
          <FloatingLabelInput
            className="font-mono"
            label="URL regex"
            value={selected.match.urlRegex ?? ''}
            onChange={(e) => onUpdate({ match: { ...selected.match, urlRegex: e.target.value } })}
          />
        </div>
        <CopyUrlButton
          value={selected.match.urlRegex ?? ''}
          fromRegex
          title="Copy match URL"
        />
      </div>
      <FloatingLabelSelect
        label="Method"
        value={selected.match.method ?? ''}
        onChange={(e) => onUpdate({
          match: { ...selected.match, method: e.target.value || undefined },
        })}
      >
        <option value="">Any</option>
        {HTTP_METHODS.map((method) => (
          <option key={method} value={method}>{method}</option>
        ))}
      </FloatingLabelSelect>
      <div className="grid grid-cols-2 gap-2">
        <FloatingLabelInput
          type="number"
          label="Status"
          value={selected.response.status}
          onChange={(e) => onUpdate({ response: { ...selected.response, status: Number(e.target.value) } })}
        />
        <FloatingLabelInput
          type="number"
          label="Delay ms"
          value={selected.response.delayMs ?? 0}
          onChange={(e) => onUpdate({ response: { ...selected.response, delayMs: Number(e.target.value) } })}
        />
      </div>
      <FloatingLabelTextarea
        className="min-h-[80px] font-mono text-xs"
        label="Response headers (JSON object)"
        value={headersDraft}
        onChange={(e) => {
          onHeadersDraftChange(e.target.value);
          try {
            const headers = JSON.parse(e.target.value) as Record<string, string>;
            onUpdate({ response: { ...selected.response, headers } });
          } catch {
            // Allow invalid JSON while editing.
          }
        }}
      />
      <FloatingLabelTextarea
        className="font-mono text-xs"
        label="Response body (inline JSON)"
        value={selected.response.body?.type === 'inline' ? selected.response.body.content : ''}
        onChange={(e) => onUpdate({
          response: {
            ...selected.response,
            body: { type: 'inline', content: e.target.value },
          },
        })}
      />
      <div className="flex gap-2">
        <FloatingLabelInput
          readOnly
          className="min-w-0 flex-1 font-mono text-xs"
          label="Response file"
          value={selected.response.body?.type === 'file' ? selected.response.body.path : ''}
        />
        <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => {
              void window.yanshuf.dialog.pickFile({ title: 'Select response file' }).then((filePath) => {
                if (!filePath) return;
                onUpdate({
                  response: {
                    ...selected.response,
                    body: { type: 'file', path: filePath },
                  },
                });
              });
            }}
          >
            <FolderOpen className="mr-1 h-3.5 w-3.5" />
            Browse
          </Button>
        {selected.response.body?.type === 'file' && (
          <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => onUpdate({
                response: {
                  ...selected.response,
                  body: { type: 'inline', content: '' },
                },
              })}
            >
              Clear
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onMove(-1)}>Move Up</Button>
        <Button variant="outline" size="sm" onClick={() => onMove(1)}>Move Down</Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}
