import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CaptureEntry, CaptureEntrySummary, CertStatus, IntegrationAggregateStatus, ProxyStatus, ShortcutKey } from '@yanshuf/shared';
import { SHORTCUTS, filterCaptures, hostWithoutPort, toggleQueryTerm } from '@yanshuf/shared';
import { Button, Switch } from '@yanshuf/ui';
import { cn } from '@yanshuf/ui/lib/utils';
import { FilterBar } from './FilterBar';
import { SessionList } from './SessionList';
import { RequestPane, ResponsePane } from './MessagePane';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Shield, Bot, Filter } from 'lucide-react';
import { CopyUrlButton } from '@/components/CopyUrlButton';
import { ShortcutHint, ShortcutLegend } from '@/components/shortcut-hints';
import type { DetailMode } from './detailMode';
import { ComposerWorkspace } from '@/features/composer/ComposerWorkspace';
import { AutoResponderWorkspace } from '@/features/auto-responder/AutoResponderWorkspace';
import { BreakpointPanel } from '@/features/intercept/BreakpointPanel';
import { useBreakpointNavigation } from '@/features/intercept/useBreakpointNavigation';
import { withCertGate } from '@/lib/cert-gate';
import { clearCapturedRequests, notifyActionFailed, notifyApplied } from '@/lib/toast-actions';

const FILTER_QUERY_KEY = 'yanshuf.capture-filter-query';

function readStoredQuery(): string {
  return localStorage.getItem(FILTER_QUERY_KEY) ?? '';
}

interface CaptureViewProps {
  /** Bumped by the cmd+F shortcut to focus the filter input. */
  focusFilterNonce?: number;
  detailMode: DetailMode;
  composerLoadEntryId?: string | null;
  onComposerLoadHandled?: () => void;
  rulesLoadEntryId?: string | null;
  rulesLoadEntryKind?: 'mock' | 'mapRemote';
  onRulesLoadHandled?: () => void;
  onAddToComposer?: (entryId: string) => void;
  onCreateRule?: (entryId: string) => void;
  onCreateMapRemoteRule?: (entryId: string) => void;
  onCaptureEntrySelect?: () => void;
  certStatus?: CertStatus | null;
  onOpenCertificateSettings?: () => void;
  integrationStatus?: IntegrationAggregateStatus;
  onOpenAiSettings?: () => void;
  onOpenFilterSettings?: () => void;
  proxyStatusNonce?: number;
}

