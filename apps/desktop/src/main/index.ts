import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, session, shell } from 'electron';
import path from 'node:path';
import type {
  AppSettings,
  AutoResponderRule,
  BreakpointSnapshot,
  CaptureFilterApplyAction,
  ComposedEntry,
  ComposerRequest,
  InterceptModifications,
  InterceptRule,
  MapRemoteRule,
  MenuAction,
  ThrottleSetPatch,
} from '@yanshuf/shared';
import {
  DEFAULT_CAPTURE_FILTER,
  DEFAULT_THROTTLE,
  IPC_CHANNELS,
  exportCurl,
  addHostToCaptureFilter,
  mergeThrottleSettings,
  normalizeAppSettings,
  shouldRecordCapture,
} from '@yanshuf/shared';
import { CaptureController } from './capture-controller';
import { AutoResponderEngine } from './auto-responder/engine';
import { BreakpointManager } from './intercept/breakpoint-manager';
import { InterceptEngine } from './intercept/engine';
import { MapRemoteEngine } from './map-remote/engine';
import { bindNotifyWindow, notifyRenderer } from './notify-renderer';
import { CertificateManager } from './cert/manager';
import { assertCertTrusted, rethrowCertIpcError } from './cert/cert-gate';
import { ComposerService, parseCurl } from './composer/service';
import { CaptureStore } from './proxy/capture-store';
import { ProxyServer } from './proxy/server';
import { ThrottleController, toThrottleConfig } from './proxy/throttle';
import { JsonFileStore } from './storage/json-store';
import { SystemProxyManager } from './system-proxy/macos';
import { ensureMcpAuth, getMcpDataDir } from './mcp-api/auth';
import { createMcpHandlers } from './mcp-api/create-handlers';
import { McpApiServer } from './mcp-api/server';
import { McpWaitQueue } from './mcp-api/wait-queue';
import {
  installIntegration,
  verifyIntegration,
  installMcpEntry,
  installSkill,
  installSessionEndHook,
  type IntegrationClient,
} from './mcp-api/integration';
import { checkPrerequisites } from './mcp-api/integration-prerequisites';
import {
  createIntegrationRegistry,
  type IntegrationRegistryService,
} from './mcp-api/integration-registry';
import type { IntegrationUninstallPayload, IntegrationVerifyParams, SkillInstallTarget } from '@yanshuf/shared';
import { augmentProcessPath } from './shell-path';

augmentProcessPath();

function installProcessErrorHandlers(): void {
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    notifyRenderer({
      title: 'Something went wrong',
      description: err.message,
      variant: 'error',
    });
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
    const description = reason instanceof Error ? reason.message : String(reason);
    notifyRenderer({
      title: 'Something went wrong',
      description,
      variant: 'error',
    });
  });
}

installProcessErrorHandlers();
bindNotifyWindow(() => mainWindow);

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
let interceptEngine: InterceptEngine;
let mapRemoteEngine: MapRemoteEngine;
let breakpointManager: BreakpointManager;
let proxyServer: ProxyServer;
let throttleController: ThrottleController;
let certManager: CertificateManager;
let systemProxy: SystemProxyManager;
let captureController: CaptureController;
let composerService: ComposerService;
let mcpWaitQueue: McpWaitQueue;
let mcpApiServer: McpApiServer | null = null;
let mcpApiPort = 9473;
let integrationRegistry: IntegrationRegistryService;

