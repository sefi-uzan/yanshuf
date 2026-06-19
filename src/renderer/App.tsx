import { useCallback, useEffect, useState } from 'react';
import { CaptureView } from '@/features/capture/CaptureView';
import type { DetailMode } from '@/features/capture/detailMode';
import { CertWizard, SettingsPanel } from '@/features/settings/SettingsPanels';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ShortcutHint } from '@/components/shortcut-hints';
import { cn } from '@/lib/utils';
import { Settings, Shield, Zap, PenLine, Search } from 'lucide-react';
import type { CertStatus } from '../shared/types';
import { SHORTCUTS } from '../shared/shortcuts';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [detailMode, setDetailMode] = useState<DetailMode>('capture');
  const [composerLoadEntryId, setComposerLoadEntryId] = useState<string | null>(null);
  const [rulesLoadEntryId, setRulesLoadEntryId] = useState<string | null>(null);
  const [certOpen, setCertOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [certStatus, setCertStatus] = useState<CertStatus | null>(null);

  const refreshCertStatus = useCallback(() => {
    void window.yanshuf.cert.status().then(setCertStatus);
  }, []);

  useEffect(() => {
    refreshCertStatus();
  }, [refreshCertStatus]);

  const toggleDetailMode = useCallback((mode: DetailMode) => {
    setDetailMode((current) => (current === mode ? 'capture' : mode));
  }, []);

  const handleMenuAction = useCallback(async (action: string) => {
    switch (action) {
      case 'toggle-proxy': {
        const status = await window.yanshuf.proxy.status();
        if (status.running) await window.yanshuf.proxy.stop();
        else await window.yanshuf.proxy.start();
        break;
      }
      case 'toggle-system-proxy': {
        const status = await window.yanshuf.proxy.status();
        if (status.systemProxyEnabled) await window.yanshuf.systemProxy.disable();
        else await window.yanshuf.systemProxy.enable();
        break;
      }
      case 'clear-session':
        await window.yanshuf.capture.clear();
        break;
      case 'focus-search':
        setSearchVisible(true);
        break;
      case 'open-composer':
        toggleDetailMode('composer');
        break;
      case 'open-rules':
        toggleDetailMode('rules');
        break;
      case 'replay-to-composer': {
        const entries = await window.yanshuf.capture.list();
        const last = entries[entries.length - 1];
        if (last) {
          setComposerLoadEntryId(last.id);
          setDetailMode('composer');
        }
        break;
      }
      case 'install-certificate':
        setCertOpen(true);
        break;
    }
  }, [toggleDetailMode]);

  useEffect(() => {
    return window.yanshuf.menu.onAction(handleMenuAction);
  }, [handleMenuAction]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'f') {
        e.preventDefault();
        setSearchVisible((v) => !v);
      }
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        toggleDetailMode('composer');
      }
      if (e.metaKey && e.key === 'x' && !e.shiftKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        void window.yanshuf.capture.clear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleDetailMode]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Logo />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(searchVisible && 'bg-accent text-accent-foreground')}
            onClick={() => setSearchVisible((v) => !v)}
            title={`${SHORTCUTS.search.label} (${SHORTCUTS.search.keys.join('+')})`}
          >
            <Search className="mr-1 h-4 w-4" />
            Search
            <ShortcutHint keys={SHORTCUTS.search.keys} className="ml-2" />
          </Button>
          <Button
            variant={detailMode === 'rules' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => toggleDetailMode('rules')}
          >
            <Zap className="mr-1 h-4 w-4" /> Rules
          </Button>
          <Button
            variant={detailMode === 'composer' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => toggleDetailMode('composer')}
          >
            <PenLine className="mr-1 h-4 w-4" />
            Composer
            <ShortcutHint keys={SHORTCUTS.composer.keys} className="ml-2" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCertOpen(true)} title={
            certStatus?.trusted === 'installed'
              ? 'Certificate installed and trusted'
              : certStatus?.trusted === 'untrusted'
                ? 'Certificate needs Always Trust'
                : 'Install root certificate'
          }>
            <Shield
              className={cn(
                'mr-1 h-4 w-4',
                certStatus?.trusted === 'installed' && 'text-emerald-600 dark:text-emerald-400',
                certStatus?.trusted === 'untrusted' && 'text-amber-600 dark:text-amber-400',
              )}
            />
            Certificate
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <CaptureView
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchVisible={searchVisible}
          detailMode={detailMode}
          composerLoadEntryId={composerLoadEntryId}
          onComposerLoadHandled={() => setComposerLoadEntryId(null)}
          rulesLoadEntryId={rulesLoadEntryId}
          onRulesLoadHandled={() => setRulesLoadEntryId(null)}
          onComposerSent={() => setDetailMode('capture')}
          onAddToComposer={(entryId) => {
            setComposerLoadEntryId(entryId);
            setDetailMode('composer');
          }}
          onCreateRule={(entryId) => {
            setRulesLoadEntryId(entryId);
            setDetailMode('rules');
          }}
        />
      </main>
      <CertWizard
        open={certOpen}
        onOpenChange={(open) => {
          setCertOpen(open);
          if (!open) refreshCertStatus();
        }}
        onStatusChange={setCertStatus}
      />
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
