import type { CertStatus } from '@yanshuf/shared';
import type { CertificateManager } from './manager';

export class CertNotTrustedError extends Error {
  status: CertStatus;

  constructor(status: CertStatus) {
    super('Certificate is not trusted');
    this.name = 'CertNotTrustedError';
    this.status = status;
  }
}

export async function assertCertTrusted(certManager: CertificateManager): Promise<CertStatus> {
  const status = await certManager.getStatus();
  if (status.trusted !== 'installed') {
    throw new CertNotTrustedError(status);
  }
  return status;
}

/** Re-throw cert gate errors in a shape Electron IPC preserves for the renderer. */
export function rethrowCertIpcError(err: unknown): never {
  if (err instanceof CertNotTrustedError) {
    throw { name: 'CertNotTrustedError', message: err.message, status: err.status };
  }
  throw err;
}
