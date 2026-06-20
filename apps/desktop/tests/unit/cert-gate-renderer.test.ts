import { describe, expect, it } from 'vitest';
import { getCertStatusFromError, isCertNotTrustedError } from '../../src/renderer/lib/cert-gate';

describe('renderer cert-gate', () => {
  it('detects CertNotTrustedError by name', () => {
    expect(isCertNotTrustedError({ name: 'CertNotTrustedError', message: 'Certificate is not trusted' })).toBe(true);
  });

  it('detects CertNotTrustedError by message', () => {
    expect(isCertNotTrustedError(new Error('Certificate is not trusted'))).toBe(true);
  });

  it('rejects unrelated errors', () => {
    expect(isCertNotTrustedError(new Error('Network failed'))).toBe(false);
    expect(isCertNotTrustedError(null)).toBe(false);
  });

  it('extracts status from IPC error payload', () => {
    const status = { exists: true, trusted: 'unknown' as const };
    expect(getCertStatusFromError({ name: 'CertNotTrustedError', status })).toEqual(status);
  });
});
