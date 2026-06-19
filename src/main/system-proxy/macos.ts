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

async function listNetworkServiceOrder(): Promise<string[]> {
  const { stdout } = await execFileAsync('networksetup', ['-listnetworkserviceorder']);
  const services: string[] = [];
  for (const line of stdout.split('\n')) {
    const match = line.match(/^\(\d+\)\s+(.+)$/);
    if (match) services.push(match[1].trim());
  }
  return services;
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

async function getProxySetting(service: string, type: string): Promise<string> {
  const { stdout } = await execFileAsync('networksetup', [`-get${type}`, service]);
  return stdout.trim();
}

async function setProxyForService(service: string, host: string, port: number, enabled: boolean): Promise<void> {
  if (enabled) {
    await execFileAsync('networksetup', ['-setwebproxy', service, host, String(port)]);
    await execFileAsync('networksetup', ['-setsecurewebproxy', service, host, String(port)]);
    await execFileAsync('networksetup', ['-setwebproxystate', service, 'on']);
    await execFileAsync('networksetup', ['-setsecurewebproxystate', service, 'on']);
  } else {
    await execFileAsync('networksetup', ['-setwebproxystate', service, 'off']);
    await execFileAsync('networksetup', ['-setsecurewebproxystate', service, 'off']);
  }
}

export class SystemProxyManager {
  private state: SystemProxyState = { enabled: false };
  private configuredServices: string[] = [];

  async enable(host: string, port: number): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('System proxy is only supported on macOS');
    }

    const services = await getNetworkServicesForProxy();
    this.configuredServices = services;

    const primary = await getPrimaryNetworkService();
    if (primary) {
      const webProxy = await getProxySetting(primary, 'webproxy');
      const secureProxy = await getProxySetting(primary, 'securewebproxy');
      this.state = {
        enabled: true,
        previousSettings: { webProxy, secureWebProxy: secureProxy },
      };
    } else {
      this.state = { enabled: true };
    }

    for (const service of services) {
      await setProxyForService(service, host, port, true);
    }
  }

  async disable(): Promise<void> {
    if (process.platform !== 'darwin' || !this.state.enabled) return;

    const services =
      this.configuredServices.length > 0 ? this.configuredServices : await getNetworkServicesForProxy();

    for (const service of services) {
      await setProxyForService(service, '127.0.0.1', 8888, false);
    }

    this.configuredServices = [];
    this.state = { enabled: false };
  }

  isEnabled(): boolean {
    return this.state.enabled;
  }

  getState(): SystemProxyState {
    return this.state;
  }

  restoreFromFlag(wasEnabled: boolean, host: string, port: number): void {
    if (wasEnabled) {
      void this.enable(host, port);
    }
  }
}
