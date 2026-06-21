import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSettings,
  AutoResponderRule,
  CaptureEntry,
  CaptureEntrySummary,
  CertStatus,
  BreakpointSnapshot,
  ComposedEntry,
  ComposerRequest,
  ComposerResponse,
  InterceptModifications,
  InterceptRule,
  MapRemoteRule,
  IntegrationClient,
  IntegrationPrerequisites,
  IntegrationRegistry,
  IntegrationStatusResult,
  IntegrationUninstallPayload,
  IntegrationUninstallResult,
  IntegrationVerifyParams,
  IntegrationVerifyResult,
  MenuAction,
  ProxyStatus,
  SkillInstallTarget,
} from '@yanshuf/shared';
import { IPC_CHANNELS } from '@yanshuf/shared';

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
    uninstall: () => Promise<void>;
    reset: () => Promise<CertStatus>;
  };
  systemProxy: {
    enable: () => Promise<ProxyStatus>;
    disable: () => Promise<ProxyStatus>;
  };
  rules: {
    get: () => Promise<AutoResponderRule[]>;
    save: (rules: AutoResponderRule[]) => Promise<AutoResponderRule[]>;
  };
  intercept: {
    getRules: () => Promise<InterceptRule[]>;
    saveRules: (rules: InterceptRule[]) => Promise<InterceptRule[]>;
    onBreakpoint: (callback: (snapshot: BreakpointSnapshot) => void) => () => void;
    continueBreakpoint: (id: string, modifications?: InterceptModifications) => Promise<void>;
    abortBreakpoint: (id: string) => Promise<void>;
  };
  mapRemote: {
    get: () => Promise<MapRemoteRule[]>;
    save: (rules: MapRemoteRule[]) => Promise<MapRemoteRule[]>;
  };
  composer: {
    send: (req: ComposerRequest) => Promise<ComposerResponse>;
    parseCurl: (curl: string) => Promise<ComposerRequest>;
    exportCurl: (req: ComposerRequest) => Promise<string>;
    getComposed: () => Promise<ComposedEntry[]>;
    saveComposed: (entries: ComposedEntry[]) => Promise<void>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    save: (settings: AppSettings) => Promise<AppSettings>;
  };
  dialog: {
    pickFile: (options?: { title?: string }) => Promise<string | null>;
    pickDirectory: (options?: { title?: string }) => Promise<string | null>;
  };
  integration: {
    install: (
      client: IntegrationClient,
      target: SkillInstallTarget,
    ) => Promise<{
      mcp: { ok: boolean; message: string; path?: string };
      skill: { ok: boolean; message: string; path?: string };
      hook: { ok: boolean; message: string; path?: string };
    }>;
    installStep: (
      step: 'mcp' | 'skill' | 'hook',
      client: IntegrationClient,
      target?: SkillInstallTarget,
    ) => Promise<{ ok: boolean; message: string; path?: string }>;
    verify: (
      client: IntegrationClient,
      params: IntegrationVerifyParams,
    ) => Promise<IntegrationVerifyResult>;
    prerequisites: () => Promise<IntegrationPrerequisites>;
    status: () => Promise<IntegrationStatusResult>;
    getRegistry: () => Promise<IntegrationRegistry>;
    record: (
      client: IntegrationClient,
      targets: SkillInstallTarget[],
      verifyOk: boolean,
    ) => Promise<unknown>;
    update: (payload?: { recordIds?: string[]; client?: IntegrationClient }) => Promise<{
      ok: boolean;
      results: { id: string; ok: boolean; message: string }[];
    }>;
    uninstall: (payload: IntegrationUninstallPayload) => Promise<IntegrationUninstallResult>;
    remove: (recordId: string) => Promise<void>;
    dismissPostCertPrompt: () => Promise<void>;
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
    uninstall: () => ipcRenderer.invoke(IPC_CHANNELS.CERT_UNINSTALL),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.CERT_RESET),
  },
  systemProxy: {
    enable: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PROXY_ENABLE),
    disable: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_PROXY_DISABLE),
  },
  rules: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.RULES_GET),
    save: (rules) => ipcRenderer.invoke(IPC_CHANNELS.RULES_SAVE, rules),
  },
  intercept: {
    getRules: () => ipcRenderer.invoke(IPC_CHANNELS.INTERCEPT_GET),
    saveRules: (rules) => ipcRenderer.invoke(IPC_CHANNELS.INTERCEPT_SAVE, rules),
    onBreakpoint: (callback) => {
      const handler = (_: Electron.IpcRendererEvent, snapshot: BreakpointSnapshot) => callback(snapshot);
      ipcRenderer.on(IPC_CHANNELS.BREAKPOINT_HIT, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.BREAKPOINT_HIT, handler);
    },
    continueBreakpoint: (id, modifications) =>
      ipcRenderer.invoke(IPC_CHANNELS.BREAKPOINT_CONTINUE, id, modifications),
    abortBreakpoint: (id) => ipcRenderer.invoke(IPC_CHANNELS.BREAKPOINT_ABORT, id),
  },
  mapRemote: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.MAP_REMOTE_GET),
    save: (rules) => ipcRenderer.invoke(IPC_CHANNELS.MAP_REMOTE_SAVE, rules),
  },
  composer: {
    send: (req) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_SEND, req),
    parseCurl: (curl) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_PARSE_CURL, curl),
    exportCurl: (req) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_EXPORT_CURL, req),
    getComposed: () => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_COMPOSED_GET),
    saveComposed: (entries) => ipcRenderer.invoke(IPC_CHANNELS.COMPOSER_COMPOSED_SAVE, entries),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    save: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
  },
  dialog: {
    pickFile: (options) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_PICK_FILE, options),
    pickDirectory: (options) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_PICK_DIRECTORY, options),
  },
  integration: {
    install: (client, target) => ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_INSTALL, client, target),
    installStep: (step, client, target) =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_INSTALL_STEP, step, client, target),
    verify: (client, params) => ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_VERIFY, client, params),
    prerequisites: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_PREREQUISITES),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_STATUS),
    getRegistry: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_REGISTRY_GET),
    record: (client, targets, verifyOk) =>
      ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_RECORD, client, targets, verifyOk),
    update: (payload) => ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_UPDATE, payload),
    uninstall: (payload) => ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_UNINSTALL, payload),
    remove: (recordId) => ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_REMOVE, recordId),
    dismissPostCertPrompt: () => ipcRenderer.invoke(IPC_CHANNELS.MCP_INTEGRATION_DISMISS_PROMPT),
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
