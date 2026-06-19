import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ComposerEnvironment } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

interface EnvironmentManagerDialogProps {
  open: boolean;
  environments: ComposerEnvironment[];
  activeEnvironmentId: string;
  onOpenChange: (open: boolean) => void;
  onSave: (envs: ComposerEnvironment[], activeEnvironmentId: string) => void;
}

interface VariableRow {
  id: string;
  key: string;
  value: string;
}

function variablesToRows(variables: Record<string, string>): VariableRow[] {
  return Object.entries(variables).map(([key, value]) => ({
    id: uuidv4(),
    key,
    value,
  }));
}

function rowsToVariables(rows: VariableRow[]): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) variables[key] = row.value;
  }
  return variables;
}

export function EnvironmentManagerDialog({
  open,
  environments,
  activeEnvironmentId,
  onOpenChange,
  onSave,
}: EnvironmentManagerDialogProps) {
  const [draftEnvs, setDraftEnvs] = useState<ComposerEnvironment[]>(environments);
  const [selectedId, setSelectedId] = useState(activeEnvironmentId);
  const [variableRows, setVariableRows] = useState<VariableRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setDraftEnvs(environments);
    setSelectedId(activeEnvironmentId);
  }, [open, environments, activeEnvironmentId]);

  const selected = draftEnvs.find((env) => env.id === selectedId) ?? draftEnvs[0];

  useEffect(() => {
    if (!selected || !open) return;
    setVariableRows(variablesToRows(selected.variables));
  }, [selected?.id, open]);

  const syncSelectedVariables = (envs: ComposerEnvironment[]) =>
    selected
      ? envs.map((env) => (env.id === selected.id ? { ...env, variables: rowsToVariables(variableRows) } : env))
      : envs;

  const selectEnvironment = (id: string) => {
    const synced = syncSelectedVariables(draftEnvs);
    const next = synced.find((env) => env.id === id);
    setDraftEnvs(synced);
    setSelectedId(id);
    if (next) setVariableRows(variablesToRows(next.variables));
  };

  const updateSelected = (patch: Partial<ComposerEnvironment>) => {
    if (!selected) return;
    setDraftEnvs(draftEnvs.map((env) => (env.id === selected.id ? { ...env, ...patch } : env)));
  };

  const addEnvironment = () => {
    const synced = syncSelectedVariables(draftEnvs);
    const env: ComposerEnvironment = {
      id: uuidv4(),
      name: `Environment ${synced.length + 1}`,
      variables: {},
    };
    setDraftEnvs([...synced, env]);
    setSelectedId(env.id);
    setVariableRows([]);
  };

  const deleteEnvironment = (id: string) => {
    const synced = syncSelectedVariables(draftEnvs);
    if (synced.length <= 1) return;
    const next = synced.filter((env) => env.id !== id);
    setDraftEnvs(next);
    if (selectedId === id) {
      const fallback = next[0];
      setSelectedId(fallback?.id ?? '');
      setVariableRows(fallback ? variablesToRows(fallback.variables) : []);
    }
  };

  const save = () => {
    const nextEnvs = syncSelectedVariables(draftEnvs);
    const nextActiveId = nextEnvs.find((env) => env.id === selectedId)?.id ?? nextEnvs[0]?.id ?? 'default';
    onSave(nextEnvs, nextActiveId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(640px,85vh)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b px-6 py-4 pr-12">
          <DialogTitle>Manage Environments</DialogTitle>
          <DialogDescription>
            Switch contexts without rewriting requests. Variables substitute as{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{'{{variable}}'}</code>
            {' '}in URLs, headers, and bodies.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-[196px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r bg-muted/20">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Environments
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{draftEnvs.length}</span>
            </div>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
              {draftEnvs.map((env) => {
                const isSelected = selected?.id === env.id;
                const varCount = Object.keys(env.variables).length;
                return (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => selectEnvironment(env.id)}
                    className={cn(
                      'flex w-full flex-col rounded-md border px-2.5 py-2 text-left transition-colors',
                      isSelected
                        ? 'border-border bg-accent shadow-sm'
                        : 'border-transparent hover:border-border/60 hover:bg-accent/40',
                    )}
                  >
                    <span className="truncate text-sm font-medium">{env.name}</span>
                    <span className="mt-0.5 text-[11px] text-muted-foreground">
                      {varCount === 0 ? 'No variables' : `${varCount} variable${varCount === 1 ? '' : 's'}`}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t p-2">
              <Button size="sm" variant="outline" className="w-full" onClick={addEnvironment}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                New environment
              </Button>
            </div>
          </aside>

          {selected ? (
            <div className="flex min-h-0 flex-col overflow-hidden">
              <div className="border-b px-5 py-4">
                <div className="flex items-end gap-2">
                  <FloatingLabelInput
                    wrapperClassName="min-w-0 flex-1"
                    label="Environment name"
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="mb-0.5 shrink-0 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    disabled={draftEnvs.length <= 1}
                    title={draftEnvs.length <= 1 ? 'At least one environment is required' : `Delete ${selected.name}`}
                    aria-label={`Delete ${selected.name}`}
                    onClick={() => deleteEnvironment(selected.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium">Variables</h4>
                    <p className="text-xs text-muted-foreground">
                      Keys become placeholders in your request templates.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVariableRows([...variableRows, { id: uuidv4(), key: '', value: '' }])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add variable
                  </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background/40">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_40px] border-b bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Variable</span>
                    <span>Value</span>
                    <span className="sr-only">Remove</span>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    {variableRows.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                        <p className="text-sm text-muted-foreground">No variables in this environment yet.</p>
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground/80">
                          Example:{' '}
                          <code className="font-mono">baseUrl</code>
                          {' → '}
                          <code className="font-mono">https://api.example.com</code>
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => setVariableRows([{ id: uuidv4(), key: 'baseUrl', value: '' }])}
                        >
                          Add first variable
                        </Button>
                      </div>
                    ) : (
                      variableRows.map((row, index) => (
                        <div
                          key={row.id}
                          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_40px] items-center gap-2 border-b px-2 py-1.5 last:border-b-0"
                        >
                          <Input
                            className="h-8 font-mono text-xs"
                            placeholder="baseUrl"
                            value={row.key}
                            onChange={(e) => {
                              const next = [...variableRows];
                              next[index] = { ...row, key: e.target.value };
                              setVariableRows(next);
                            }}
                          />
                          <Input
                            className="h-8 font-mono text-xs"
                            placeholder="https://api.example.com"
                            value={row.value}
                            onChange={(e) => {
                              const next = [...variableRows];
                              next[index] = { ...row, value: e.target.value };
                              setVariableRows(next);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            aria-label="Remove variable"
                            onClick={() => setVariableRows(variableRows.filter((item) => item.id !== row.id))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t bg-muted/10 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save environments</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