export function CaptureView({
  focusFilterNonce = 0,
  detailMode,
  composerLoadEntryId,
  onComposerLoadHandled,
  rulesLoadEntryId,
  rulesLoadEntryKind,
  onRulesLoadHandled,
  onAddToComposer,
  onCreateRule,
  onCreateMapRemoteRule,
  onCaptureEntrySelect,
  certStatus,
  onOpenCertificateSettings,
  integrationStatus = 'not_installed',
  onOpenAiSettings,
  onOpenFilterSettings,
  proxyStatusNonce = 0,
}: CaptureViewProps) {
  const [entries, setEntries] = useState<CaptureEntrySummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<CaptureEntry | null>(null);
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [query, setQuery] = useState(() => readStoredQuery());
  const filterInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => filterCaptures(entries, query), [entries, query]);

  useEffect(() => {
    localStorage.setItem(FILTER_QUERY_KEY, query);
  }, [query]);

  useEffect(() => {
    if (!focusFilterNonce) return;
    filterInputRef.current?.focus();
    filterInputRef.current?.select();
  }, [focusFilterNonce]);

  // A pre-overhaul capture filter arrives once as a view query. Seed it so the user's
  // old filter shows up in the bar, then clear the carrier so it never reapplies.
  // The ref keeps StrictMode's double-invoke from issuing two concurrent saves.
  const migrationRef = useRef(false);
  useEffect(() => {
    if (migrationRef.current) return;
    migrationRef.current = true;
    void (async () => {
      const settings = await window.yanshuf.settings.get();
      if (!settings.migratedViewQuery) return;
      setQuery((current) => current || settings.migratedViewQuery!);
      await window.yanshuf.settings.save({ ...settings, migratedViewQuery: undefined });
      notifyApplied('Filters moved', 'Your capture filter is now an editable filter above the list');
    })();
  }, []);

  useEffect(() => {
    void window.yanshuf.capture.list().then(setEntries);
    void window.yanshuf.proxy.status().then(setStatus);
    const offCapture = window.yanshuf.capture.onUpdated((next) => {
      setEntries(next);
      if (next.length === 0) setSelectedId(null);
    });
    const offStatus = window.yanshuf.proxy.onStatusUpdated(setStatus);
    return () => {
      offCapture();
      offStatus();
    };
  }, []);

  useEffect(() => {
    void window.yanshuf.proxy.status().then(setStatus);
  }, [proxyStatusNonce]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedEntry(null);
      return;
    }
    void window.yanshuf.capture.get(selectedId).then((entry) => setSelectedEntry(entry ?? null));
  }, [selectedId, entries]);

  const handleSelectEntry = (id: string) => {
    setSelectedId(id);
    onCaptureEntrySelect?.();
  };

  const { handleBreakpointResolved } = useBreakpointNavigation({
    entries,
    selectedId,
    onSelect: handleSelectEntry,
    onNavigateToCapture: onCaptureEntrySelect,
  });

  const toggleCapture = async () => {
    try {
      const next = await withCertGate(
        () => window.yanshuf.proxy.toggle(),
        () => onOpenCertificateSettings?.(),
      );
      if (next) setStatus(next);
    } catch (err) {
      notifyActionFailed('toggle capture', err);
    }
  };

  const clearSession = () => {
    void clearCapturedRequests();
  };

  const toggleThrottle = async () => {
    try {
      const enabled = !(status?.throttle.enabled ?? false);
      const next = await window.yanshuf.proxy.setThrottle({ enabled });
      setStatus(next);
    } catch (err) {
      notifyActionFailed('toggle throttling', err);
    }
  };

  // Both act on the view query, so they are instant and reversible.
  const showOnlyHost = (host: string) => {
    setQuery((current) =>
      toggleQueryTerm(current, { field: 'host', value: hostWithoutPort(host), negated: false }),
    );
  };

  const hideHost = (host: string) => {
    setQuery((current) =>
      toggleQueryTerm(current, { field: 'host', value: hostWithoutPort(host), negated: true }),
    );
  };

  const throttleLabel = (() => {
    if (!status?.throttle.enabled) return 'Throttle';
    const preset = status.throttle.preset;
    if (preset === '3g') return '3G';
    if (preset === 'edge') return 'Edge';
    if (preset === 'regular-3g') return 'Reg 3G';
    if (preset === 'regular-4g') return 'Reg 4G';
    return 'Throttle';
  })();

  return (
    <div className="flex h-full flex-col">
      {detailMode === 'capture' && selectedEntry && (
        <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {selectedEntry.method} {selectedEntry.url}
          </span>
          <CopyUrlButton value={selectedEntry.url} title="Copy request URL" />
        </div>
      )}
      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel defaultSize={35} minSize={20}>
          <div className="flex h-full min-h-0 flex-col">
            <FilterBar
              ref={filterInputRef}
              query={query}
              onQueryChange={setQuery}
              shown={filtered.length}
              total={entries.length}
            />
            <div className="min-h-0 flex-1">
              <SessionList
                entries={filtered}
                totalCount={entries.length}
                selectedId={selectedId}
                onSelect={handleSelectEntry}
                draggable={detailMode !== 'capture'}
                onAddToComposer={onAddToComposer}
                onCreateRule={onCreateRule}
                onCreateMapRemoteRule={onCreateMapRemoteRule}
                onShowOnlyHost={showOnlyHost}
                onHideHost={hideHost}
              />
            </div>
          </div>
        </Panel>
        <Separator className="w-1 bg-border transition-colors hover:bg-primary/30" />
        <Panel defaultSize={65} minSize={30}>
          {detailMode === 'capture' && selectedEntry?.awaitingBreakpoint ? (
            <BreakpointPanel entry={selectedEntry} onResolved={handleBreakpointResolved} />
          ) : detailMode === 'capture' && (
            <Group orientation="horizontal" className="h-full min-h-0">
              <Panel defaultSize={50} minSize={25}>
                <RequestPane entry={selectedEntry} />
              </Panel>
              <Separator className="w-1 bg-border transition-colors hover:bg-primary/30" />
              <Panel defaultSize={50} minSize={25}>
                <ResponsePane entry={selectedEntry} />
              </Panel>
            </Group>
          )}
          {detailMode === 'composer' && (
            <ComposerWorkspace
              loadFromEntryId={composerLoadEntryId}
              onLoadHandled={onComposerLoadHandled}
              onCertBlocked={onOpenCertificateSettings}
            />
          )}
          {detailMode === 'rules' && (
            <AutoResponderWorkspace
              loadFromEntryId={rulesLoadEntryId}
              loadFromEntryKind={rulesLoadEntryKind}
              onLoadHandled={onRulesLoadHandled}
            />
          )}
        </Panel>
      </Group>
      <StatusBar
        status={status}
        entryCount={entries.length}
        certStatus={certStatus}
        integrationStatus={integrationStatus}
        onToggleCapture={toggleCapture}
        onToggleThrottle={toggleThrottle}
        throttleLabel={throttleLabel}
        onClear={clearSession}
        onOpenCertificateSettings={onOpenCertificateSettings}
        onOpenAiSettings={onOpenAiSettings}
        onOpenFilterSettings={onOpenFilterSettings}
      />
    </div>
  );
}

