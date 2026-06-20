import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, session, shell } from 'electron';
import path from 'node:path';
import type {
  AppSettings,
  AutoResponderRule,
  ComposedEntry,
  ComposerCollection,
  ComposerRequest,
  MenuAction,
} from '../shared/types';
import { DEFAULT_CAPTURE_FILTER, DEFAULT_SETTINGS, IPC_CHANNELS } from '../shared/types';
import { shouldCaptureUrl } from '../shared/url-filter';
import { AutoResponderEngine } from './auto-responder/engine';
import { CertificateManager } from './cert/manager';
import { assertCertTrusted, rethrowCertIpcError } from './cert/cert-gate';
import { ComposerService, parseCurl } from './composer/service';
import { exportCurl } from '../shared/composer-curl';
import { CaptureStore } from './proxy/capture-store';
import { ProxyServer } from './proxy/server';
import { JsonFileStore } from './storage/json-store';
import { SystemProxyManager } from './system-proxy/macos';

// Only one instance may own the proxy port; focus the existing window instead.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

nativeTheme.themeSource = 'system';

let mainWindow: BrowserWindow | null = null;
let store: JsonFileStore;
let settings: AppSettings;
let captureStore: CaptureStore;
let autoResponder: AutoResponderEngine;
let proxyServer: ProxyServer;
let certManager: CertificateManager;
let systemProxy: SystemProxyManager;
let composerService: ComposerService;

function appIconPath(): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(app.getAppPath(), 'assets');
  const name = process.platform === 'darwin' ? 'icon.icns' : 'icon.png';
  return path.join(base, name);
}

function applyAppIcon(): void {
  const icon = nativeImage.createFromPath(appIconPath());
  if (icon.isEmpty()) return;
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIcon(icon);
  }
}

function buildShouldCapture(): (url: string) => boolean {
  return (url) => shouldCaptureUrl(url, settings.captureFilter ?? DEFAULT_CAPTURE_FILTER);
}

async function loadState(): Promise<void> {
  store = new JsonFileStore(path.join(app.getPath('userData'), 'data'));
  await store.init();

  const stored = await store.read<Partial<AppSettings>>('settings.json', {});
  settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    captureFilter: {
      ...DEFAULT_CAPTURE_FILTER,
      ...stored.captureFilter,
    },
  };
  captureStore = new CaptureStore(settings.ringBufferSize);
  autoResponder = new AutoResponderEngine();
  const rules = await store.read<AutoResponderRule[]>('rules.json', []);
  autoResponder.setRules(rules);

  certManager = new CertificateManager(store.getCertsDir());
  await certManager.ensureCaGenerated();
  systemProxy = new SystemProxyManager();
  composerService = new ComposerService();

  proxyServer = new ProxyServer({
    port: settings.port,
    host: '127.0.0.1',
    sslCaDir: store.getCertsDir(),
    maxBodySize: settings.maxBodySize,
    captureStore,
    autoResponder,
    shouldCapture: buildShouldCapture(),
  });

  proxyServer.on('capture', () => {
    broadcastCaptureUpdate();
  });

  if (settings.systemProxyEnabled) {
    try {
      await assertCertTrusted(certManager);
      await systemProxy.enable('127.0.0.1', settings.port);
    } catch {
      settings.systemProxyEnabled = false;
      await saveSettings();
    }
  }

  if (settings.proxyRunning) {
    if (!systemProxy.isEnabled()) {
      settings.proxyRunning = false;
      await saveSettings();
    } else {
      try {
        await assertCertTrusted(certManager);
        await proxyServer.start();
      } catch {
        settings.proxyRunning = false;
        await saveSettings();
      }
    }
  }
}

async function saveSettings(): Promise<void> {
  await store.write('settings.json', settings);
}

function getProxyStatus() {
  return {
    running: proxyServer.isRunning(),
    port: settings.port,
    entryCount: captureStore.count,
    systemProxyEnabled: systemProxy.isEnabled(),
  };
}

// Coalesce high-frequency capture events into at most one IPC send per window.
const CAPTURE_BROADCAST_INTERVAL_MS = 120;
let captureBroadcastTimer: ReturnType<typeof setTimeout> | null = null;

function flushCaptureUpdate(): void {
  captureBroadcastTimer = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.CAPTURE_UPDATED, captureStore.list());
  }
}

