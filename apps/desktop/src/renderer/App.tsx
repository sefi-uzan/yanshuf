import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptureView } from '@/features/capture/CaptureView';
import type { DetailMode } from '@/features/capture/detailMode';
import { CertOnboarding } from '@/features/certificate/CertOnboarding';
import { PostCertIntegrationPrompt } from '@/features/integration/PostCertIntegrationPrompt';
import { IntegrationOnboarding } from '@/features/integration/IntegrationOnboarding';
import { GuidedTour } from '@/features/guided-tour/GuidedTour';
import { SettingsPanel, type SettingsTab } from '@/features/settings/SettingsPanels';
import { AppHeader } from '@/components/AppHeader';
import { withCertGate } from '@/lib/cert-gate';
import { clearCapturedRequests, notifyActionFailed } from '@/lib/toast-actions';
import type { CertStatus, IntegrationAggregateStatus, IntegrationClient } from '@yanshuf/shared';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [detailMode, setDetailMode] = useState<DetailMode>('capture');
  const [composerLoadEntryId, setComposerLoadEntryId] = useState<string | null>(null);
  const [rulesLoadEntryId, setRulesLoadEntryId] = useState<string | null>(null);
  const [rulesLoadEntryKind, setRulesLoadEntryKind] = useState<'mock' | 'mapRemote'>('mock');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [focusAiUpdates, setFocusAiUpdates] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [certStatus, setCertStatus] = useState<CertStatus | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationAggregateStatus>('not_installed');
  const [integrationStatusNonce, setIntegrationStatusNonce] = useState(0);
  const [postCertPromptOpen, setPostCertPromptOpen] = useState(false);
  const [integrationOnboardingClient, setIntegrationOnboardingClient] =
    useState<IntegrationClient | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [proxyStatusNonce, setProxyStatusNonce] = useState(0);
  const firstRunChecked = useRef(false);

  const refreshCertStatus = useCallback(() => {
    void window.yanshuf.cert.status().then(setCertStatus);
  }, []);

  const refreshIntegrationStatus = useCallback(() => {
    void window.yanshuf.integration.status().then((s) => {
      setIntegrationStatus(s.status);
      setIntegrationStatusNonce((n) => n + 1);
    });
  }, []);

  const openCertOnboarding = useCallback(() => {
    setOnboardingOpen(true);
  }, []);

  const openSettings = useCallback(() => {
    setSettingsTab('general');
    setFocusAiUpdates(false);
    setSettingsOpen(true);
  }, []);

  const openAiSettings = useCallback((focusUpdates = false) => {
    setSettingsTab('ai');
    setFocusAiUpdates(focusUpdates);
    setSettingsOpen(true);
  }, []);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((open) => {
      if (!open) {
        setSettingsTab('general');
        setFocusAiUpdates(false);
      }
      return !open;
    });
  }, []);

  const openCertificateSettings = useCallback(() => {
    setSettingsTab('certificate');
    setFocusAiUpdates(false);
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

  const maybeShowPostCertPrompt = useCallback(async () => {
    const status = await window.yanshuf.integration.status();
    const registry = await window.yanshuf.integration.getRegistry();
    if (!status.hasAnyInstall && !registry.postCertPromptDismissed) {
      setPostCertPromptOpen(true);
    }
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
    void maybeShowPostCertPrompt();
  }, [maybeShowPostCertPrompt]);

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
    void refreshIntegrationStatus();
  }, [refreshIntegrationStatus]);

  const toggleDetailMode = useCallback((mode: DetailMode) => {
    setDetailMode((current) => (current === mode ? 'capture' : mode));
  }, []);

  const handleMenuAction = useCallback(async (action: string) => {
    switch (action) {
      case 'toggle-proxy': {
        const status = await window.yanshuf.proxy.status();
        if (status.running) {
          await window.yanshuf.proxy.stop();
        } else if (!status.systemProxyEnabled) {
          notifyActionFailed('start capture', new Error('Enable System Proxy first'));
        } else {
          try {
            await withCertGate(() => window.yanshuf.proxy.start(), openCertOnboarding);
          } catch (err) {
            notifyActionFailed('start capture', err);
          }
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
        if (!settingsOpen) toggleSettings();
      }
      if (e.metaKey && e.key === 'x' && !e.shiftKey && !isEditableTarget(e.target)) {
        e.preventDefault();
        void clearCapturedRequests();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleDetailMode, toggleSettings, settingsOpen]);

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchOpen={searchVisible}
        onSearchOpenChange={setSearchVisible}
        detailMode={detailMode}
        onToggleDetailMode={toggleDetailMode}
        onOpenSettings={openSettings}
      />
      <main className="min-h-0 flex-1">
        <CaptureView
          searchQuery={searchQuery}
          detailMode={detailMode}
          composerLoadEntryId={composerLoadEntryId}
          onComposerLoadHandled={() => setComposerLoadEntryId(null)}
          rulesLoadEntryId={rulesLoadEntryId}
          rulesLoadEntryKind={rulesLoadEntryKind}
          onRulesLoadHandled={() => {
            setRulesLoadEntryId(null);
            setRulesLoadEntryKind('mock');
          }}
          onAddToComposer={(entryId) => {
            setComposerLoadEntryId(entryId);
            setDetailMode('composer');
          }}
          onCreateRule={(entryId) => {
            setRulesLoadEntryKind('mock');
            setRulesLoadEntryId(entryId);
            setDetailMode('rules');
          }}
          onCreateMapRemoteRule={(entryId) => {
            setRulesLoadEntryKind('mapRemote');
            setRulesLoadEntryId(entryId);
            setDetailMode('rules');
          }}
          onCaptureEntrySelect={() => setDetailMode('capture')}
          certStatus={certStatus}
          onOpenCertificateSettings={openCertFlow}
          integrationStatus={integrationStatus}
          onOpenAiSettings={() =>
            openAiSettings(integrationStatus === 'update_available')
          }
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
      <PostCertIntegrationPrompt
        open={postCertPromptOpen}
        onOpenChange={setPostCertPromptOpen}
        onChooseClient={(client) => {
          setPostCertPromptOpen(false);
          setIntegrationOnboardingClient(client);
        }}
        onDismiss={() => void window.yanshuf.integration.dismissPostCertPrompt()}
      />
      {integrationOnboardingClient && (
        <IntegrationOnboarding
          open={Boolean(integrationOnboardingClient)}
          onOpenChange={(open) => {
            if (!open) setIntegrationOnboardingClient(null);
          }}
          client={integrationOnboardingClient}
          onOpenCertificate={openCertFlow}
          onComplete={refreshIntegrationStatus}
        />
      )}
      <GuidedTour open={tourOpen} onComplete={completeTour} />
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) {
            refreshCertStatus();
            setFocusAiUpdates(false);
          }
        }}
        defaultTab={settingsTab}
        focusAiUpdates={focusAiUpdates}
        onCertStatusChange={setCertStatus}
        onOpenCertOnboarding={() => {
          setSettingsOpen(false);
          setOnboardingOpen(true);
        }}
        certStatus={certStatus}
        integrationStatusNonce={integrationStatusNonce}
        onIntegrationStatusChange={refreshIntegrationStatus}
      />
    </div>
  );
}
