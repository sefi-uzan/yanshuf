import { useEffect, useId, useState } from 'react';
import type { CaptureEntry, CaptureEntrySummary, CertStatus, ProxyStatus } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { SessionList } from './SessionList';
import { RequestPane, ResponsePane } from './MessagePane';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Search, Shield } from 'lucide-react';
import { CopyUrlButton } from '@/components/CopyUrlButton';
import { ShortcutHint, ShortcutLegend } from '@/components/shortcut-hints';
import { SHORTCUTS, type ShortcutKey } from '../../../shared/shortcuts';
import type { DetailMode } from './detailMode';
import { ComposerWorkspace } from '@/features/composer/ComposerWorkspace';
import { AutoResponderWorkspace } from '@/features/auto-responder/AutoResponderWorkspace';
import { withCertGate } from '@/lib/cert-gate';
import { clearCapturedRequests, notifyActionFailed } from '@/lib/toast-actions';

interface CaptureViewProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchVisible: boolean;
  detailMode: DetailMode;
  composerLoadEntryId?: string | null;
  onComposerLoadHandled?: () => void;
  rulesLoadEntryId?: string | null;
  onRulesLoadHandled?: () => void;
  onAddToComposer?: (entryId: string) => void;
  onCreateRule?: (entryId: string) => void;
  onCaptureEntrySelect?: () => void;
  certStatus?: CertStatus | null;
  onOpenCertificateSettings?: () => void;
  proxyStatusNonce?: number;
}

export function CaptureView({
  searchQuery,
  onSearchChange,
  searchVisible,
  detailMode,
  composerLoadEntryId,
  onComposerLoadHandled,
  rulesLoadEntryId,
  onRulesLoadHandled,
  onAddToComposer,
  onCreateRule,
  onCaptureEntrySelect,
  certStatus,
  onOpenCertificateSettings,
  proxyStatusNonce = 0,
}: CaptureViewProps) {
  const [entries, setEntries] = useState<CaptureEntrySummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<CaptureEntry | null>(null);
  const [status, setStatus] = useState<ProxyStatus | null>(null);

  useEffect(() => {
    void window.yanshuf.capture.list().then(setEntries);
    void window.yanshuf.proxy.status().then(setStatus);
    // Proxy on/off state doesn't change per request, so we don't re-poll status here.
    return window.yanshuf.capture.onUpdated((next) => {
      setEntries(next);
      if (next.length === 0) setSelectedId(null);
    });
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
  }, [selectedId]);

  const handleSelectEntry = (id: string) => {
    setSelectedId(id);
    onCaptureEntrySelect?.();
  };

  const toggleProxy = async () => {
    try {
      if (status?.running) {
        const next = await window.yanshuf.proxy.stop();
        setStatus(next);
        return;
      }
      if (!status?.systemProxyEnabled) {
        notifyActionFailed('start capture', new Error('Enable System Proxy first'));
        return;
      }
      const next = await withCertGate(
        () => window.yanshuf.proxy.start(),
        () => onOpenCertificateSettings?.(),
      );
      if (next) setStatus(next);
    } catch (err) {
      notifyActionFailed('start capture', err);
    }
  };

  const toggleSystemProxy = async () => {
    try {
      if (status?.systemProxyEnabled) {
        const next = await window.yanshuf.systemProxy.disable();
        setStatus(next);
        return;
      }
      const next = await withCertGate(
        () => window.yanshuf.systemProxy.enable(),
        () => onOpenCertificateSettings?.(),
      );
      if (next) setStatus(next);
    } catch (err) {
      notifyActionFailed('enable system proxy', err);
    }
  };

  const clearSession = () => {
    void clearCapturedRequests();
  };

  return (
    <div className="flex h-full flex-col">
      {searchVisible && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search URL, host, method, status…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8"
          />
        </div>
      )}
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
          <SessionList
            entries={entries}
            selectedId={selectedId}
            onSelect={handleSelectEntry}
            searchQuery={searchQuery}
            draggable={detailMode !== 'capture'}
            onAddToComposer={onAddToComposer}
            onCreateRule={onCreateRule}
          />
        </Panel>
        <Separator className="w-1 bg-border transition-colors hover:bg-primary/30" />
        <Panel defaultSize={65} minSize={30}>
          {detailMode === 'capture' && (
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
              onLoadHandled={onRulesLoadHandled}
            />
          )}
        </Panel>
      </Group>
      <StatusBar
        status={status}
        entryCount={entries.length}
        certStatus={certStatus}
        onToggleProxy={toggleProxy}
        onToggleSystemProxy={toggleSystemProxy}
        onClear={clearSession}
        onOpenCertificateSettings={onOpenCertificateSettings}
      />
    </div>
  );
}

function StatusBar({
  status,
  entryCount,
  certStatus,
  onToggleProxy,
  onToggleSystemProxy,
  onClear,
  onOpenCertificateSettings,
}: {
  status: ProxyStatus | null;
  entryCount: number;
  certStatus?: CertStatus | null;
  onToggleProxy: () => void;
  onToggleSystemProxy: () => void;
  onClear: () => void;
  onOpenCertificateSettings?: () => void;
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
        ? 'Certificate needs Always Trust'
        : 'Install root certificate';

  return (
    <div className="flex items-center gap-3 border-t bg-muted/30 px-3 py-1.5 text-xs">
      <div data-tour="status-bar-toggles" className="flex items-center gap-2">
        <StatusToggle
          label="Capture"
          active={status?.running ?? false}
          onToggle={onToggleProxy}
          shortcutKeys={SHORTCUTS.toggleCapture.keys}
          disabled={!status?.running && !status?.systemProxyEnabled}
          title={
            !status?.systemProxyEnabled && !status?.running
              ? 'Enable System Proxy first'
              : undefined
          }
        />
        <StatusToggle
          label="System Proxy"
          active={status?.systemProxyEnabled ?? false}
          onToggle={onToggleSystemProxy}
        />
      </div>
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
      <span className="text-muted-foreground">Port: {status?.port ?? 8888}</span>
      <span className="text-muted-foreground">Entries: {entryCount}</span>
      <div className="ml-auto flex items-center gap-2">
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
