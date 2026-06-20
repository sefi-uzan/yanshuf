import type { CertStatus } from '../../shared/types';

interface CertNotTrustedPayload {
  name?: string;
  message?: string;
  status?: CertStatus;
}

export function isCertNotTrustedError(err: unknown): err is CertNotTrustedPayload {
  if (err instanceof Error) {
    return err.name === 'CertNotTrustedError' || err.message === 'Certificate is not trusted';
  }
  if (typeof err === 'object' && err !== null) {
    const payload = err as CertNotTrustedPayload;
    return payload.name === 'CertNotTrustedError' || payload.message === 'Certificate is not trusted';
  }
  return false;
}

export function getCertStatusFromError(err: unknown): CertStatus | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    return (err as CertNotTrustedPayload).status;
  }
  return undefined;
}

export async function withCertGate<T>(
  action: () => Promise<T>,
  onBlocked: () => void,
): Promise<T | null> {
  try {
    return await action();
  } catch (err) {
    if (isCertNotTrustedError(err)) {
      onBlocked();
      return null;
    }
    throw err;
  }
}