function broadcastCaptureUpdate(immediate = false): void {
  if (immediate) {
    if (captureBroadcastTimer) {
      clearTimeout(captureBroadcastTimer);
      captureBroadcastTimer = null;
    }
    flushCaptureUpdate();
    return;
  }
  if (captureBroadcastTimer) return;
  captureBroadcastTimer = setTimeout(flushCaptureUpdate, CAPTURE_BROADCAST_INTERVAL_MS);
}

function tagComposerCaptures(
  beforeIds: Set<string>,
  req: ComposerRequest,
): void {
  const method = req.method.toUpperCase();
  const url = req.url;
  let tagged = false;

  for (const entry of captureStore.list()) {
    if (beforeIds.has(entry.id)) continue;
    if (entry.method.toUpperCase() === method && entry.url === url) {
      captureStore.markFromComposer(entry.id);
      tagged = true;
    }
  }

  if (!tagged) {
    for (const entry of captureStore.list()) {
      if (!beforeIds.has(entry.id)) {
        captureStore.markFromComposer(entry.id);
      }
    }
  }
}

function sendMenuAction(action: MenuAction): void {
  mainWindow?.webContents.send(IPC_CHANNELS.MENU_ACTION, action);
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Clear Captured Requests',
          click: () => sendMenuAction('clear-session'),
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Proxy',
      submenu: [
        {
          label: 'Toggle Capture',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => sendMenuAction('toggle-proxy'),
        },
        {
          label: 'Enable System Proxy',
          click: () => sendMenuAction('toggle-system-proxy'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Focus Search',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendMenuAction('focus-search'),
        },
        {
          label: 'Composer',
          accelerator: 'CmdOrCtrl+K',
          click: () => sendMenuAction('open-composer'),
        },
        {
          label: 'Auto Responder',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendMenuAction('open-rules'),
        },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('open-settings'),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Install Certificate…',
          click: () => sendMenuAction('install-certificate'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PROXY_START, async () => {
    try {
      if (!systemProxy.isEnabled()) {
        throw new Error('Enable System Proxy before starting capture');
      }
      await assertCertTrusted(certManager);
      await proxyServer.start();
      settings.proxyRunning = true;
      await saveSettings();
      return getProxyStatus();
    } catch (err) {
      rethrowCertIpcError(err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_STOP, async () => {
    await proxyServer.stop();
    settings.proxyRunning = false;
    await saveSettings();
    return getProxyStatus();
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_STATUS, () => getProxyStatus());

  ipcMain.handle(IPC_CHANNELS.CAPTURE_LIST, () => captureStore.list());

  ipcMain.handle(IPC_CHANNELS.CAPTURE_GET, (_e, id: string) => captureStore.get(id));

  ipcMain.handle(IPC_CHANNELS.CAPTURE_CLEAR, () => {
    captureStore.clear();
    broadcastCaptureUpdate(true);
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.CERT_STATUS, () => certManager.getStatus());

  ipcMain.handle(IPC_CHANNELS.CERT_EXPORT, () => certManager.exportCertificate());

  ipcMain.handle(IPC_CHANNELS.CERT_INSTALL, () => certManager.installToLoginKeychain());

  ipcMain.handle(IPC_CHANNELS.CERT_OPEN_KEYCHAIN, () => certManager.openKeychainAccess());

  ipcMain.handle(IPC_CHANNELS.CERT_VERIFY, () => certManager.verifyTrust());

  ipcMain.handle(IPC_CHANNELS.CERT_UNINSTALL, () => certManager.uninstallFromKeychain());

  ipcMain.handle(IPC_CHANNELS.CERT_RESET, async () => {
    if (proxyServer.isRunning()) {
      await proxyServer.stop();
      settings.proxyRunning = false;
    }
    if (systemProxy.isEnabled()) {
      await systemProxy.disable();
      settings.systemProxyEnabled = false;
    }
    await saveSettings();
    return certManager.resetCa();
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_PROXY_ENABLE, async () => {
    try {
      await assertCertTrusted(certManager);
      await systemProxy.enable('127.0.0.1', settings.port);
      settings.systemProxyEnabled = true;
      await saveSettings();
      return getProxyStatus();
    } catch (err) {
      rethrowCertIpcError(err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_PROXY_DISABLE, async () => {
    await systemProxy.disable();
    settings.systemProxyEnabled = false;
    if (proxyServer.isRunning()) {
      await proxyServer.stop();
      settings.proxyRunning = false;
    }
    await saveSettings();
    return getProxyStatus();
  });

  ipcMain.handle(IPC_CHANNELS.RULES_GET, () => autoResponder.getRules());

  ipcMain.handle(IPC_CHANNELS.RULES_SAVE, async (_e, rules: AutoResponderRule[]) => {
    autoResponder.setRules(rules);
    await store.write('rules.json', rules);
    return rules;
  });

  ipcMain.handle(IPC_CHANNELS.COMPOSER_SEND, async (_e, req: ComposerRequest) => {
    try {
      if (!proxyServer.isRunning()) {
        await assertCertTrusted(certManager);
        await proxyServer.start();
        settings.proxyRunning = true;
        await saveSettings();
      }
      const beforeIds = new Set(captureStore.list().map((entry) => entry.id));
      const caCertPath = path.join(certManager.getSslCaDir(), 'certs', 'ca.pem');
      const response = await composerService.send(req, { proxyPort: settings.port, caCertPath });
      tagComposerCaptures(beforeIds, req);
      broadcastCaptureUpdate(true);
      return response;
    } catch (err) {
      rethrowCertIpcError(err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.COMPOSER_PARSE_CURL, (_e, curl: string) => parseCurl(curl));

  ipcMain.handle(IPC_CHANNELS.COMPOSER_EXPORT_CURL, (_e, req: ComposerRequest) => exportCurl(req));

  ipcMain.handle(IPC_CHANNELS.COMPOSER_COLLECTIONS_GET, () =>
    store.read<ComposerCollection[]>('composer/collections.json', []),
  );

  ipcMain.handle(IPC_CHANNELS.COMPOSER_COLLECTIONS_SAVE, (_e, collections: ComposerCollection[]) =>
    store.write('composer/collections.json', collections),
  );

  ipcMain.handle(IPC_CHANNELS.COMPOSER_COMPOSED_GET, () =>
    store.read<ComposedEntry[]>('composer/composed.json', []),
  );

  ipcMain.handle(IPC_CHANNELS.COMPOSER_COMPOSED_SAVE, (_e, entries: ComposedEntry[]) =>
    store.write('composer/composed.json', entries),
  );

  ipcMain.handle(IPC_CHANNELS.DIALOG_PICK_FILE, async (_e, options?: { title?: string }) => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      title: options?.title ?? 'Select file',
    };
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => settings);

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, async (_e, next: AppSettings) => {
    settings = {
      ...next,
      captureFilter: {
        ...DEFAULT_CAPTURE_FILTER,
        ...next.captureFilter,
      },
    };
    captureStore.setMaxSize(settings.ringBufferSize);
    proxyServer.updateOptions({
      maxBodySize: settings.maxBodySize,
      shouldCapture: buildShouldCapture(),
    });
    await saveSettings();
    return settings;
  });
}

const createWindow = async () => {
  const icon = nativeImage.createFromPath(appIconPath());
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Yanshuf',
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Defense-in-depth: never let captured content open new windows or navigate away.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

// Apply a Content-Security-Policy to the packaged app. Skipped in dev so Vite HMR works.
function applyContentSecurityPolicy(): void {
  if (!app.isPackaged) return;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; " +
            "font-src 'self' data:; " +
            "connect-src 'self'; " +
            "object-src 'none'; " +
            "frame-src 'none'",
        ],
      },
    });
  });
}

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    await loadState();
    registerIpc();
    buildMenu();
    applyAppIcon();
    applyContentSecurityPolicy();
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let isShuttingDown = false;

async function shutdownForQuit(): Promise<void> {
  try {
    await systemProxy?.disable();
  } catch {
    // Never block quit on proxy teardown.
  }
  try {
    if (proxyServer?.isRunning()) {
      await proxyServer.stop();
    }
  } catch {
    // ignore
  }
}

app.on('before-quit', (event) => {
  if (isShuttingDown) return;
  event.preventDefault();
  isShuttingDown = true;
  void shutdownForQuit().finally(() => app.quit());
});
