import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MCP_DEFAULT_PORT } from '@yanshuf/shared';
function yanshufUserDataDir() {
    if (process.env.YANSHUF_USER_DATA)
        return process.env.YANSHUF_USER_DATA;
    return path.join(os.homedir(), 'Library', 'Application Support', 'Yanshuf');
}
function mcpDataDir() {
    return path.join(yanshufUserDataDir(), 'data', 'mcp');
}
export async function loadApiClientConfig() {
    const tokenFromEnv = process.env.YANSHUF_MCP_TOKEN;
    const portFromEnv = process.env.YANSHUF_MCP_PORT;
    let token = tokenFromEnv;
    let port = portFromEnv ? Number(portFromEnv) : undefined;
    if (!token) {
        try {
            const raw = await fs.readFile(path.join(mcpDataDir(), 'token.json'), 'utf8');
            token = JSON.parse(raw).token;
        }
        catch {
            throw new Error('Yanshuf is not running or MCP token is unavailable. Launch Yanshuf first.');
        }
    }
    if (!port || !Number.isFinite(port)) {
        try {
            const raw = await fs.readFile(path.join(mcpDataDir(), 'config.json'), 'utf8');
            port = JSON.parse(raw).port;
        }
        catch {
            port = MCP_DEFAULT_PORT;
        }
    }
    return {
        baseUrl: `http://127.0.0.1:${port}`,
        token: token,
    };
}
export class YanshufApiClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async request(method, pathname, body) {
        const url = `${this.config.baseUrl}${pathname}`;
        const headers = {
            Authorization: `Bearer ${this.config.token}`,
        };
        let payload;
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
        }
        let res;
        try {
            res = await fetch(url, { method, headers, body: payload });
        }
        catch {
            throw new Error('Yanshuf is not running. Launch the app first.');
        }
        const text = await res.text();
        let data = null;
        if (text) {
            try {
                data = JSON.parse(text);
            }
            catch {
                data = { raw: text };
            }
        }
        if (!res.ok) {
            const err = data;
            throw new Error(err?.error ?? `Request failed (${res.status})`);
        }
        return data;
    }
    getStatus() {
        return this.request('GET', '/status');
    }
    toggleCapture() {
        return this.request('POST', '/capture/toggle');
    }
    clearSession() {
        return this.request('POST', '/capture/clear');
    }
    searchCaptures(params) {
        const q = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== '')
                q.set(key, String(value));
        }
        const qs = q.toString();
        return this.request('GET', `/captures/search${qs ? `?${qs}` : ''}`);
    }
    getCapture(id) {
        return this.request('GET', `/captures/${encodeURIComponent(id)}`);
    }
    waitForCapture(params) {
        const q = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== '')
                q.set(key, String(value));
        }
        return this.request('GET', `/captures/wait?${q.toString()}`);
    }
    sendRequest(body) {
        return this.request('POST', '/composer/send', body);
    }
    listMockRules() {
        return this.request('GET', '/rules/mock');
    }
    saveMockRule(body) {
        const id = body.id;
        if (id) {
            return this.request('PUT', `/rules/mock/${encodeURIComponent(id)}`, body);
        }
        return this.request('PUT', '/rules/mock', body);
    }
    deleteMockRule(id) {
        return this.request('DELETE', `/rules/mock/${encodeURIComponent(id)}`);
    }
    listInterceptRules() {
        return this.request('GET', '/rules/intercept');
    }
    saveInterceptRule(body) {
        const id = body.id;
        if (id) {
            return this.request('PUT', `/rules/intercept/${encodeURIComponent(id)}`, body);
        }
        return this.request('PUT', '/rules/intercept', body);
    }
    deleteInterceptRule(id) {
        return this.request('DELETE', `/rules/intercept/${encodeURIComponent(id)}`);
    }
    listPendingBreakpoints() {
        return this.request('GET', '/breakpoints/pending');
    }
    continueBreakpoint(id, body) {
        return this.request('POST', `/breakpoints/${encodeURIComponent(id)}/continue`, body ?? {});
    }
    abortBreakpoint(id) {
        return this.request('POST', `/breakpoints/${encodeURIComponent(id)}/abort`);
    }
    waitForBreakpoint(timeoutMs) {
        const q = timeoutMs !== undefined ? `?timeoutMs=${timeoutMs}` : '';
        return this.request('GET', `/breakpoints/wait${q}`);
    }
}
//# sourceMappingURL=client.js.map