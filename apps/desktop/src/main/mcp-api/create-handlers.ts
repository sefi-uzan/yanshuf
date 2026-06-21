import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type {
  AppSettings,
  AutoResponderRule,
  BreakpointSnapshot,
  CaptureEntry,
  CaptureEntrySummary,
  ComposerRequest,
  ComposerResponse,
  InterceptModifications,
  InterceptRule,
  MapRemoteRule,
  MapRemoteRuleSaveBody,
  MockRuleSaveBody,
  InterceptRuleSaveBody,
  ComposerSendBody,
  BreakpointContinueBody,
  CaptureSearchParams,
  CaptureWaitParams,
  YanshufStatus,
  McpApiHandlers,
  ThrottleSetPatch,
} from '@yanshuf/shared';
import {
  captureToAutoResponderRule,
  captureToMapRemoteRule,
  captureToComposerRequest,
  searchCaptures as filterCaptures,
  resolveThrottleSettings,
} from '@yanshuf/shared';
import type { AutoResponderEngine } from '../auto-responder/engine';
import type { BreakpointManager } from '../intercept/breakpoint-manager';
import type { InterceptEngine } from '../intercept/engine';
import type { MapRemoteEngine } from '../map-remote/engine';
import type { CertificateManager } from '../cert/manager';
import type { ComposerService } from '../composer/service';
import type { CaptureStore } from '../proxy/capture-store';
import type { ProxyServer } from '../proxy/server';
import type { SystemProxyManager } from '../system-proxy/macos';
import type { JsonFileStore } from '../storage/json-store';
import { assertCertTrusted } from '../cert/cert-gate';
import type { McpWaitQueue } from './wait-queue';

export interface McpHandlerDeps {
  settings: AppSettings;
  saveSettings: () => Promise<void>;
  captureStore: CaptureStore;
  autoResponder: AutoResponderEngine;
  interceptEngine: InterceptEngine;
  mapRemoteEngine: MapRemoteEngine;
  breakpointManager: BreakpointManager;
  proxyServer: ProxyServer;
  certManager: CertificateManager;
  systemProxy: SystemProxyManager;
  composerService: ComposerService;
  store: JsonFileStore;
  waitQueue: McpWaitQueue;
  mcpApiPort: number;
  broadcastCaptureUpdate: (immediate?: boolean) => void;
  tagComposerCaptures: (beforeIds: Set<string>, req: ComposerRequest) => void;
  mergeAndApplyThrottle: (patch: ThrottleSetPatch | null) => void;
}

async function isCertTrusted(certManager: CertificateManager): Promise<boolean> {
  const result = await certManager.verifyTrust();
  return result.trusted;
}

function buildStatus(
  deps: McpHandlerDeps,
  certTrusted: boolean,
): YanshufStatus {
  return {
    capturing: deps.systemProxy.isEnabled() && deps.proxyServer.isRunning(),
    port: deps.settings.port,
    entryCount: deps.captureStore.count,
    certTrusted,
    mcpApiPort: deps.mcpApiPort,
    throttle: resolveThrottleSettings(deps.settings.throttle),
  };
}

