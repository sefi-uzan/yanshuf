import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { shell } from 'electron';
import forge from 'node-forge';
import type { CertStatus } from '@yanshuf/shared';
import {
  CA_COMMON_NAME,
  CA_EXPORT_FILENAME,
  INSTALL_CER_PATH,
  KEYCHAIN_ACCESS,
  SYSTEM_KEYCHAIN,
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
  /** The CA was already trusted; no prompt was shown. */
  alreadyTrusted: boolean;
  /** The CA is trusted after this call. */
  trusted: boolean;
}

/** Thrown when the user dismisses the macOS trust authorization prompt. */
export class TrustDeniedError extends Error {
  constructor() {
    super('Setup was cancelled, so the certificate was not trusted.');
    this.name = 'TrustDeniedError';
  }
}

function errorText(err: unknown): string {
  const stderr =
    err && typeof err === 'object' && 'stderr' in err
      ? String((err as NodeJS.ErrnoException & { stderr?: string }).stderr ?? '')
      : '';
  return `${err instanceof Error ? err.message : String(err)}\n${stderr}`;
}

function isUserCancelled(err: unknown): boolean {
  // errAuthorizationCanceled (-60006) / user dismissing the SecurityAgent panel.
  return /cancel|-60006|-128|User interaction is not allowed/i.test(errorText(err));
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

  /**
   * Locate the local CA in a keychain. Prefers the login keychain (where
   * auto-trust installs it) and falls back to the System keychain so an
   * untrusted copy left behind by an older/failed admin install is still
   * recognized for status reporting.
   */
  private async findLocalCa(): Promise<{ pem: string; location: 'login' | 'system' } | null> {
    const localSha1 = await readSha1HexFromPemFile(this.caCertPath());
    const names = await this.localCaSearchNames();

    const loginKeychain = await getLoginKeychainPath();
    const inLogin = await findMatchingLocalCaInKeychain(loginKeychain, localSha1, names);
    if (inLogin) return { pem: inLogin, location: 'login' };

    const inSystem = await findMatchingLocalCaInKeychain(SYSTEM_KEYCHAIN, localSha1, names);
    if (inSystem) return { pem: inSystem, location: 'system' };

    return null;
  }

  /**
   * Authoritative trust check: ask macOS whether the CA satisfies the SSL trust
   * policy. No `-r` self-anchor, so this reflects real keychain trust settings
   * and is true only once the root is genuinely trusted.
   */
  private async isCaTrusted(pem: string): Promise<boolean> {
    try {
      const tmpPem = path.join(os.tmpdir(), 'yanshuf-ca-verify.pem');
      await fs.writeFile(tmpPem, pem, { mode: 0o644 });
      // `-l` lets the root be evaluated as the leaf certificate.
      await execFileAsync('security', ['verify-cert', '-c', tmpPem, '-l', '-p', 'ssl']);
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
      const found = await this.findLocalCa();

      if (!found) {
        return {
          exists: true,
          trusted: 'unknown',
          caPath: this.caCertPath(),
          commonName,
          keychainLocation: 'none',
        };
      }

      const trusted = await this.isCaTrusted(found.pem);
      return {
        exists: true,
        trusted: trusted ? 'installed' : 'untrusted',
        caPath: this.caCertPath(),
        commonName,
        keychainLocation: found.location,
      };
    } catch {
      return { exists: false, trusted: 'unknown', keychainLocation: 'none' };
    }
  }

  /**
   * Install the root CA into the login keychain and mark it trusted for the
   * current user in a single step.
   *
   * Runs `security add-trusted-cert` directly (not through
   * `osascript … with administrator privileges`). The trust-settings prompt can
   * only be shown to a process attached to the GUI session; the osascript
   * privilege trampoline runs detached and fails with "no user interaction was
   * possible". As a direct child of the app we inherit the GUI session, so macOS
   * presents its own authorization panel. The user (login) trust domain needs
   * only the user's password — no admin rights and no System keychain writes.
   */
  async install(): Promise<CertInstallResult> {
    if (process.platform !== 'darwin') {
      throw new Error('Certificate install is only supported on macOS');
    }

    await this.ensureCaGenerated();

    const existing = await this.findLocalCa();
    if (existing && (await this.isCaTrusted(existing.pem))) {
      return { alreadyTrusted: true, trusted: true };
    }

    const cerPath = await this.writeCerFile(INSTALL_CER_PATH);
    const loginKeychain = await getLoginKeychainPath();

    try {
      // No `-d`: target the per-user trust domain. `-r trustRoot` marks the CA
      // as a trusted anchor. `-k` imports the cert into the login keychain.
      await execFileAsync('security', [
        'add-trusted-cert',
        '-r',
        'trustRoot',
        '-k',
        loginKeychain,
        cerPath,
      ]);
    } catch (err) {
      if (isUserCancelled(err)) {
        throw new TrustDeniedError();
      }
      throw err;
    }

    const found = await this.findLocalCa();
    const trusted = found ? await this.isCaTrusted(found.pem) : false;
    return { alreadyTrusted: false, trusted };
  }

  async openKeychainAccess(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('Keychain Access is only available on macOS');
    }

    await execFileAsync('osascript', ['-e', 'tell application "Keychain Access" to activate']);

    try {
      await execFileAsync('open', ['-a', 'Keychain Access']);
      return;
    } catch {
      // fall through
    }

    const result = await shell.openPath(KEYCHAIN_ACCESS);
    if (result) {
      throw new Error(`Could not open Keychain Access: ${result}`);
    }
  }

  /** Export .cer for manual install (fallback). */
  async exportCertificate(): Promise<string> {
    const downloads = path.join(process.env.HOME ?? '', 'Downloads');
    const dest = path.join(downloads, CA_EXPORT_FILENAME);
    await this.writeCerFile(dest);
    await shell.showItemInFolder(dest);
    return dest;
  }

  async verifyTrust(): Promise<{ trusted: boolean; error?: string }> {
    const found = await this.findLocalCa();
    if (!found) {
      return {
        trusted: false,
        error: 'Certificate is not installed. Click Set up to install and trust it.',
      };
    }

    const trusted = await this.isCaTrusted(found.pem);
    if (!trusted) {
      return {
        trusted: false,
        error: `${CA_COMMON_NAME} is installed but not trusted. Click Set up to trust it.`,
      };
    }

    return { trusted: true };
  }

  async uninstallFromKeychain(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('Keychain uninstall is only supported on macOS');
    }

    const cerPath = await this.writeCerFile(INSTALL_CER_PATH).catch(() => null);

    // Remove the per-user trust setting (may prompt for the user's password).
    if (cerPath) {
      await execFileAsync('security', ['remove-trusted-cert', cerPath]).catch(() => undefined);
    }

    // Delete the certificate from the login keychain (no prompt).
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
