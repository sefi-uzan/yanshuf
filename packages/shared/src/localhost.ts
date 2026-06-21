export function normalizeHost(host: string): string {
  let normalized = host.trim().toLowerCase();
  if (normalized.startsWith('[') && normalized.includes(']')) {
    normalized = normalized.slice(1, normalized.indexOf(']'));
  } else {
    const colonIndex = normalized.lastIndexOf(':');
    if (colonIndex > -1 && normalized.indexOf(':') === colonIndex) {
      normalized = normalized.slice(0, colonIndex);
    }
  }
  return normalized;
}

export function parseHostPort(url: string, hostHeader?: string): { host: string; port: number | null } {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `http://${hostHeader ?? 'localhost'}${url}`);
    const host = normalizeHost(parsed.hostname);
    const port = parsed.port ? Number(parsed.port) : null;
    return { host, port: Number.isFinite(port) ? port : null };
  } catch {
    const host = normalizeHost(hostHeader ?? '');
    return { host, port: null };
  }
}

export function isLocalhostHost(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
    return true;
  }
  return normalized.endsWith('.local');
}

export function isLoopbackHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return isLocalhostHost(normalized);
}

export interface SelfTrafficOptions {
  proxyPort: number;
  mcpApiPort: number;
}

export function isSelfTraffic(host: string, port: number | null, opts: SelfTrafficOptions): boolean {
  if (!isLoopbackHost(host) || port === null) return false;
  return port === opts.proxyPort || port === opts.mcpApiPort;
}