function StatusBar({
  status,
  entryCount,
  certStatus,
  integrationStatus,
  onToggleCapture,
  onToggleThrottle,
  throttleLabel,
  onClear,
  onOpenCertificateSettings,
  onOpenAiSettings,
  onOpenFilterSettings,
}: {
  status: ProxyStatus | null;
  entryCount: number;
  certStatus?: CertStatus | null;
  integrationStatus: IntegrationAggregateStatus;
  onToggleCapture: () => void;
  onToggleThrottle: () => void;
  throttleLabel: string;
  onClear: () => void;
  onOpenCertificateSettings?: () => void;
  onOpenAiSettings?: () => void;
  onOpenFilterSettings?: () => void;
}) {
  const certLabel =
    certStatus?.trusted === 'installed'
      ? 'Trusted'
      : certStatus?.trusted === 'untrusted'
        ? 'Needs trust'
        : 'Certificate';
  const certTitle =
    certStatus?.trusted === 'installed'
      ? 'Certificate installed and trusted'
      : certStatus?.trusted === 'untrusted'
        ? 'Certificate installed but not trusted'
        : 'Install root certificate';

  // Live filtering shows its own count in the filter bar; this only reports the
  // never-record list, which is the one thing that permanently drops traffic.
  const exclusions = status?.recordingExclusions;
  const exclusionLabel = exclusions?.excluding
    ? `Not recording: ${exclusions.patternCount}`
    : 'Recording all';
  const exclusionTitle = exclusions?.excluding
    ? `${exclusions.patternCount} host pattern(s) are never recorded. ${exclusions.droppedCount} request(s) dropped since the last change — still forwarded, just not stored.`
    : 'Every proxied request is recorded. Add exclusions in Settings → Capture.';

  return (
    <div className="flex items-center gap-3 border-t bg-muted/30 px-3 py-1.5 text-xs">
      <div data-tour="status-bar-toggles" className="flex items-center gap-2">
        <StatusToggle
          label="Capture"
          active={status?.running ?? false}
          onToggle={onToggleCapture}
          shortcutKeys={SHORTCUTS.toggleCapture.keys}
        />
        <StatusToggle
          label={throttleLabel}
          active={status?.throttle.enabled ?? false}
          onToggle={onToggleThrottle}
        />
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted/60',
            exclusions?.excluding
              ? 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300'
              : 'border-border bg-background/60 text-muted-foreground',
          )}
          onClick={() => onOpenFilterSettings?.()}
          title={exclusionTitle}
        >
          <Filter
            className={cn(
              'h-3.5 w-3.5',
              exclusions?.excluding && 'text-violet-600 dark:text-violet-400',
            )}
          />
          {exclusionLabel}
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center gap-2">
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted/60',
            certStatus?.trusted === 'installed' &&
              'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
            certStatus?.trusted === 'untrusted' &&
              'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
            certStatus?.trusted !== 'installed' &&
              certStatus?.trusted !== 'untrusted' &&
              'border-border bg-background/60 text-muted-foreground',
          )}
          onClick={() => onOpenCertificateSettings?.()}
          title={certTitle}
        >
          <Shield
            className={cn(
              'h-3.5 w-3.5',
              certStatus?.trusted === 'installed' && 'text-emerald-600 dark:text-emerald-400',
              certStatus?.trusted === 'untrusted' && 'text-amber-600 dark:text-amber-400',
            )}
          />
          {certLabel}
        </button>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted/60',
            integrationStatus === 'installed' &&
              'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400',
            integrationStatus === 'update_available' &&
              'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
            integrationStatus === 'not_installed' &&
              'border-border bg-background/60 text-muted-foreground',
          )}
          onClick={() => onOpenAiSettings?.()}
          title={
            integrationStatus === 'installed'
              ? 'AI integration connected'
              : integrationStatus === 'update_available'
                ? 'AI integration update available'
                : 'Set up AI integration'
          }
        >
          <Bot
            className={cn(
              'h-3.5 w-3.5',
              integrationStatus === 'installed' && 'text-teal-600 dark:text-teal-400',
              integrationStatus === 'update_available' && 'text-amber-600 dark:text-amber-400',
            )}
          />
          {integrationStatus === 'installed'
            ? 'AI connected'
            : integrationStatus === 'update_available'
              ? 'AI update'
              : 'AI'}
        </button>
        <span className="text-muted-foreground">Port: {status?.port ?? 8888}</span>
        <span className="text-muted-foreground">Entries: {entryCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 gap-2 px-2 text-muted-foreground" onClick={onClear}>
          Clear
          <ShortcutHint keys={SHORTCUTS.clearSession.keys} />
        </Button>
        <ShortcutLegend />
      </div>
    </div>
  );
}

function StatusToggle({
  label,
  active,
  onToggle,
  shortcutKeys,
  disabled,
  title,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  shortcutKeys?: ShortcutKey[];
  disabled?: boolean;
  title?: string;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      title={title}
      className={cn(
        'inline-flex h-7 select-none items-center gap-2 rounded-md border border-input bg-background px-2 shadow-sm transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:bg-accent/50',
        active && 'border-emerald-500/35 bg-emerald-500/[0.06]',
      )}
    >
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full transition-colors',
          active ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.45)]' : 'bg-muted-foreground/35',
        )}
        aria-hidden
      />
      <span className="text-xs font-medium">{label}</span>
      {shortcutKeys && <ShortcutHint keys={shortcutKeys} />}
      <Switch
        id={id}
        checked={active}
        disabled={disabled}
        onCheckedChange={onToggle}
        className={cn('scale-90', active && 'data-[state=checked]:bg-emerald-600')}
      />
    </label>
  );
}

export { StatusBar };
