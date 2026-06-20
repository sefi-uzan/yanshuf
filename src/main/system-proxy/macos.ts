import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SystemProxyState } from '../../shared/types';

const execFileAsync = promisify(execFile);

async function listAllNetworkServices(): Promise<string[]> {
  const { stdout } = await execFileAsync('networksetup', ['-listallnetworkservices']);
  return stdout
    .split('\n')
    .slice(1)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('*'));
}

async function getDefaultRouteDevice(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('route', ['-n', 'get', 'default']);
    const match = stdout.match(/interface:\s*(\S+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function getDeviceToServiceMap(): Promise<Map<string, string>> {
  const { stdout } = await execFileAsync('networksetup', ['-listallhardwareports']);
  const map = new Map<string, string>();
  for (const block of stdout.split(/\n\n+/)) {
    const deviceMatch = block.match(/Device:\s*(\S+)/);
    const portMatch = block.match(/Hardware Port:\s*(.+)/);
    if (deviceMatch && portMatch) {
      map.set(deviceMatch[1], portMatch[1].trim());
    }
  }
  return map;
}

async function getPrimaryNetworkService(): Promise<string | null> {
  const [device, deviceMap, allServices] = await Promise.all([
    getDefaultRouteDevice(),
    getDeviceToServiceMap(),
    listAllNetworkServices(),
  ]);

  if (!device) return null;

  const hardwarePort = deviceMap.get(device);
  if (!hardwarePort) return null;

  return allServices.find((service) => service === hardwarePort) ?? hardwarePort;
}

async function getNetworkServicesForProxy(): Promise<string[]> {
  const [allServices, primary] = await Promise.all([
    listAllNetworkServices(),
    getPrimaryNetworkService(),
  ]);

  return allServices.length > 0 ? allServices : primary ? [primary] : ['Wi-Fi'];
}

interface ProxySnapshot {
  enabled: boolean;
  server: string;
  port: string;
}

interface ServiceSnapshot {
  web: ProxySnapshot;
  secure: ProxySnapshot;
}

function parseProxySetting(stdout: string): ProxySnapshot {
  const enabled = /^Enabled:\s*Yes/im.test(stdout);
  const server = stdout.match(/^Server:\s*(.*)$/im)?.[1].trim() ?? '';
  const port = stdout.match(/^Port:\s*(.*)$/im)?.[1].trim() ?? '';
  return { enabled, server, port };
}

async function readServiceSnapshot(service: string): Promise<ServiceSnapshot> {
  const [web, secure] = await Promise.all([
    execFileAsync('networksetup', ['-getwebproxy', service]).then((r) => parseProxySetting(r.stdout)),
    execFileAsync('networksetup', ['-getsecurewebproxy', service]).then((r) => parseProxySetting(r.stdout)),
  ]);
  return { web, secure };
}

async function enableProxyForService(service: string, host: string, port: number): Promise<void> {
  await execFileAsync('networksetup', ['-setwebproxy', service, host, String(port)]);
  await execFileAsync('networksetup', ['-setsecurewebproxy', service, host, String(port)]);
  await execFileAsync('networksetup', ['-setwebproxystate', service, 'on']);
  await execFileAsync('networksetup', ['-setsecurewebproxystate', service, 'on']);
}

async function restoreProxyForService(service: string, snapshot: ServiceSnapshot): Promise<void> {
  if (snapshot.web.enabled && snapshot.web.server) {
    await execFileAsync('networksetup', ['-setwebproxy', service, snapshot.web.server, snapshot.web.port || '0']);
    await execFileAsync('networksetup', ['-setwebproxystate', service, 'on']);
  } else {
    await execFileAsync('networksetup', ['-setwebproxystate', service, 'off']);
  }
  if (snapshot.secure.enabled && snapshot.secure.server) {
    await execFileAsync('networksetup', [
      '-setsecurewebproxy',
      service,
      snapshot.secure.server,
      snapshot.secure.port || '0',
    ]);
    await execFileAsync('networksetup', ['-setsecurewebproxystate', service, 'on']);
  } else {
    await execFileAsync('networksetup', ['-setsecurewebproxystate', service, 'off']);
  }
}

export class SystemProxyManager {
  private state: SystemProxyState = { enabled: false };
  private snapshots = new Map<string, ServiceSnapshot>();

  async enable(host: string, port: number): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('System proxy is only supported on macOS');
    }

    const services = await getNetworkServicesForProxy();

    // Snapshot each service so disable() can restore any pre-existing proxy config.
    this.snapshots.clear();
    for (const service of services) {
      try {
        this.snapshots.set(service, await readServiceSnapshot(service));
      } catch {
        // If we can't read it, we just won't restore it (fall back to off).
      }
    }

    this.state = { enabled: true };

    for (const service of services) {
      await enableProxyForService(service, host, port);
    }
  }

  async disable(): Promise<void> {
    if (process.platform !== 'darwin' || !this.state.enabled) return;

    const services =
      this.snapshots.size > 0 ? [...this.snapshots.keys()] : await getNetworkServicesForProxy();

    for (const service of services) {
      const snapshot = this.snapshots.get(service);
      try {
        if (snapshot) {
          await restoreProxyForService(service, snapshot);
        } else {
          await execFileAsync('networksetup', ['-setwebproxystate', service, 'off']);
          await execFileAsync('networksetup', ['-setsecurewebproxystate', service, 'off']);
        }
      } catch {
        // Best effort: keep restoring the remaining services.
      }
    }

    this.snapshots.clear();
    this.state = { enabled: false };
  }

  isEnabled(): boolean {
    return this.state.enabled;
  }

  async updatePort(host: string, port: number): Promise<void> {
    if (process.platform !== 'darwin' || !this.state.enabled) return;

    const services =
      this.snapshots.size > 0 ? [...this.snapshots.keys()] : await getNetworkServicesForProxy();

    for (const service of services) {
      await enableProxyForService(service, host, port);
    }
  }

  getState(): SystemProxyState {
    return this.state;
  }
}
