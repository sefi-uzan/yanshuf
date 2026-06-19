import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  AutoResponderRule,
  CaptureEntry,
  CaptureEntrySummary,
  CertStatus,
  ComposedEntry,
  ComposerCollection,
  ComposerEnvironment,
  ComposerRequest,
  ComposerResponse,
  ComposerSettings,
  MenuAction,
  ProxyStatus,
} from '../shared/types';
import { IPC_CHANNELS } from '../shared/types';

export interface YanshufAPI {
  proxy: {
    start: () => Promise<ProxyStatus>;
    stop: () => Promise<ProxyStatus>;
    status: () => Promise<ProxyStatus>;
  };
  capture: {
    list: () => Promise<CaptureEntrySummary[]>;
    get: (id: string) => Promise<CaptureEntry | undefined>;
    clear: () => Promise<CaptureEntrySummary[]>;
    onUpdated: (callback: (entries: CaptureEntrySummary[]) => void) => () => void;
  };
  cert: {
    status: () => Promise<CertStatus>;
    export: () => Promise<string>;
    install: () => Promise<{ alreadyInstalled: boolean; needsManualTrust: boolean }>;
    openKeychain: () => Promise<void>;
    verify: () => Promise<{ trusted: boolean; error?: string }>;
  };
  systemProxy: {
    enable: () => Promise<ProxyStatus>;
    disable: () => Promise<ProxyStatus>;
  };
  rules: {
    get: () => Promise<AutoResponderRule[]>;
    save: (rules: AutoResponderRule[]) => Promise<AutoResponderRule[]>;
  };
  composer: {
    send: (req: ComposerRequest, vars: Record<string, string>) => Promise<ComposerResponse>;
    parseCurl: (curl: string) => Promise<ComposerRequest>;
    exportCurl: (req: ComposerRequest) => Promise<string>;
    getCollections: () => Promise<ComposerCollection[]>;
    saveCollections: (collections: ComposerCollection[]) => Promise<void>;
    getEnvironments: () => Promise<ComposerEnvironment[]>;
    saveEnvironments: (envs: ComposerEnvironment[]) => Promise<void>;
    getComposed: () => Promise<ComposedEntry[]>;
    saveComposed: (entries: ComposedEntry[]) => Promise<void>;
    getSettings: () => Promise<ComposerSettings>;
    saveSettings: (settings: ComposerSettings) => Promise<void>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    save: (settings: AppSettings) => Promise<AppSettings>;
  };
  dialog: {
    pickFile: (options?: { title?: string }) => Promise<string | null>;
  };
  menu: {
    onAction: (callback: (action: MenuAction) => void) => () => void;
  };
}

const api: YanshufAPI = {
  proxy: {
    start: () => ipcRenderer.invoke(IPC_CHANNELS.PROXY_START),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.PROXY_STOP),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.PROXY_STATUS),
  },
  capture: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_LIST),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_GET, id),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_CLEAR),
    onUpdated: (callback) => {
      const handler = (_: Electron.IpcRendererEvent, entries: CaptureEntrySummary[]) => callback(entries);
      ipcRenderer.on(IPC_CHANNELS.CAPTURE_UPDATED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CAPTURE_UPDATED, handler);
    },
  },
  cert: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.CERT_STATUS),
    verify: () => ipcRenderer.invoke(IPC_CHANNELS.CERT_VERIFY),
    export: () => ipcRenderer.invoke(IPC_CHANNELS.CERT_EXPORT),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.CERT_INSTALL),
    openKeychain: () => ipcRenderer.invoke(IPC_CHANNELS.CERT_OPEN_KEYCHAIN),
  },
  systemProxy: {
    enable: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PROXY_ENABLE),
    disable: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PROXY_DISABLE),
  },
  rules: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.RULES_GET),
    save: (rules) => ipcRenderer.invoke(IPC_CHANNELS.RULES_SAVE, rules),
  },
  composer: {
    send: (req, vars) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_SEND, req, vars),
    parseCurl: (curl) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_PARSE_CURL, curl),
    exportCurl: (req) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_EXPORT_CURL, req),
    getCollections: () => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_COLLECTIONS_GET),
    saveCollections: (collections) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_COLLECTIONS_SAVE, collections),
    getEnvironments: () => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_ENVIRONMENTS_GET),
    saveEnvironments: (envs) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_ENVIRONMENTS_SAVE, envs),
    getComposed: () => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_COMPOSED_GET),
    saveComposed: (entries) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_COMPOSED_SAVE, entries),
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_SETTINGS_GET),
    saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_SETTINGS_SAVE, settings),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    save: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
  },
  dialog: {
    pickFile: (options) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_PICK_FILE, options),
  },
  menu: {
    onAction: (callback) => {
      const handler = (_: Electron.IpcRendererEvent, action: MenuAction) => callback(action);
      ipcRenderer.on(IPC_CHANNELS.MENU_ACTION, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_ACTION, handler);
    },
  },
};

contextBridge.exposeInMainWorld('yanshuf', api);

declare global {
  interface Window {
    yanshuf: YanshufAPI;
  }
}
