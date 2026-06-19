import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { BrowserWindow, shell } from 'electron';
import forge from 'node-forge';
import CA from 'http-mitm-proxy/dist/lib/ca';
import type { CertStatus } from '../../shared/types';

const execFileAsync = promisify(execFile);
const KEYCHAIN_ACCESS = '/System/Applications/Utilities/Keychain Access.app';
const SYSTEM_KEYCHAIN = '/Library/Keychains/System.keychain';
const CA_COMMON_NAME = 'NodeMITMProxyCA';
const INSTALL_CER_PATH = '/tmp/yanshuf-root-ca.cer';
const INSTALL_SCRIPT_PATH = '/tmp/yanshuf-install-cert.sh';

async function execAsAdmin(shellScriptPath: string): Promise<void> {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) win.hide();
  }
  await new Promise((r) => setTimeout(r, 250));

  try {
    await execFileAsync('osascript', [
      '-e',
      `do shell script "${shellScriptPath}" with administrator privileges`,
    ]);
  } finally {
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.show();
        win.focus();
      }
    }
  }
}

export interface CertInstallResult {
  alreadyInstalled: boolean;
  needsManualTrust: boolean;
}

export class CertificateManager {
  private certsDir: string;

  constructor(certsDir: string) {
    this.certsDir = certsDir;
  }

  getSslCaDir(): string {
    return this.certsDir;
  }

  private caCertPath(): string {
    return path.join(this.certsDir, 'certs', 'ca.pem');
  }

  async ensureCaGenerated(): Promise<void> {
    await fs.mkdir(this.certsDir, { recursive: true });
    await new Promise<void>((resolve, reject) => {
      CA.create(this.certsDir, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async writeCerFile(destPath: string): Promise<string> {
    await this.ensureCaGenerated();
    const pemPath = this.caCertPath();

    try {
      await execFileAsync('openssl', [
        'x509',
        '-in',
        pemPath,
        '-outform',
        'DER',
        '-out',
        destPath,
      ]);
    } catch {
      const pem = await fs.readFile(pemPath, 'utf8');
      const cert = forge.pki.certificateFromPem(pem);
      const der = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary');
      await fs.writeFile(destPath, der);
    }

    await fs.chmod(destPath, 0o644);
    return destPath;
  }

  private async isInstalledInSystemKeychain(): Promise<boolean> {
    try {
      await execFileAsync('security', [
        'find-certificate',
        '-c',
        CA_COMMON_NAME,
        SYSTEM_KEYCHAIN,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  private async exportSystemCaPem(): Promise<string> {
    const { stdout } = await execFileAsync('security', [
      'find-certificate',
      '-c',
      CA_COMMON_NAME,
      '-p',
      SYSTEM_KEYCHAIN,
    ]);
    return stdout;
  }

  private async isTrustedInSystemKeychain(): Promise<boolean> {
    try {
      const tmpPem = path.join('/tmp', 'yanshuf-ca-verify.pem');
      const pem = await this.exportSystemCaPem();
      await fs.writeFile(tmpPem, pem, { mode: 0o644 });
      await execFileAsync('security', [
        'verify-cert',
        '-c',
        tmpPem,
        '-r',
        tmpPem,
        '-l',
        '-p',
        'ssl',
        '-k',
        SYSTEM_KEYCHAIN,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<CertStatus> {
    try {
      await this.ensureCaGenerated();
      const installed = await this.isInstalledInSystemKeychain();
      if (!installed) {
        return { exists: true, trusted: 'unknown', caPath: this.caCertPath() };
      }
      const trusted = await this.isTrustedInSystemKeychain();
      return {
        exists: true,
        trusted: trusted ? 'installed' : 'untrusted',
        caPath: this.caCertPath(),
      };
    } catch {
      return { exists: false, trusted: 'unknown' };
    }
  }

  /**
   * Import root CA into the System keychain. macOS requires a manual
   * "Always Trust" step afterward — Electron cannot set that automatically.
   */
  async installToSystemKeychain(): Promise<CertInstallResult> {
    if (process.platform !== 'darwin') {
      throw new Error('System keychain install is only supported on macOS');
    }

    await this.writeCerFile(INSTALL_CER_PATH);

    const alreadyInstalled = await this.isInstalledInSystemKeychain();
    if (alreadyInstalled) {
      const trusted = await this.isTrustedInSystemKeychain();
      if (!trusted) {
        await shell.openPath(KEYCHAIN_ACCESS);
      }
      return { alreadyInstalled: true, needsManualTrust: !trusted };
    }

    const script = `#!/bin/bash
set -e
security delete-certificate -c "${CA_COMMON_NAME}" "${SYSTEM_KEYCHAIN}" 2>/dev/null || true
security import "${INSTALL_CER_PATH}" -k "${SYSTEM_KEYCHAIN}"
`;
    await fs.writeFile(INSTALL_SCRIPT_PATH, script, { mode: 0o755 });

    await execAsAdmin(INSTALL_SCRIPT_PATH);
    await shell.openPath(KEYCHAIN_ACCESS);
    return { alreadyInstalled: false, needsManualTrust: true };
  }

  async openKeychainAccess(): Promise<void> {
    await shell.openPath(KEYCHAIN_ACCESS);
  }

  /** Export .cer for manual install (fallback). */
  async exportCertificate(): Promise<string> {
    const downloads = path.join(process.env.HOME ?? '', 'Downloads');
    const dest = path.join(downloads, 'Yanshuf-Root-CA.cer');
    await this.writeCerFile(dest);
    await shell.openPath(KEYCHAIN_ACCESS);
    await shell.showItemInFolder(dest);
    return dest;
  }

  async verifyTrust(_port: number): Promise<{ trusted: boolean; error?: string }> {
    const installed = await this.isInstalledInSystemKeychain();
    if (!installed) {
      return {
        trusted: false,
        error: 'Certificate not found in System keychain. Click Install to System Keychain first.',
      };
    }

    const trusted = await this.isTrustedInSystemKeychain();
    if (!trusted) {
      return {
        trusted: false,
        error:
          'Certificate is installed but not trusted. Double-click NodeMITMProxyCA in Keychain Access → Trust → Always Trust.',
      };
    }

    return { trusted: true };
  }
}
