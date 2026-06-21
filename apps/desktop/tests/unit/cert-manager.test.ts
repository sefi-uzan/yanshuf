import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CA_COMMON_NAME } from '../../src/main/cert/constants';
import { assertCertTrusted, CertNotTrustedError } from '../../src/main/cert/cert-gate';
import {
  caFilesExist,
  generateCa,
  getCaCommonNameFromPem,
  readCaCommonName,
  sha1HexFromPem,
} from '../../src/main/cert/generate-ca';
import { CertificateManager } from '../../src/main/cert/manager';

describe('generateCa', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('writes ca.pem and key files with Yanshuf branding', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yanshuf-ca-'));
    await generateCa(tmpDir);

    expect(await caFilesExist(tmpDir)).toBe(true);
    const cn = await readCaCommonName(path.join(tmpDir, 'certs', 'ca.pem'));
    expect(cn).toBe(CA_COMMON_NAME);
  });

  it('reads common name from PEM', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yanshuf-ca-'));
    await generateCa(tmpDir);
    const pem = await fs.readFile(path.join(tmpDir, 'certs', 'ca.pem'), 'utf8');
    expect(getCaCommonNameFromPem(pem)).toBe(CA_COMMON_NAME);
  });

  it('computes stable SHA-1 fingerprint from PEM', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yanshuf-ca-'));
    await generateCa(tmpDir);
    const pem = await fs.readFile(path.join(tmpDir, 'certs', 'ca.pem'), 'utf8');
    const a = sha1HexFromPem(pem);
    const b = sha1HexFromPem(pem);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9A-F]{40}$/);
  });
});

describe('CertificateManager.ensureCaGenerated', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('regenerates CA when on-disk CN is not Yanshuf Root CA', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yanshuf-mgr-'));
    await generateCa(tmpDir);
    const caPath = path.join(tmpDir, 'certs', 'ca.pem');
    let pem = await fs.readFile(caPath, 'utf8');
    pem = pem.replace(/CN=Yanshuf Root CA/g, 'CN=NodeMITMProxyCA');
    await fs.writeFile(caPath, pem);

    const manager = new CertificateManager(tmpDir);
    await manager.ensureCaGenerated();

    expect(await readCaCommonName(caPath)).toBe(CA_COMMON_NAME);
  });
});

describe('assertCertTrusted', () => {
  it('throws CertNotTrustedError when certificate is not trusted', async () => {
    const manager = {
      getStatus: async () => ({
        exists: true,
        trusted: 'unknown' as const,
      }),
    } as CertificateManager;

    await expect(assertCertTrusted(manager)).rejects.toBeInstanceOf(CertNotTrustedError);
  });

  it('returns status when certificate is trusted', async () => {
    const status = {
      exists: true,
      trusted: 'installed' as const,
      commonName: CA_COMMON_NAME,
    };
    const manager = {
      getStatus: async () => status,
    } as CertificateManager;

    await expect(assertCertTrusted(manager)).resolves.toEqual(status);
  });
});