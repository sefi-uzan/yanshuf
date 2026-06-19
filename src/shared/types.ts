export type Protocol = 'http1' | 'http2' | 'connect';

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
  requestBodySize: number;
  responseBodySize: number;
}

export interface CaptureEntry extends CaptureEntrySummary {
  client: HttpMessage;
  server: HttpMessage;
}

export interface AutoResponderRule {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  match: {
    urlRegex?: string;
    method?: string;
    headerRegex?: { name: string; pattern: string }[];
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body?: { type: 'inline'; content: string } | { type: 'file'; path: string };
    delayMs?: number;
  };
}

export interface ComposerRequest {
  id?: string;
  name?: string;
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

export interface ComposerCollection {
  id: string;
  name: string;
  requests: ComposerRequest[];
}

export interface ComposerEnvironment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

export interface ComposedEntry {
  id: string;
  sentAt: number;
  name: string;
  request: ComposerRequest;
  lastStatus?: number;
  lastDurationMs?: number;
}

export interface ComposerSettings {
  activeEnvironmentId: string;
}

export const DEFAULT_COMPOSER_SETTINGS: ComposerSettings = {
  activeEnvironmentId: 'default',
};

export interface AppSettings {
  port: number;
  ringBufferSize: number;
  maxBodySize: number;
  systemProxyEnabled: boolean;
  proxyRunning: boolean;
}

export interface CertStatus {
  exists: boolean;
  trusted: 'unknown' | 'installed' | 'untrusted';
  caPath?: string;
}

export interface ProxyStatus {
  running: boolean;
  port: number;
  entryCount: number;
  systemProxyEnabled: boolean;
}

export interface SystemProxyState {
  enabled: boolean;
  previousSettings?: {
    webProxy: string;
    secureWebProxy: string;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  port: 8888,
  ringBufferSize: 10000,
  maxBodySize: 5 * 1024 * 1024,
  systemProxyEnabled: false,
  proxyRunning: false,
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
  SYSTEM_PROXY_ENABLE: 'system-proxy:enable',
  SYSTEM_PROXY_DISABLE: 'system-proxy:disable',
  RULES_GET: 'rules:get',
  RULES_SAVE: 'rules:save',
  COMPOSER_SEND: 'composer:send',
  COMPOSER_PARSE_CURL: 'composer:parse-curl',
  COMPOSER_EXPORT_CURL: 'composer:export-curl',
  COMPOSER_COLLECTIONS_GET: 'composer:collections-get',
  COMPOSER_COLLECTIONS_SAVE: 'composer:collections-save',
  COMPOSER_ENVIRONMENTS_GET: 'composer:environments-get',
  COMPOSER_ENVIRONMENTS_SAVE: 'composer:environments-save',
  COMPOSER_COMPOSED_GET: 'composer:composed-get',
  COMPOSER_COMPOSED_SAVE: 'composer:composed-save',
  COMPOSER_SETTINGS_GET: 'composer:settings-get',
  COMPOSER_SETTINGS_SAVE: 'composer:settings-save',
  DIALOG_PICK_FILE: 'dialog:pick-file',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  MENU_ACTION: 'menu:action',
} as const;

export type MenuAction =
  | 'toggle-proxy'
  | 'toggle-system-proxy'
  | 'clear-session'
  | 'focus-search'
  | 'open-composer'
  | 'replay-to-composer'
  | 'install-certificate';