async function checkMcpApiReachable(): Promise<boolean> {
  try {
    const { token } = await ensureMcpAuth(app.getPath('userData'));
    const res = await fetch(`http://127.0.0.1:${mcpApiPort}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

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

function buildShouldCapture(): (url: string, host: string) => boolean {
  return (url, host) =>
    shouldRecordCapture(url, host, settings.captureFilter ?? DEFAULT_CAPTURE_FILTER, {
      captureLocalhost: settings.captureLocalhost ?? false,
      proxyPort: settings.port,
      mcpApiPort,
    });
}

function applyThrottleFromSettings(): void {
  throttleController.update(toThrottleConfig(settings.throttle));
  proxyServer?.updateOptions({ throttle: throttleController });
}

function mergeAndApplyThrottle(patch: ThrottleSetPatch | null): void {
  settings.throttle = mergeThrottleSettings(settings.throttle, patch);
  applyThrottleFromSettings();
}

async function loadState(): Promise<void> {
  store = new JsonFileStore(path.join(app.getPath('userData'), 'data'));
  await store.init();
  integrationRegistry = createIntegrationRegistry(store);

  const stored = await store.read<Partial<AppSettings>>('settings.json', {});
  settings = normalizeAppSettings(stored);
  captureStore = new CaptureStore(settings.ringBufferSize);
  autoResponder = new AutoResponderEngine();
  const rules = await store.read<AutoResponderRule[]>('rules.json', []);
  autoResponder.setRules(rules);

  interceptEngine = new InterceptEngine();
  const interceptRules = await store.read<InterceptRule[]>('intercept.json', []);
  interceptEngine.setRules(interceptRules);

  mapRemoteEngine = new MapRemoteEngine();
  const mapRemoteRules = await store.read<MapRemoteRule[]>('map-remote.json', []);
  mapRemoteEngine.setRules(mapRemoteRules);

  breakpointManager = new BreakpointManager();
  composerService = new ComposerService();
  mcpWaitQueue = new McpWaitQueue();

  breakpointManager.on('hit', (snapshot: BreakpointSnapshot) => {
    broadcastCaptureUpdate(true);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.BREAKPOINT_HIT, snapshot);
    }
    mcpWaitQueue.notifyBreakpoint(snapshot);
  });

  certManager = new CertificateManager(store.getCertsDir());
  await certManager.ensureCaGenerated();
  systemProxy = new SystemProxyManager();
  throttleController = new ThrottleController(toThrottleConfig(settings.throttle));

  proxyServer = new ProxyServer({
    port: settings.port,
    host: '127.0.0.1',
    sslCaDir: store.getCertsDir(),
    maxBodySize: settings.maxBodySize,
    captureStore,
    autoResponder,
    interceptEngine,
    mapRemoteEngine,
    breakpointManager,
    shouldCapture: buildShouldCapture(),
    throttle: throttleController,
  });

  proxyServer.on('capture', (entry) => {
    broadcastCaptureUpdate();
    const latest = entry ?? captureStore.list().at(-1);
    if (latest) mcpWaitQueue.notifyCapture(latest);
  });

  proxyServer.on('hidden', () => {
    broadcastProxyStatus();
  });

  proxyServer.on('notify', (message: string) => {
    notifyRenderer({ title: 'Proxy error', description: message, variant: 'error' });
  });

  captureController = new CaptureController({
    settings,
    saveSettings,
    systemProxy,
    proxyServer,
    certManager,
    captureStore,
  });

  await captureController.restoreOnLaunch();
}

async function saveSettings(): Promise<void> {
  await store.write('settings.json', settings);
}

function getProxyStatus() {
  return captureController.getStatus();
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

const PROXY_STATUS_BROADCAST_INTERVAL_MS = 120;
let proxyStatusBroadcastTimer: ReturnType<typeof setTimeout> | null = null;

function flushProxyStatus(): void {
  proxyStatusBroadcastTimer = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.PROXY_STATUS_UPDATED, getProxyStatus());
  }
}

function broadcastProxyStatus(immediate = false): void {
  if (immediate) {
    if (proxyStatusBroadcastTimer) {
      clearTimeout(proxyStatusBroadcastTimer);
      proxyStatusBroadcastTimer = null;
    }
    flushProxyStatus();
    return;
  }
  if (proxyStatusBroadcastTimer) return;
  proxyStatusBroadcastTimer = setTimeout(flushProxyStatus, PROXY_STATUS_BROADCAST_INTERVAL_MS);
}

function applyCaptureFilterSettings(nextFilter: typeof DEFAULT_CAPTURE_FILTER): void {
  settings = {
    ...settings,
    captureFilter: nextFilter,
  };
  proxyServer.updateOptions({ shouldCapture: buildShouldCapture() });
  proxyServer.resetHiddenCount();
  captureStore.clear();
  broadcastCaptureUpdate(true);
  broadcastProxyStatus(true);
}

async function applyCaptureFilterAction(action: CaptureFilterApplyAction): Promise<void> {
  const current = settings.captureFilter ?? DEFAULT_CAPTURE_FILTER;
  let next = current;

  switch (action.type) {
    case 'addHost':
      next = addHostToCaptureFilter(current, action.host);
      break;
    case 'clear':
      next = { ...DEFAULT_CAPTURE_FILTER };
      break;
  }

  applyCaptureFilterSettings(next);
  await saveSettings();
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

async function startMcpApi(userDataPath: string): Promise<void> {
  const { token, config } = await ensureMcpAuth(userDataPath);
  const handlers = createMcpHandlers({
    settings,
    saveSettings,
    captureStore,
    autoResponder,
    interceptEngine,
    mapRemoteEngine,
    breakpointManager,
    proxyServer,
    certManager,
    captureController,
    composerService,
    store,
    waitQueue: mcpWaitQueue,
    mcpApiPort: config.port,
    broadcastCaptureUpdate,
    tagComposerCaptures,
    mergeAndApplyThrottle,
  });

  mcpApiServer = new McpApiServer(token, handlers);
  mcpApiPort = await mcpApiServer.start(config.port);
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PROXY_START, async () => {
    try {
      await captureController.setCapturing(true);
      return getProxyStatus();
    } catch (err) {
      rethrowCertIpcError(err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_STOP, async () => {
    await captureController.setCapturing(false);
    return getProxyStatus();
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_TOGGLE, async () => {
    try {
      await captureController.toggle();
      return getProxyStatus();
    } catch (err) {
      rethrowCertIpcError(err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROXY_STATUS, () => getProxyStatus());

  ipcMain.handle(IPC_CHANNELS.PROXY_THROTTLE_SET, async (_e, patch: ThrottleSetPatch | null) => {
    mergeAndApplyThrottle(patch);
    await saveSettings();
    return getProxyStatus();
  });

  ipcMain.handle(IPC_CHANNELS.CAPTURE_LIST, () => captureStore.list());

  ipcMain.handle(IPC_CHANNELS.CAPTURE_GET, (_e, id: string) => captureStore.get(id));

  ipcMain.handle(IPC_CHANNELS.CAPTURE_CLEAR, () => {
    captureStore.clear();
    proxyServer.resetHiddenCount();
    broadcastCaptureUpdate(true);
    broadcastProxyStatus(true);
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.CAPTURE_FILTER_APPLY, async (_e, action: CaptureFilterApplyAction) => {
    await applyCaptureFilterAction(action);
    return getProxyStatus();
  });

  ipcMain.handle(IPC_CHANNELS.CERT_STATUS, () => certManager.getStatus());

  ipcMain.handle(IPC_CHANNELS.CERT_EXPORT, () => certManager.exportCertificate());

  ipcMain.handle(IPC_CHANNELS.CERT_INSTALL, () => certManager.installToLoginKeychain());

  ipcMain.handle(IPC_CHANNELS.CERT_OPEN_KEYCHAIN, () => certManager.openKeychainAccess());

  ipcMain.handle(IPC_CHANNELS.CERT_VERIFY, () => certManager.verifyTrust());

  ipcMain.handle(IPC_CHANNELS.CERT_UNINSTALL, () => certManager.uninstallFromKeychain());

  ipcMain.handle(IPC_CHANNELS.CERT_RESET, async () => {
    await captureController.setCapturing(false);
    return certManager.resetCa();
  });

  ipcMain.handle(IPC_CHANNELS.RULES_GET, () => autoResponder.getRules());

  ipcMain.handle(IPC_CHANNELS.RULES_SAVE, async (_e, rules: AutoResponderRule[]) => {
    autoResponder.setRules(rules);
    await store.write('rules.json', rules);
    return rules;
  });

  ipcMain.handle(IPC_CHANNELS.INTERCEPT_GET, () => interceptEngine.getRules());

  ipcMain.handle(IPC_CHANNELS.INTERCEPT_SAVE, async (_e, rules: InterceptRule[]) => {
    interceptEngine.setRules(rules);
    await store.write('intercept.json', rules);
    return rules;
  });

  ipcMain.handle(IPC_CHANNELS.MAP_REMOTE_GET, () => mapRemoteEngine.getRules());

  ipcMain.handle(IPC_CHANNELS.MAP_REMOTE_SAVE, async (_e, rules: MapRemoteRule[]) => {
    mapRemoteEngine.setRules(rules);
    await store.write('map-remote.json', rules);
    return rules;
  });

  ipcMain.handle(
    IPC_CHANNELS.BREAKPOINT_CONTINUE,
    (_e, id: string, modifications?: InterceptModifications) => {
      breakpointManager.continue(id, modifications);
    },
  );

  ipcMain.handle(IPC_CHANNELS.BREAKPOINT_ABORT, (_e, id: string) => {
    breakpointManager.abort(id);
  });

  ipcMain.handle(IPC_CHANNELS.COMPOSER_SEND, async (_e, req: ComposerRequest) => {
    try {
      return await captureController.withProxyServer(async () => {
        const beforeIds = new Set(captureStore.list().map((entry) => entry.id));
        const caCertPath = path.join(certManager.getSslCaDir(), 'certs', 'ca.pem');
        const response = await composerService.send(req, { proxyPort: settings.port, caCertPath });
        tagComposerCaptures(beforeIds, req);
        broadcastCaptureUpdate(true);
        return response;
      });
    } catch (err) {
      rethrowCertIpcError(err);
    }
  });

  ipcMain.handle(IPC_CHANNELS.COMPOSER_PARSE_CURL, (_e, curl: string) => parseCurl(curl));

  ipcMain.handle(IPC_CHANNELS.COMPOSER_EXPORT_CURL, (_e, req: ComposerRequest) => exportCurl(req));

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
    const prevPort = settings.port;
    const prevCaptureLocalhost = settings.captureLocalhost;
    const prevFilter = settings.captureFilter ?? DEFAULT_CAPTURE_FILTER;
    settings = {
      ...next,
      captureFilter: {
        ...DEFAULT_CAPTURE_FILTER,
        ...next.captureFilter,
      },
      throttle: {
        ...DEFAULT_THROTTLE,
        ...next.throttle,
      },
      captureLocalhost: next.captureLocalhost ?? false,
    };
    captureStore.setMaxSize(settings.ringBufferSize);
    applyThrottleFromSettings();
    proxyServer.updateOptions({
      port: settings.port,
      maxBodySize: settings.maxBodySize,
      shouldCapture: buildShouldCapture(),
    });

    const filtersChanged =
      prevFilter.mode !== settings.captureFilter.mode ||
      prevFilter.urls !== settings.captureFilter.urls;
    if (filtersChanged) {
      proxyServer.resetHiddenCount();
      captureStore.clear();
      broadcastCaptureUpdate(true);
    }
    broadcastProxyStatus(true);

    if (settings.captureLocalhost !== prevCaptureLocalhost) {
      await captureController.updateCaptureLocalhost();
    }

    if (settings.port !== prevPort) {
      await captureController.applyPortChange();
    }

    await saveSettings();
    return settings;
  });

  ipcMain.handle(
    IPC_CHANNELS.MCP_INTEGRATION_INSTALL,
    async (_e, client: IntegrationClient, target: SkillInstallTarget) =>
      installIntegration(client, target),
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_INTEGRATION_INSTALL_STEP,
    async (
      _e,
      step: 'mcp' | 'skill' | 'hook',
      client: IntegrationClient,
      target?: SkillInstallTarget,
    ) => {
      if (step === 'mcp') return installMcpEntry(client);
      if (step === 'skill') {
        if (!target) throw new Error('Skill install target is required');
        return installSkill(client, target);
      }
      return installSessionEndHook(client);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_INTEGRATION_VERIFY,
    async (_e, client: IntegrationClient, params: IntegrationVerifyParams) => {
      const certResult = await certManager.verifyTrust();
      const apiReachable = await checkMcpApiReachable();
      return verifyIntegration(client, params, apiReachable, certResult.trusted);
    },
  );

  ipcMain.handle(IPC_CHANNELS.MCP_INTEGRATION_PREREQUISITES, async () => {
    const certResult = await certManager.verifyTrust();
    return checkPrerequisites(certResult.trusted);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_INTEGRATION_STATUS, async () => {
    const certResult = await certManager.verifyTrust();
    const apiReachable = await checkMcpApiReachable();
    return integrationRegistry.getStatus(certResult.trusted, apiReachable);
  });

  ipcMain.handle(IPC_CHANNELS.MCP_INTEGRATION_REGISTRY_GET, () =>
    integrationRegistry.loadRegistry(),
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_INTEGRATION_RECORD,
    async (
      _e,
      client: IntegrationClient,
      targets: SkillInstallTarget[],
      verifyOk: boolean,
    ) => integrationRegistry.recordInstall(client, targets, verifyOk),
  );

  ipcMain.handle(
    IPC_CHANNELS.MCP_INTEGRATION_UPDATE,
    async (_e, payload?: { recordIds?: string[]; client?: IntegrationClient }) =>
      integrationRegistry.updateAllInstalls(payload ?? {}),
  );

  ipcMain.handle(IPC_CHANNELS.MCP_INTEGRATION_REMOVE, async (_e, recordId: string) => {
    await integrationRegistry.removeInstall(recordId);
  });

  ipcMain.handle(
    IPC_CHANNELS.MCP_INTEGRATION_UNINSTALL,
    async (_e, payload: IntegrationUninstallPayload) => integrationRegistry.uninstall(payload),
  );

  ipcMain.handle(IPC_CHANNELS.MCP_INTEGRATION_DISMISS_PROMPT, async () => {
    await integrationRegistry.dismissPostCertPrompt();
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_PICK_DIRECTORY, async (_e, options?: { title?: string }) => {
    const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: options?.title ?? 'Select repository folder',
    };
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
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
    await startMcpApi(app.getPath('userData'));
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
    await mcpApiServer?.stop();
  } catch {
    // ignore
  }
  mcpWaitQueue?.clear();
  try {
    await captureController?.shutdown();
  } catch {
    // Never block quit on proxy teardown.
  }
}

app.on('before-quit', (event) => {
  if (isShuttingDown) return;
  event.preventDefault();
  isShuttingDown = true;
  void shutdownForQuit().finally(() => app.quit());
});
