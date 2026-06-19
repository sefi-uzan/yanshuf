import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { shell } from 'electron';
import forge from 'node-forge';
import type { CertStatus } from '../../shared/types';
import {
  CA_COMMON_NAME,
  CA_EXPORT_FILENAME,
  INSTALL_CER_PATH,
  KEYCHAIN_ACCESS,
} from './constants';
import {
  caFilesExist,
  generateCa,
  readCaCommonName,
  readSha1HexFromPemFile,
  sha1HexFromPem,
} from './generate-ca';

const execFileAsync = promisify(execFile);

export interface CertInstallResult {
  alreadyInstalled: boolean;
  needsManualTrust: boolean;
}

function isCertAlreadyExistsError(err: unknown): boolean {
  const message = err instanceof Error ? `${err.message}\n${('stderr' in err ? String((err as NodeJS.ErrnoException & { stderr?: string }).stderr) : '')}` : String(err);
  return /already exists in the keychain/i.test(message);
}

async function getLoginKeychainPath(): Promise<string> {
  const fallback = path.join(process.env.HOME ?? '', 'Library/Keychains/login.keychain-db');
  try {
    const { stdout } = await execFileAsync('security', ['login-keychain']);
    const quoted = stdout.match(/"([^"]+\.keychain-db)"/);
    if (quoted?.[1]) return quoted[1];
    const bare = stdout.match(/(\S+\.keychain-db)/);
    if (bare?.[1]) return bare[1];
  } catch {
    // fall through
  }
  return fallback;
}

async function deleteCertByName(keychainPath: string, commonName: string): Promise<void> {
  try {
    await execFileAsync('security', ['delete-certificate', '-c', commonName, keychainPath]);
  } catch {
    // not present
  }
}

async function findCertPemByCommonName(keychainPath: string, commonName: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('security', [
      'find-certificate',
      '-c',
      commonName,
      '-p',
      keychainPath,
    ]);
    return stdout;
  } catch {
    return null;
  }
}

