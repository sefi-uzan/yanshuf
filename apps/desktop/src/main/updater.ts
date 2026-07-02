import { app, shell } from 'electron';
import type { UpdateCheckResult } from '@yanshuf/shared';
import { notifyRenderer } from './notify-renderer';
import { isNewerVersion } from './updater-version';

export { isNewerVersion } from './updater-version';

const GITHUB_REPO = 'sefi-uzan/yanshuf';
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

type GitHubRelease = {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
};

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastNotifiedVersion: string | null = null;

function normalizeTag(tagName: string): string {
  return tagName.replace(/^v/i, '');
}

async function fetchLatestRelease(): Promise<{ version: string; url: string } | null> {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Yanshuf' },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status})`);
  }

  const release = (await response.json()) as GitHubRelease;
  if (release.draft) return null;

  return {
    version: normalizeTag(release.tag_name),
    url: release.html_url,
  };
}

function notifyUpdateAvailable(version: string, releaseUrl: string): void {
  if (lastNotifiedVersion === version) return;
  lastNotifiedVersion = version;

  notifyRenderer({
    title: `Yanshuf v${version} is available`,
    description: 'Download the latest release from GitHub.',
    variant: 'info',
    externalUrl: releaseUrl,
    externalLabel: 'Download',
  });
}

export async function checkForUpdates(options?: { notify?: boolean }): Promise<UpdateCheckResult> {
  const current = app.getVersion();

  try {
    const latestRelease = await fetchLatestRelease();
    if (!latestRelease) {
      return { current, latest: null, updateAvailable: false, releaseUrl: null };
    }

    const updateAvailable = isNewerVersion(latestRelease.version, current);
    if (updateAvailable && options?.notify !== false) {
      notifyUpdateAvailable(latestRelease.version, latestRelease.url);
    }

    return {
      current,
      latest: latestRelease.version,
      updateAvailable,
      releaseUrl: latestRelease.url,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      current,
      latest: null,
      updateAvailable: false,
      releaseUrl: null,
      error: message,
    };
  }
}

export async function checkForUpdatesManual(): Promise<UpdateCheckResult> {
  const result = await checkForUpdates({ notify: false });

  if (result.error) {
    notifyRenderer({
      title: 'Could not check for updates',
      description: result.error,
      variant: 'error',
    });
    return result;
  }

  if (result.updateAvailable && result.latest && result.releaseUrl) {
    notifyRenderer({
      title: `Yanshuf v${result.latest} is available`,
      description: `You are on v${result.current}.`,
      variant: 'info',
      externalUrl: result.releaseUrl,
      externalLabel: 'Download',
    });
    return result;
  }

  notifyRenderer({
    title: 'You are up to date',
    description: `Yanshuf v${result.current}`,
    variant: 'success',
  });
  return result;
}

export function startUpdateChecks(): void {
  if (!app.isPackaged || intervalId !== null) return;

  void checkForUpdates();
  intervalId = setInterval(() => {
    void checkForUpdates();
  }, CHECK_INTERVAL_MS);
}

export function openExternalUrl(url: string): void {
  void shell.openExternal(url);
}
