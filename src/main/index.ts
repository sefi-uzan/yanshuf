import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import type {
  AppSettings,
  AutoResponderRule,
  ComposedEntry,
  ComposerCollection,
  ComposerEnvironment,
  ComposerRequest,
  ComposerSettings,
  MenuAction,
} from '../shared/types';
import { DEFAULT_COMPOSER_SETTINGS, DEFAULT_CAPTURE_FILTER, DEFAULT_SETTINGS, IPC_CHANNELS } from '../shared/types';
import { shouldCaptureUrl } from '../shared/url-filter';
import { substituteVariables } from '../shared/utils';
import { AutoResponderEngine } from './auto-responder/engine';
import { CertificateManager } from './cert/manager';
import { assertCertTrusted, rethrowCertIpcError } from './cert/cert-gate';
import { ComposerService, parseCurl } from './composer/service';
import { exportCurl } from '../shared/composer-curl';
import { CaptureStore } from './proxy/capture-store';
import { ProxyServer } from './proxy/server';
import { JsonFileStore } from './storage/json-store';
import { SystemProxyManager } from './system-proxy/macos';

if (started) {
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

  if (settings.proxyRunning) {
    try {
      await assertCertTrusted(certManager);
      await proxyServer.start();
    } catch {
      settings.proxyRunning = false;
      await saveSettings();
    }
  }

  if (settings.systemProxyEnabled) {
    try {
      await assertCertTrusted(certManager);
      await systemProxy.enable('127.0.0.1', settings.port);
    } catch {
      settings.systemProxyEnabled = false;
      await saveSettings();
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

function broadcastCaptureUpdate(): void {
  mainWindow?.webContents.send(IPC_CHANNELS.CAPTURE_UPDATED, captureStore.list());
}

function tagComposerCaptures(
  beforeIds: Set<string>,
  req: ComposerRequest,
  vars: Record<string, string>,
): void {
  const method = req.method.toUpperCase();
  const url = substituteVariables(req.url, vars);
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
          label: 'Start Capture',
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
    broadcastCaptureUpdate();
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
    await saveSettings();
    return getProxyStatus();
  });

  ipcMain.handle(IPC_CHANNELS.RULES_GET, () => autoResponder.getRules());

  ipcMain.handle(IPC_CHANNELS.RULES_SAVE, async (_e, rules: AutoResponderRule[]) => {
    autoResponder.setRules(rules);
    await store.write('rules.json', rules);
    return rules;
  });

  ipcMain.handle(IPC_CHANNELS.COMPOSER_SEND, async (_e, req: ComposerRequest, vars: Record<string, string>) => {
    try {
      if (!proxyServer.isRunning()) {
        await assertCertTrusted(certManager);
        await proxyServer.start();
        settings.proxyRunning = true;
        await saveSettings();
      }
      const beforeIds = new Set(captureStore.list().map((entry) => entry.id));
      const caCertPath = path.join(certManager.getSslCaDir(), 'certs', 'ca.pem');
      const response = await composerService.send(req, vars, { proxyPort: settings.port, caCertPath });
      tagComposerCaptures(beforeIds, req, vars);
      broadcastCaptureUpdate();
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

  ipcMain.handle(IPC_CHANNELS.COMPOSER_ENVIRONMENTS_GET, () =>
    store.read<ComposerEnvironment[]>('composer/environments.json', [
      { id: 'default', name: 'Default', variables: {} },
    ]),
  );

  ipcMain.handle(IPC_CHANNELS.COMPOSER_ENVIRONMENTS_SAVE, (_e, envs: ComposerEnvironment[]) =>
    store.write('composer/environments.json', envs),
  );

  ipcMain.handle(IPC_CHANNELS.COMPOSER_COMPOSED_GET, () =>
    store.read<ComposedEntry[]>('composer/composed.json', []),
  );

  ipcMain.handle(IPC_CHANNELS.COMPOSER_COMPOSED_SAVE, (_e, entries: ComposedEntry[]) =>
    store.write('composer/composed.json', entries),
  );

  ipcMain.handle(IPC_CHANNELS.COMPOSER_SETTINGS_GET, () =>
    store.read<ComposerSettings>('composer/settings.json', DEFAULT_COMPOSER_SETTINGS),
  );

  ipcMain.handle(IPC_CHANNELS.COMPOSER_SETTINGS_SAVE, (_e, settings: ComposerSettings) =>
    store.write('composer/settings.json', settings),
  );

  ipcMain.handle(IPC_CHANNELS.DIALOG_PICK_FILE, async (_e, options?: { title?: string }) => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const result = await dialog.showOpenDialog(win ?? undefined, {
      properties: ['openFile'],
      title: options?.title ?? 'Select file',
    });
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

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

app.whenReady().then(async () => {
  await loadState();
  registerIpc();
  buildMenu();
  applyAppIcon();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

let isShuttingDown = false;

async function shutdownForQuit(): Promise<void> {
  await systemProxy.disable();
  if (proxyServer?.isRunning()) {
    await proxyServer.stop();
  }
}

app.on('before-quit', (event) => {
  if (isShuttingDown) return;
  event.preventDefault();
  isShuttingDown = true;
  void shutdownForQuit().then(() => app.quit());
});