/** Match keychain cert to local CA by SHA-1 — never use `security find-certificate -Z` (false positives on macOS). */
async function findMatchingLocalCaInKeychain(
  keychainPath: string,
  localSha1: string,
  namesToTry: string[],
): Promise<string | null> {
  for (const name of namesToTry) {
    const pem = await findCertPemByCommonName(keychainPath, name);
    if (!pem) continue;
    try {
      if (sha1HexFromPem(pem) === localSha1) return pem;
    } catch {
      continue;
    }
  }
  return null;
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
    if (await caFilesExist(this.certsDir)) {
      const cn = await readCaCommonName(this.caCertPath());
      if (cn === CA_COMMON_NAME) return;
      await fs.rm(path.join(this.certsDir, 'certs'), { recursive: true, force: true });
      await fs.rm(path.join(this.certsDir, 'keys'), { recursive: true, force: true });
    }
    await generateCa(this.certsDir);
  }

  private async localCaSearchNames(): Promise<string[]> {
    const localCn = await readCaCommonName(this.caCertPath());
    return [...new Set([CA_COMMON_NAME, localCn].filter(Boolean) as string[])];
  }

  private async findLocalCaInLoginKeychain(): Promise<string | null> {
    const loginKeychain = await getLoginKeychainPath();
    const localSha1 = await readSha1HexFromPemFile(this.caCertPath());
    const names = await this.localCaSearchNames();
    return findMatchingLocalCaInKeychain(loginKeychain, localSha1, names);
  }

  private async isTrustedInLoginKeychain(): Promise<boolean> {
    try {
      const loginKeychain = await getLoginKeychainPath();
      const pem = await this.findLocalCaInLoginKeychain();
      if (!pem) return false;
      const tmpPem = path.join('/tmp', 'yanshuf-ca-verify.pem');
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
        loginKeychain,
      ]);
      return true;
    } catch {
      return false;
    }
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

  async getStatus(): Promise<CertStatus> {
    try {
      await this.ensureCaGenerated();
      const commonName = await readCaCommonName(this.caCertPath());
      const inLogin = await this.findLocalCaInLoginKeychain();

      if (!inLogin) {
        return {
          exists: true,
          trusted: 'unknown',
          caPath: this.caCertPath(),
          commonName,
          keychainLocation: 'none',
        };
      }

      const trusted = await this.isTrustedInLoginKeychain();
      return {
        exists: true,
        trusted: trusted ? 'installed' : 'untrusted',
        caPath: this.caCertPath(),
        commonName,
        keychainLocation: 'login',
      };
    } catch {
      return { exists: false, trusted: 'unknown', keychainLocation: 'none' };
    }
  }

  /**
   * Import root CA into the login keychain. macOS requires a manual
   * "Always Trust" step afterward — Electron cannot set that automatically.
   */
  async installToLoginKeychain(): Promise<CertInstallResult> {
    if (process.platform !== 'darwin') {
      throw new Error('Keychain install is only supported on macOS');
    }

    await this.writeCerFile(INSTALL_CER_PATH);
    const loginKeychain = await getLoginKeychainPath();

    const alreadyInstalled = await this.findLocalCaInLoginKeychain();
    if (alreadyInstalled) {
      const trusted = await this.isTrustedInLoginKeychain();
      if (!trusted) {
        await this.openKeychainAccess();
      }
      return { alreadyInstalled: true, needsManualTrust: !trusted };
    }

    await deleteCertByName(loginKeychain, CA_COMMON_NAME);

    try {
      await execFileAsync('security', ['add-certificates', '-k', loginKeychain, INSTALL_CER_PATH]);
      await execFileAsync('security', [
        'find-certificate',
        '-c',
        CA_COMMON_NAME,
        '-p',
        loginKeychain,
      ]);
    } catch (err) {
      const inLogin = await this.findLocalCaInLoginKeychain();
      if (!inLogin) {
        if (isCertAlreadyExistsError(err)) {
          throw new Error(
            `${CA_COMMON_NAME} already exists in your login keychain but could not be verified. Remove it in Keychain Access and try again.`,
          );
        }
        throw err;
      }
    }

    const trusted = await this.isTrustedInLoginKeychain();
    if (!trusted) {
      await this.openKeychainAccess();
    }
    return { alreadyInstalled: false, needsManualTrust: !trusted };
  }

  async openKeychainAccess(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('Keychain Access is only available on macOS');
    }

    await execFileAsync('osascript', ['-e', 'tell application "Keychain Access" to activate']);

    const loginKeychain = await getLoginKeychainPath();
    try {
      await execFileAsync('open', ['-a', 'Keychain Access', loginKeychain]);
      return;
    } catch {
      // fall through
    }

    try {
      await execFileAsync('open', ['-a', 'Keychain Access']);
    } catch {
      const result = await shell.openPath(KEYCHAIN_ACCESS);
      if (result) {
        throw new Error(`Could not open Keychain Access: ${result}`);
      }
    }
  }

  /** Export .cer for manual install (fallback). */
  async exportCertificate(): Promise<string> {
    const downloads = path.join(process.env.HOME ?? '', 'Downloads');
    const dest = path.join(downloads, CA_EXPORT_FILENAME);
    await this.writeCerFile(dest);
    await this.openKeychainAccess();
    await shell.showItemInFolder(dest);
    return dest;
  }

  async verifyTrust(): Promise<{ trusted: boolean; error?: string }> {
    const inLogin = await this.findLocalCaInLoginKeychain();
    if (!inLogin) {
      return {
        trusted: false,
        error: 'Certificate not found in your login keychain. Click Install first.',
      };
    }

    const trusted = await this.isTrustedInLoginKeychain();
    if (!trusted) {
      return {
        trusted: false,
        error: `Certificate is installed but not trusted. Double-click ${CA_COMMON_NAME} in Keychain Access → Trust → Always Trust.`,
      };
    }

    return { trusted: true };
  }

  async uninstallFromKeychain(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('Keychain uninstall is only supported on macOS');
    }

    const loginKeychain = await getLoginKeychainPath();
    await deleteCertByName(loginKeychain, CA_COMMON_NAME);
  }

  async resetCa(): Promise<CertStatus> {
    const certsFolder = path.join(this.certsDir, 'certs');
    const keysFolder = path.join(this.certsDir, 'keys');

    await fs.rm(certsFolder, { recursive: true, force: true });
    await fs.rm(keysFolder, { recursive: true, force: true });
    await generateCa(this.certsDir);
    return this.getStatus();
  }
}

export { getCaCommonNameFromPem } from './generate-ca';
