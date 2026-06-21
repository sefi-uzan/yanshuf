import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { McpConfig, McpTokenFile } from './constants.js';
import { MCP_DEFAULT_PORT } from './constants.js';

export interface ApiClientConfig {
  baseUrl: string;
  token: string;
}

function yanshufUserDataDir(): string {
  if (process.env.YANSHUF_USER_DATA) return process.env.YANSHUF_USER_DATA;
  return path.join(os.homedir(), 'Library', 'Application Support', 'Yanshuf');
}

function mcpDataDir(): string {
  return path.join(yanshufUserDataDir(), 'data', 'mcp');
}

export async function loadApiClientConfig(): Promise<ApiClientConfig> {
  const tokenFromEnv = process.env.YANSHUF_MCP_TOKEN;
  const portFromEnv = process.env.YANSHUF_MCP_PORT;

  let token = tokenFromEnv;
  let port = portFromEnv ? Number(portFromEnv) : undefined;

  if (!token) {
    try {
      const raw = await fs.readFile(path.join(mcpDataDir(), 'token.json'), 'utf8');
      token = (JSON.parse(raw) as McpTokenFile).token;
    } catch {
      throw new Error('Yanshuf is not running or MCP token is unavailable. Launch Yanshuf first.');
    }
  }

  if (!port || !Number.isFinite(port)) {
    try {
      const raw = await fs.readFile(path.join(mcpDataDir(), 'config.json'), 'utf8');
      port = (JSON.parse(raw) as McpConfig).port;
    } catch {
      port = MCP_DEFAULT_PORT;
    }
  }

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    token: token!,
  };
}

export class YanshufApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  private async request<T>(method: string, pathname: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${pathname}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.token}`,
    };
    let payload: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: payload });
    } catch {
      throw new Error('Yanshuf is not running. Launch the app first.');
    }

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    if (!res.ok) {
      const err = data as { error?: string };
      throw new Error(err?.error ?? `Request failed (${res.status})`);
    }

    return data as T;
  }

  getStatus() {
    return this.request<Record<string, unknown>>('GET', '/status');
  }

  toggleCapture() {
    return this.request<Record<string, unknown>>('POST', '/capture/toggle');
  }

  cleanupSession() {
    return this.request<{
      entryCount: number;
      disabledMockCount: number;
      disabledInterceptCount: number;
      disabledMapRemoteCount: number;
    }>('POST', '/session/cleanup');
  }

  searchCaptures(params: Record<string, string | number | undefined>) {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') q.set(key, String(value));
    }
    const qs = q.toString();
    return this.request<{ captures: unknown[] }>('GET', `/captures/search${qs ? `?${qs}` : ''}`);
  }

  getCapture(id: string) {
    return this.request<Record<string, unknown>>('GET', `/captures/${encodeURIComponent(id)}`);
  }

  waitForCapture(params: Record<string, string | number | undefined>) {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') q.set(key, String(value));
    }
    return this.request<Record<string, unknown>>('GET', `/captures/wait?${q.toString()}`);
  }

  sendRequest(body: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('POST', '/composer/send', body);
  }

  listMockRules() {
    return this.request<{ rules: unknown[] }>('GET', '/rules/mock');
  }

  saveMockRule(body: Record<string, unknown>) {
    const id = body.id as string | undefined;
    if (id) {
      return this.request<Record<string, unknown>>('PUT', `/rules/mock/${encodeURIComponent(id)}`, body);
    }
    return this.request<Record<string, unknown>>('PUT', '/rules/mock', body);
  }

  deleteMockRule(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/rules/mock/${encodeURIComponent(id)}`);
  }

  listInterceptRules() {
    return this.request<{ rules: unknown[] }>('GET', '/rules/intercept');
  }

  saveInterceptRule(body: Record<string, unknown>) {
    const id = body.id as string | undefined;
    if (id) {
      return this.request<Record<string, unknown>>(
        'PUT',
        `/rules/intercept/${encodeURIComponent(id)}`,
        body,
      );
    }
    return this.request<Record<string, unknown>>('PUT', '/rules/intercept', body);
  }

  deleteInterceptRule(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/rules/intercept/${encodeURIComponent(id)}`);
  }

  listMapRemoteRules() {
    return this.request<{ rules: unknown[] }>('GET', '/rules/map-remote');
  }

  saveMapRemoteRule(body: Record<string, unknown>) {
    const id = body.id as string | undefined;
    if (id) {
      return this.request<Record<string, unknown>>(
        'PUT',
        `/rules/map-remote/${encodeURIComponent(id)}`,
        body,
      );
    }
    return this.request<Record<string, unknown>>('PUT', '/rules/map-remote', body);
  }

  deleteMapRemoteRule(id: string) {
    return this.request<{ ok: boolean }>('DELETE', `/rules/map-remote/${encodeURIComponent(id)}`);
  }

  listPendingBreakpoints() {
    return this.request<{ breakpoints: unknown[] }>('GET', '/breakpoints/pending');
  }

  continueBreakpoint(id: string, body?: Record<string, unknown>) {
    return this.request<{ ok: boolean }>(
      'POST',
      `/breakpoints/${encodeURIComponent(id)}/continue`,
      body ?? {},
    );
  }

  abortBreakpoint(id: string) {
    return this.request<{ ok: boolean }>('POST', `/breakpoints/${encodeURIComponent(id)}/abort`);
  }

  setThrottle(body: Record<string, unknown> | null) {
    return this.request<Record<string, unknown>>('POST', '/throttle', body);
  }

  waitForBreakpoint(timeoutMs?: number) {
    const q = timeoutMs !== undefined ? `?timeoutMs=${timeoutMs}` : '';
    return this.request<Record<string, unknown>>('GET', `/breakpoints/wait${q}`);
  }
}
