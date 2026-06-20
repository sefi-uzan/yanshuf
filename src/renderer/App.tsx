import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptureView } from '@/features/capture/CaptureView';
import type { DetailMode } from '@/features/capture/detailMode';
import { CertOnboarding } from '@/features/certificate/CertOnboarding';
import { GuidedTour } from '@/features/guided-tour/GuidedTour';
import { SettingsPanel, type SettingsTab } from '@/features/settings/SettingsPanels';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ShortcutHint } from '@/components/shortcut-hints';
import { cn } from '@/lib/utils';
import { withCertGate } from '@/lib/cert-gate';
import { clearCapturedRequests } from '@/lib/toast-actions';
import { Settings, Zap, PenLine, Search } from 'lucide-react';
import type { CertStatus } from '../shared/types';
import { SHORTCUTS } from '../shared/shortcuts';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [detailMode, setDetailMode] = useState<DetailMode>('capture');
  const [composerLoadEntryId, setComposerLoadEntryId] = useState<string | null>(null);
  const [rulesLoadEntryId, setRulesLoadEntryId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [certStatus, setCertStatus] = useState<CertStatus | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [proxyStatusNonce, setProxyStatusNonce] = useState(0);
  const firstRunChecked = useRef(false);

  const refreshCertStatus = useCallback(() => {
    void window.yanshuf.cert.status().then(setCertStatus);
  }, []);

  const openCertOnboarding = useCallback(() => {
    setOnboardingOpen(true);
  }, []);

  const openSettings = useCallback(() => {
    setSettingsTab('general');
    setSettingsOpen(true);
  }, []);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((open) => {
      if (!open) setSettingsTab('general');
      return !open;
    });
  }, []);

  const openCertificateSettings = useCallback(() => {
    setSettingsTab('certificate');
    setSettingsOpen(true);
  }, []);

  const openCertFlow = useCallback(() => {
    if (certStatus?.trusted === 'installed') {
      openCertificateSettings();
    } else {
      openCertOnboarding();
    }
  }, [certStatus?.trusted, openCertificateSettings, openCertOnboarding]);

  const completeTour = useCallback(async () => {
    setTourOpen(false);
    const current = await window.yanshuf.settings.get();
    await window.yanshuf.settings.save({ ...current, guidedTourCompleted: true });
  }, []);

  const handleCertOnboardingComplete = useCallback(async () => {
    try {
      await window.yanshuf.systemProxy.enable();
    } catch {
      // Tour still runs; status bar reflects failure on next refresh.
    }
    setProxyStatusNonce((n) => n + 1);
    const settings = await window.yanshuf.settings.get();
    if (!settings.guidedTourCompleted) {
      setTourOpen(true);
    }
  }, []);

  useEffect(() => {
    void window.yanshuf.cert.status().then((status) => {
      setCertStatus(status);
      if (!firstRunChecked.current) {
        firstRunChecked.current = true;
        if (status.trusted !== 'installed') {
          setOnboardingOpen(true);
        }
      }
    });
  }, []);

  const toggleDetailMode = useCallback((mode: DetailMode) => {
    setDetailMode((current) => (current === mode ? 'capture' : mode));
  }, []);

  const handleMenuAction = useCallback(async (action: string) => {
    switch (action) {
      case 'toggle-proxy': {
        const status = await window.yanshuf.proxy.status();
        if (status.running) {
          await window.yanshuf.proxy.stop();
        } else {
          await withCertGate(() => window.yanshuf.proxy.start(), openCertOnboarding);
        }
        setProxyStatusNonce((n) => n + 1);
        break;
      }
      case 'toggle-system-proxy': {
        const status = await window.yanshuf.proxy.status();
        if (status.systemProxyEnabled) {
          await window.yanshuf.systemProxy.disable();
        } else {
          await withCertGate(() => window.yanshuf.systemProxy.enable(), openCertOnboarding);
        }
        setProxyStatusNonce((n) => n + 1);
        break;
      }
      case 'clear-session':
        await clearCapturedRequests();
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
      case 'install-certificate':
        openCertFlow();
        break;
      case 'open-settings':
        openSettings();
        break;
    }
  }, [toggleDetailMode, openCertFlow, openCertOnboarding, openSettings]);

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
      if (e.metaKey && e.key === 'r' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        toggleDetailMode('rules');
      }
      if (e.metaKey && e.key === 's' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleSettings();
      }
      if (e.metaKey && e.key === 'x' && !e.shiftKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        void clearCapturedRequests();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleDetailMode, toggleSettings]);

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
          <div data-tour="rules-composer" className="flex items-center gap-1">
            <Button
              variant={detailMode === 'rules' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => toggleDetailMode('rules')}
            >
              <Zap className="mr-1 h-4 w-4" /> Rules
              <ShortcutHint keys={SHORTCUTS.autoResponder.keys} className="ml-2" />
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
          </div>
          <Button variant="ghost" size="sm" onClick={openSettings}>
            <Settings className="mr-1 h-4 w-4" />
            Settings
            <ShortcutHint keys={SHORTCUTS.settings.keys} className="ml-2" />
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
          onAddToComposer={(entryId) => {
            setComposerLoadEntryId(entryId);
            setDetailMode('composer');
          }}
          onCreateRule={(entryId) => {
            setRulesLoadEntryId(entryId);
            setDetailMode('rules');
          }}
          onCaptureEntrySelect={() => setDetailMode('capture')}
          certStatus={certStatus}
          onOpenCertificateSettings={openCertFlow}
          proxyStatusNonce={proxyStatusNonce}
        />
      </main>
      <CertOnboarding
        open={onboardingOpen}
        onOpenChange={(open) => {
          setOnboardingOpen(open);
          if (!open) refreshCertStatus();
        }}
        onStatusChange={setCertStatus}
        onComplete={handleCertOnboardingComplete}
      />
      <GuidedTour open={tourOpen} onComplete={completeTour} />
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) refreshCertStatus();
        }}
        defaultTab={settingsTab}
        onCertStatusChange={setCertStatus}
        onOpenCertOnboarding={() => {
          setSettingsOpen(false);
          setOnboardingOpen(true);
        }}
        certStatus={certStatus}
      />
    </div>
  );
}
