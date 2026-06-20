export type Protocol = 'http1' | 'http2' | 'connect';

export type InterceptMode = 'rewrite' | 'breakpoint';
export type InterceptPhase = 'request' | 'response';

export interface BodyRef {
  size: number;
  preview?: string;
  encoding?: 'utf8' | 'base64';
  content?: string;
}

export interface HttpMessage {
  method?: string;
  url: string;
  headers: Record<string, string>;
  body?: BodyRef;
}

export interface CaptureEntrySummary {
  id: string;
  startedAt: number;
  durationMs: number;
  method: string;
  url: string;
  host: string;
  path: string;
  status: number;
  tls: boolean;
  protocol: Protocol;
  matchedRuleId?: string;
  fromComposer?: boolean;
  requestBodySize: number;
  responseBodySize: number;
  awaitingBreakpoint?: {
    breakpointId: string;
    phase: InterceptPhase;
    ruleName: string;
  };
}

export interface AutoResponderRule {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  match: {
    urlRegex?: string;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body?: { type: 'inline'; content: string } | { type: 'file'; path: string };
    delayMs?: number;
  };
}

export interface InterceptModifications {
  headers?: Record<string, string>;
  body?: string;
  status?: number;
}

export interface InterceptRule {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  mode: InterceptMode;
  phase: InterceptPhase;
  match: {
    urlRegex?: string;
  };
  request?: InterceptModifications;
  response?: InterceptModifications;
}

export interface BreakpointSnapshot {
  id: string;
  captureId: string;
  startedAt: number;
  ruleId: string;
  ruleName: string;
  phase: InterceptPhase;
  method: string;
  url: string;
  status?: number;
  headers: Record<string, string>;
  body: string;
  modifications?: InterceptModifications;
}

export type BreakpointDecision =
  | { action: 'continue'; modifications?: InterceptModifications }
  | { action: 'abort' };

export interface CaptureEntry extends CaptureEntrySummary {
  client: HttpMessage;
  server: HttpMessage;
}

export interface ComposerRequest {
  id?: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ComposerResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}

export interface ComposedEntry {
  id: string;
  sentAt: number;
  request: ComposerRequest;
  lastStatus?: number;
  lastDurationMs?: number;
}

export type CaptureFilterMode = 'include' | 'exclude';

export interface CaptureFilterSettings {
  mode: CaptureFilterMode;
  /** Semicolon-separated URL patterns, e.g. `*.google.com;*.example.com/api` */
  urls: string;
}

export interface AppSettings {
  port: number;
  ringBufferSize: number;
  maxBodySize: number;
  systemProxyEnabled: boolean;
  proxyRunning: boolean;
  guidedTourCompleted?: boolean;
  captureFilter: CaptureFilterSettings;
}

export interface CertStatus {
  exists: boolean;
  trusted: 'unknown' | 'installed' | 'untrusted';
  caPath?: string;
  commonName?: string;
  /** Whether the local CA certificate is in the login keychain. */
  keychainLocation?: 'none' | 'login';
}

export interface ProxyStatus {
  running: boolean;
  port: number;
  entryCount: number;
  systemProxyEnabled: boolean;
}

export interface SystemProxyState {
  enabled: boolean;
}

export const DEFAULT_CAPTURE_FILTER: CaptureFilterSettings = {
  mode: 'exclude',
  urls: '',
};

export const DEFAULT_SETTINGS: AppSettings = {
  port: 8888,
  ringBufferSize: 10000,
  maxBodySize: 5 * 1024 * 1024,
  systemProxyEnabled: false,
  proxyRunning: false,
  guidedTourCompleted: false,
  captureFilter: DEFAULT_CAPTURE_FILTER,
};

export const IPC_CHANNELS = {
  PROXY_START: 'proxy:start',
  PROXY_STOP: 'proxy:stop',
  PROXY_STATUS: 'proxy:status',
  PROXY_TOGGLE: 'proxy:toggle',
  CAPTURE_LIST: 'capture:list',
  CAPTURE_GET: 'capture:get',
  CAPTURE_CLEAR: 'capture:clear',
  CAPTURE_UPDATED: 'capture:updated',
  CERT_STATUS: 'cert:status',
  CERT_EXPORT: 'cert:export',
  CERT_INSTALL: 'cert:install',
  CERT_OPEN_KEYCHAIN: 'cert:open-keychain',
  CERT_VERIFY: 'cert:verify',
  CERT_UNINSTALL: 'cert:uninstall',
  CERT_RESET: 'cert:reset',
  SYSTEM_PROXY_ENABLE: 'system-proxy:enable',
  SYSTEM_PROXY_DISABLE: 'system-proxy:disable',
  RULES_GET: 'rules:get',
  RULES_SAVE: 'rules:save',
  INTERCEPT_GET: 'intercept:get',
  INTERCEPT_SAVE: 'intercept:save',
  BREAKPOINT_CONTINUE: 'breakpoint:continue',
  BREAKPOINT_ABORT: 'breakpoint:abort',
  BREAKPOINT_HIT: 'breakpoint:hit',
  COMPOSER_SEND: 'composer:send',
  COMPOSER_PARSE_CURL: 'composer:parse-curl',
  COMPOSER_EXPORT_CURL: 'composer:export-curl',
  COMPOSER_COMPOSED_GET: 'composer:composed-get',
  COMPOSER_COMPOSED_SAVE: 'composer:composed-save',
  DIALOG_PICK_FILE: 'dialog:pick-file',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  MENU_ACTION: 'menu:action',
  MCP_INTEGRATION_INSTALL: 'mcp:integration-install',
  MCP_INTEGRATION_VERIFY: 'mcp:integration-verify',
  MCP_INTEGRATION_INSTALL_STEP: 'mcp:integration-install-step',
  DIALOG_PICK_DIRECTORY: 'dialog:pick-directory',
} as const;

export type MenuAction =
  | 'toggle-proxy'
  | 'toggle-system-proxy'
  | 'clear-session'
  | 'focus-search'
  | 'open-composer'
  | 'open-rules'
  | 'install-certificate'
  | 'open-settings';