export function createMcpHandlers(deps: McpHandlerDeps): McpApiHandlers {
  return {
    async getStatus() {
      const certTrusted = await isCertTrusted(deps.certManager);
      return buildStatus(deps, certTrusted);
    },

    async toggleCapture() {
      const certTrusted = await isCertTrusted(deps.certManager);
      if (!certTrusted) {
        throw new Error('Certificate is not trusted. Complete certificate setup in Yanshuf settings.');
      }

      const capturing = deps.systemProxy.isEnabled() && deps.proxyServer.isRunning();
      if (capturing) {
        await deps.proxyServer.stop();
        deps.settings.proxyRunning = false;
        await deps.systemProxy.disable();
        deps.settings.systemProxyEnabled = false;
      } else {
        await deps.systemProxy.enable('127.0.0.1', deps.settings.port, {
          captureLocalhost: deps.settings.captureLocalhost,
        });
        deps.settings.systemProxyEnabled = true;
        await assertCertTrusted(deps.certManager);
        await deps.proxyServer.start();
        deps.settings.proxyRunning = true;
      }
      await deps.saveSettings();
      return buildStatus(deps, certTrusted);
    },

    async cleanupSession() {
      deps.captureStore.clear();
      deps.broadcastCaptureUpdate(true);

      let disabledMockCount = 0;
      const mockRules = deps.autoResponder.getRules();
      const nextMock = mockRules.map((rule) => {
        if (!rule.enabled) return rule;
        disabledMockCount += 1;
        return { ...rule, enabled: false };
      });
      if (disabledMockCount > 0) {
        deps.autoResponder.setRules(nextMock);
        await deps.store.write('rules.json', nextMock);
      }

      let disabledInterceptCount = 0;
      const interceptRules = deps.interceptEngine.getRules();
      const nextIntercept = interceptRules.map((rule) => {
        if (!rule.enabled) return rule;
        disabledInterceptCount += 1;
        return { ...rule, enabled: false };
      });
      if (disabledInterceptCount > 0) {
        deps.interceptEngine.setRules(nextIntercept);
        await deps.store.write('intercept.json', nextIntercept);
      }

      let disabledMapRemoteCount = 0;
      const mapRemoteRules = deps.mapRemoteEngine.getRules();
      const nextMapRemote = mapRemoteRules.map((rule) => {
        if (!rule.enabled) return rule;
        disabledMapRemoteCount += 1;
        return { ...rule, enabled: false };
      });
      if (disabledMapRemoteCount > 0) {
        deps.mapRemoteEngine.setRules(nextMapRemote);
        await deps.store.write('map-remote.json', nextMapRemote);
      }

      return { entryCount: 0, disabledMockCount, disabledInterceptCount, disabledMapRemoteCount };
    },

    async searchCaptures(params: CaptureSearchParams) {
      return filterCaptures(deps.captureStore.list(), params);
    },

    async getCapture(id: string) {
      return deps.captureStore.get(id);
    },

    async waitForCapture(params: CaptureWaitParams) {
      let sinceStartedAt: number | undefined;
      if (params.sinceId) {
        const since = deps.captureStore.get(params.sinceId);
        if (since) sinceStartedAt = since.startedAt;
      }

      const existing = filterCaptures(deps.captureStore.list(), params);
      for (const entry of existing) {
        if (sinceStartedAt !== undefined && entry.startedAt <= sinceStartedAt) continue;
        return { timedOut: false, capture: entry };
      }

      const capture = await deps.waitQueue.waitForCapture(params, sinceStartedAt);
      return capture ? { timedOut: false, capture } : { timedOut: true };
    },

    async sendRequest(body: ComposerSendBody) {
      let req: ComposerRequest;
      if (body.captureId) {
        const entry = deps.captureStore.get(body.captureId);
        if (!entry) throw new Error(`Capture not found: ${body.captureId}`);
        req = captureToComposerRequest(entry);
      } else {
        if (!body.url) throw new Error('url is required when captureId is not provided');
        req = {
          method: (body.method ?? 'GET').toUpperCase(),
          url: body.url,
          headers: body.headers ?? {},
          body: body.body,
        };
      }

      if (!deps.proxyServer.isRunning()) {
        await assertCertTrusted(deps.certManager);
        await deps.proxyServer.start();
        deps.settings.proxyRunning = true;
        await deps.saveSettings();
      }

      const beforeIds = new Set(deps.captureStore.list().map((e) => e.id));
      const caCertPath = path.join(deps.certManager.getSslCaDir(), 'certs', 'ca.pem');
      const response = await deps.composerService.send(req, {
        proxyPort: deps.settings.port,
        caCertPath,
      });
      deps.tagComposerCaptures(beforeIds, req);
      deps.broadcastCaptureUpdate(true);
      return response;
    },

    async listMockRules() {
      return deps.autoResponder.getRules();
    },

    async saveMockRule(body: MockRuleSaveBody) {
      const rules = deps.autoResponder.getRules();
      let rule: AutoResponderRule;

      if (body.captureId) {
        const entry = deps.captureStore.get(body.captureId);
        if (!entry) throw new Error(`Capture not found: ${body.captureId}`);
        rule = captureToAutoResponderRule(entry, rules.length, body.id);
      } else {
        if (!body.urlRegex) throw new Error('urlRegex is required when captureId is not provided');
        rule = {
          id: body.id ?? uuidv4(),
          name: body.name ?? 'Mock rule',
          enabled: body.enabled ?? true,
          order: rules.length,
          match: { urlRegex: body.urlRegex },
          response: {
            status: body.status ?? 200,
            headers: body.headers ?? { 'content-type': 'application/json' },
            body: body.body !== undefined ? { type: 'inline', content: body.body } : undefined,
            delayMs: body.delayMs ?? 0,
          },
        };
      }

      if (body.name !== undefined) rule.name = body.name;
      if (body.enabled !== undefined) rule.enabled = body.enabled;
      if (body.urlRegex !== undefined) rule.match.urlRegex = body.urlRegex;
      if (body.status !== undefined) rule.response.status = body.status;
      if (body.headers !== undefined) rule.response.headers = body.headers;
      if (body.body !== undefined) rule.response.body = { type: 'inline', content: body.body };
      if (body.delayMs !== undefined) rule.response.delayMs = body.delayMs;

      const existingIdx = rules.findIndex((r) => r.id === rule.id);
      const next =
        existingIdx >= 0
          ? rules.map((r, i) => (i === existingIdx ? { ...rule, order: r.order } : r))
          : [...rules, rule];

      deps.autoResponder.setRules(next);
      await deps.store.write('rules.json', next);
      return existingIdx >= 0 ? next[existingIdx]! : rule;
    },

    async deleteMockRule(id: string) {
      const rules = deps.autoResponder.getRules().filter((r) => r.id !== id);
      deps.autoResponder.setRules(rules);
      await deps.store.write('rules.json', rules);
    },

    async listInterceptRules() {
      return deps.interceptEngine.getRules();
    },

    async saveInterceptRule(body: InterceptRuleSaveBody) {
      const rules = deps.interceptEngine.getRules();
      let rule: InterceptRule;

      if (body.captureId) {
        const entry = deps.captureStore.get(body.captureId);
        if (!entry) throw new Error(`Capture not found: ${body.captureId}`);
        const mods: InterceptModifications = {};
        if (body.phase === 'request') {
          mods.headers = body.headers ?? entry.client.headers;
          mods.body = body.body ?? entry.client.body?.preview ?? '';
        } else {
          mods.status = body.status ?? entry.status;
          mods.headers = body.headers ?? entry.server.headers;
          mods.body = body.body ?? entry.server.body?.preview ?? '';
        }
        rule = {
          id: body.id ?? uuidv4(),
          name: body.name ?? entry.host,
          enabled: body.enabled ?? true,
          order: rules.length,
          mode: body.mode,
          phase: body.phase,
          match: { urlRegex: body.urlRegex ?? entry.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') },
          request: body.phase === 'request' ? mods : undefined,
          response: body.phase === 'response' ? mods : undefined,
        };
      } else {
        if (!body.urlRegex) throw new Error('urlRegex is required when captureId is not provided');
        const mods: InterceptModifications = {
          headers: body.headers,
          body: body.body,
          status: body.status,
        };
        rule = {
          id: body.id ?? uuidv4(),
          name: body.name ?? 'Intercept rule',
          enabled: body.enabled ?? true,
          order: rules.length,
          mode: body.mode,
          phase: body.phase,
          match: { urlRegex: body.urlRegex },
          request: body.phase === 'request' ? mods : undefined,
          response: body.phase === 'response' ? mods : undefined,
        };
      }

      if (body.name !== undefined) rule.name = body.name;
      if (body.enabled !== undefined) rule.enabled = body.enabled;

      const existingIdx = rules.findIndex((r) => r.id === rule.id);
      const next =
        existingIdx >= 0
          ? rules.map((r, i) => (i === existingIdx ? { ...rule, order: r.order } : r))
          : [...rules, rule];

      deps.interceptEngine.setRules(next);
      await deps.store.write('intercept.json', next);
      return existingIdx >= 0 ? next[existingIdx]! : rule;
    },

    async deleteInterceptRule(id: string) {
      const rules = deps.interceptEngine.getRules().filter((r) => r.id !== id);
      deps.interceptEngine.setRules(rules);
      await deps.store.write('intercept.json', rules);
    },

    async listMapRemoteRules() {
      return deps.mapRemoteEngine.getRules();
    },

    async saveMapRemoteRule(body: MapRemoteRuleSaveBody) {
      const rules = deps.mapRemoteEngine.getRules();
      let rule: MapRemoteRule;

      if (body.captureId) {
        const entry = deps.captureStore.get(body.captureId);
        if (!entry) throw new Error(`Capture not found: ${body.captureId}`);
        rule = captureToMapRemoteRule(entry, rules.length, body.id);
      } else {
        if (!body.urlRegex) throw new Error('urlRegex is required when captureId is not provided');
        if (!body.host) throw new Error('host is required when captureId is not provided');
        rule = {
          id: body.id ?? uuidv4(),
          name: body.name ?? 'Map Remote rule',
          enabled: body.enabled ?? true,
          order: rules.length,
          match: { urlRegex: body.urlRegex },
          mapTo: {
            host: body.host,
            port: body.port,
            protocol: body.protocol,
          },
        };
      }

      if (body.name !== undefined) rule.name = body.name;
      if (body.enabled !== undefined) rule.enabled = body.enabled;
      if (body.urlRegex !== undefined) rule.match.urlRegex = body.urlRegex;
      if (body.host !== undefined) rule.mapTo.host = body.host;
      if (body.port !== undefined) rule.mapTo.port = body.port;
      if (body.protocol !== undefined) rule.mapTo.protocol = body.protocol;

      const existingIdx = rules.findIndex((r) => r.id === rule.id);
      const next =
        existingIdx >= 0
          ? rules.map((r, i) => (i === existingIdx ? { ...rule, order: r.order } : r))
          : [...rules, rule];

      deps.mapRemoteEngine.setRules(next);
      await deps.store.write('map-remote.json', next);
      return existingIdx >= 0 ? next[existingIdx]! : rule;
    },

    async deleteMapRemoteRule(id: string) {
      const rules = deps.mapRemoteEngine.getRules().filter((r) => r.id !== id);
      deps.mapRemoteEngine.setRules(rules);
      await deps.store.write('map-remote.json', rules);
    },

    async listPendingBreakpoints() {
      return deps.captureStore.list().filter((e) => e.awaitingBreakpoint);
    },

    async continueBreakpoint(id: string, body?: BreakpointContinueBody) {
      const mods: InterceptModifications | undefined = body
        ? { headers: body.headers, body: body.body, status: body.status }
        : undefined;
      const ok = deps.breakpointManager.continue(id, mods);
      if (!ok) throw new Error(`Breakpoint not found: ${id}`);
    },

    async abortBreakpoint(id: string) {
      const ok = deps.breakpointManager.abort(id);
      if (!ok) throw new Error(`Breakpoint not found: ${id}`);
    },

    async waitForBreakpoint(params: { timeoutMs?: number }) {
      const snapshot = await deps.waitQueue.waitForBreakpoint(params.timeoutMs);
      if (!snapshot) return { timedOut: true };
      return {
        timedOut: false,
        breakpoint: {
          id: snapshot.id,
          captureId: snapshot.captureId,
          phase: snapshot.phase,
          ruleName: snapshot.ruleName,
          method: snapshot.method,
          url: snapshot.url,
        },
      };
    },

    async setThrottle(body) {
      deps.mergeAndApplyThrottle(body);
      await deps.saveSettings();
      const certTrusted = await isCertTrusted(deps.certManager);
      return buildStatus(deps, certTrusted);
    },
  };
}

export type { CaptureEntry, CaptureEntrySummary, ComposerResponse, BreakpointSnapshot };
