import { app, autoUpdater, shell } from 'electron';
import type { UpdateCheckResult } from '@yanshuf/shared';
import { notifyRenderer } from './notify-renderer';
import { parseUpdateCheckInterval } from './updater-interval';

export { isNewerVersion } from './updater-version';

const GITHUB_REPO = 'sefi-uzan/yanshuf';
const DEFAULT_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MANUAL_CHECK_TIMEOUT_MS = 5 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;
let manualCheckPending: ((result: UpdateCheckResult) => void) | null = null;
let manualCheckTimeout: ReturnType<typeof setTimeout> | null = null;
let isManualCheck = false;
let downloadedUpdate: { version: string } | null = null;
let downloading = false;

function getFeedUrl(): string {
  return `https://update.electronjs.org/${GITHUB_REPO}/${process.platform}/${app.getVersion()}`;
}

function parseReleaseVersion(releaseName: string): string {
  const match = /v?(\d+\.\d+\.\d+)/.exec(releaseName);
  return match ? match[1]! : releaseName;
}

function currentResult(overrides: Partial<UpdateCheckResult> = {}): UpdateCheckResult {
  return {
    current: app.getVersion(),
    latest: null,
    updateAvailable: false,
    releaseUrl: null,
    ...overrides,
  };
}

function clearManualCheckTimeout(): void {
  if (manualCheckTimeout !== null) {
    clearTimeout(manualCheckTimeout);
    manualCheckTimeout = null;
  }
}

function finishManualCheck(result: UpdateCheckResult): void {
  clearManualCheckTimeout();
  const resolve = manualCheckPending;
  manualCheckPending = null;
  isManualCheck = false;
  resolve?.(result);
}

function notifyUpdateReady(version: string): void {
  notifyRenderer({
    title: `Yanshuf v${version} is ready`,
    description: 'Restart to finish updating.',
    variant: 'info',
    action: 'install-update',
    actionLabel: 'Restart & update',
  });
}

function attachAutoUpdaterListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  autoUpdater.on('update-available', () => {
    downloading = true;
    if (isManualCheck) {
      notifyRenderer({
        title: 'Downloading update…',
        description: 'The update will install after you restart.',
        variant: 'info',
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    downloading = false;
    if (manualCheckPending) {
      finishManualCheck(currentResult());
    }
  });

  autoUpdater.on('update-downloaded', (_event, _releaseNotes, releaseName) => {
    const version = parseReleaseVersion(releaseName);
    downloadedUpdate = { version };
    downloading = false;
    notifyUpdateReady(version);

    if (manualCheckPending) {
      finishManualCheck(
        currentResult({
          latest: version,
          updateAvailable: true,
          readyToInstall: true,
        }),
      );
    }
  });

  autoUpdater.on('error', (error) => {
    downloading = false;
    const message = error.message;
    if (manualCheckPending) {
      finishManualCheck(currentResult({ error: message }));
    } else {
      notifyRenderer({
        title: 'Could not check for updates',
        description: message,
        variant: 'error',
      });
    }
  });
}

function configureAutoUpdater(): void {
  if (!app.isPackaged || listenersAttached) return;
  attachAutoUpdaterListeners();
  autoUpdater.setFeedURL({ url: getFeedUrl() });
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}

export async function checkForUpdatesManual(): Promise<UpdateCheckResult> {
  if (!app.isPackaged) {
    return currentResult();
  }

  configureAutoUpdater();

  if (downloadedUpdate) {
    notifyUpdateReady(downloadedUpdate.version);
    return currentResult({
      latest: downloadedUpdate.version,
      updateAvailable: true,
      readyToInstall: true,
    });
  }

  if (downloading) {
    notifyRenderer({
      title: 'Downloading update…',
      description: 'The update will install after you restart.',
      variant: 'info',
    });
    return currentResult({ updateAvailable: true, downloading: true });
  }

  isManualCheck = true;

  return new Promise<UpdateCheckResult>((resolve) => {
    manualCheckPending = resolve;
    manualCheckTimeout = setTimeout(() => {
      if (!manualCheckPending) return;
      finishManualCheck(currentResult({ error: 'Update check timed out' }));
    }, MANUAL_CHECK_TIMEOUT_MS);

    autoUpdater.checkForUpdates();
  }).then((result) => {
    if (result.error) {
      notifyRenderer({
        title: 'Could not check for updates',
        description: result.error,
        variant: 'error',
      });
      return result;
    }

    if (!result.updateAvailable) {
      notifyRenderer({
        title: 'You are up to date',
        description: `Yanshuf v${result.current}`,
        variant: 'success',
      });
    }

    return result;
  });
}

export function startUpdateChecks(): void {
  if (!app.isPackaged || intervalId !== null) return;

  configureAutoUpdater();

  const intervalMs = parseUpdateCheckInterval(process.argv) ?? DEFAULT_CHECK_INTERVAL_MS;

  autoUpdater.checkForUpdates();
  intervalId = setInterval(() => {
    autoUpdater.checkForUpdates();
  }, intervalMs);
}

export function openExternalUrl(url: string): void {
  void shell.openExternal(url);
}
