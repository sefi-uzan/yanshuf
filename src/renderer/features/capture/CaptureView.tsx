import { useEffect, useState } from 'react';
import type { CaptureEntrySummary, ProxyStatus } from '../../../shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SessionList } from './SessionList';
import { RequestPane, ResponsePane } from './MessagePane';
import type { CaptureEntry } from '../../../shared/types';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Search } from 'lucide-react';
import { CopyUrlButton } from '@/components/CopyUrlButton';
import { ShortcutHint, ShortcutLegend } from '@/components/shortcut-hints';
import { SHORTCUTS } from '../../../shared/shortcuts';
import type { DetailMode } from './detailMode';
import { ComposerWorkspace } from '@/features/composer/ComposerWorkspace';
import { AutoResponderWorkspace } from '@/features/auto-responder/AutoResponderWorkspace';

interface CaptureViewProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchVisible: boolean;
  detailMode: DetailMode;
  composerLoadEntryId?: string | null;
  onComposerLoadHandled?: () => void;
  rulesLoadEntryId?: string | null;
  onRulesLoadHandled?: () => void;
  onComposerSent?: () => void;
  onAddToComposer?: (entryId: string) => void;
  onCreateRule?: (entryId: string) => void;
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
  onComposerSent,
  onAddToComposer,
  onCreateRule,
}: CaptureViewProps) {
  const [entries, setEntries] = useState<CaptureEntrySummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<CaptureEntry | null>(null);
  const [status, setStatus] = useState<ProxyStatus | null>(null);

  useEffect(() => {
    void window.yanshuf.capture.list().then(setEntries);
    void window.yanshuf.proxy.status().then(setStatus);
    return window.yanshuf.capture.onUpdated((next) => {
      setEntries(next);
      if (next.length === 0) setSelectedId(null);
      void window.yanshuf.proxy.status().then(setStatus);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedEntry(null);
      return;
    }
    void window.yanshuf.capture.get(selectedId).then((entry) => setSelectedEntry(entry ?? null));
  }, [selectedId]);

  const toggleProxy = async () => {
    const next = status?.running
      ? await window.yanshuf.proxy.stop()
      : await window.yanshuf.proxy.start();
    setStatus(next);
  };

  const toggleSystemProxy = async () => {
    const next = status?.systemProxyEnabled
      ? await window.yanshuf.systemProxy.disable()
      : await window.yanshuf.systemProxy.enable();
    setStatus(next);
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
            onSelect={setSelectedId}
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
              onSent={() => {
                void window.yanshuf.capture.list().then((entries) => {
                  const last = entries[entries.length - 1];
                  if (last) setSelectedId(last.id);
                });
                onComposerSent?.();
              }}
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
      <StatusBar status={status} onToggleProxy={toggleProxy} onToggleSystemProxy={toggleSystemProxy} />
    </div>
  );
}

function StatusBar({
  status,
  onToggleProxy,
  onToggleSystemProxy,
}: {
  status: ProxyStatus | null;
  onToggleProxy: () => void;
  onToggleSystemProxy: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t bg-muted/30 px-3 py-1.5 text-xs">
      <Badge variant={status?.running ? 'success' : 'secondary'}>
        Proxy {status?.running ? 'On' : 'Off'}
      </Badge>
      <Button variant="ghost" size="sm" className="h-7 gap-2 px-2" onClick={onToggleProxy}>
        Toggle Capture
        <ShortcutHint keys={SHORTCUTS.toggleCapture.keys} />
      </Button>
      <Badge variant={status?.systemProxyEnabled ? 'success' : 'outline'}>
        System Proxy {status?.systemProxyEnabled ? 'On' : 'Off'}
      </Badge>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onToggleSystemProxy}>
        Toggle System Proxy
      </Button>
      <span className="text-muted-foreground">Port: {status?.port ?? 8888}</span>
      <span className="text-muted-foreground">Entries: {status?.entryCount ?? 0}</span>
      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1 text-muted-foreground">
          Clear
          <ShortcutHint keys={SHORTCUTS.clearSession.keys} />
        </span>
        <ShortcutLegend />
      </div>
    </div>
  );
}

export { StatusBar };
