import type {
  AutoResponderRule,
  CaptureEntry,
  CaptureEntrySummary,
  ComposerRequest,
  ComposerResponse,
  InterceptModifications,
  InterceptRule,
} from './types';

export const MCP_DEFAULT_PORT = 9473;
export const MCP_CAPTURE_SEARCH_MAX_LIMIT = 100;
export const MCP_WAIT_DEFAULT_TIMEOUT_MS = 30_000;
export const MCP_WAIT_MAX_TIMEOUT_MS = 120_000;

export interface McpConfig {
  port: number;
}

export interface McpTokenFile {
  token: string;
}

export interface YanshufStatus {
  capturing: boolean;
  port: number;
  entryCount: number;
  certTrusted: boolean;
  mcpApiPort: number;
}

export interface CaptureClearResult {
  entryCount: number;
}

export interface CaptureSearchParams {
  query?: string;
  url?: string;
  host?: string;
  method?: string;
  status?: string;
  limit?: number;
}

export interface CaptureWaitParams extends CaptureSearchParams {
  timeoutMs?: number;
  sinceId?: string;
}

export interface CaptureWaitResult {
  timedOut: boolean;
  capture?: CaptureEntrySummary;
}

export interface ComposerSendBody {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  captureId?: string;
}

export interface MockRuleSaveBody {
  id?: string;
  name?: string;
  enabled?: boolean;
  urlRegex?: string;
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  delayMs?: number;
  captureId?: string;
}

export interface InterceptRuleSaveBody {
  id?: string;
  name?: string;
  enabled?: boolean;
  mode: 'rewrite' | 'breakpoint';
  phase: 'request' | 'response';
  urlRegex?: string;
  headers?: Record<string, string>;
  body?: string;
  status?: number;
  captureId?: string;
}

export interface BreakpointContinueBody {
  headers?: Record<string, string>;
  body?: string;
  status?: number;
}

export interface BreakpointWaitResult {
  timedOut: boolean;
  breakpoint?: {
    id: string;
    captureId: string;
    phase: string;
    ruleName: string;
    method: string;
    url: string;
  };
}

export interface McpApiHandlers {
  getStatus: () => Promise<YanshufStatus>;
  toggleCapture: () => Promise<YanshufStatus>;
  clearSession: () => Promise<CaptureClearResult>;
  searchCaptures: (params: CaptureSearchParams) => Promise<CaptureEntrySummary[]>;
  getCapture: (id: string) => Promise<CaptureEntry | undefined>;
  waitForCapture: (params: CaptureWaitParams) => Promise<CaptureWaitResult>;
  sendRequest: (body: ComposerSendBody) => Promise<ComposerResponse>;
  listMockRules: () => Promise<AutoResponderRule[]>;
  saveMockRule: (body: MockRuleSaveBody) => Promise<AutoResponderRule>;
  deleteMockRule: (id: string) => Promise<void>;
  listInterceptRules: () => Promise<InterceptRule[]>;
  saveInterceptRule: (body: InterceptRuleSaveBody) => Promise<InterceptRule>;
  deleteInterceptRule: (id: string) => Promise<void>;
  listPendingBreakpoints: () => Promise<CaptureEntrySummary[]>;
  continueBreakpoint: (id: string, body?: BreakpointContinueBody) => Promise<void>;
  abortBreakpoint: (id: string) => Promise<void>;
  waitForBreakpoint: (params: { timeoutMs?: number }) => Promise<BreakpointWaitResult>;
}

export type ComposerSendBodyWithRequest = ComposerSendBody & { request?: ComposerRequest };
