import type { CertStatus } from '@yanshuf/shared';

export const CA_COMMON_NAME = 'Yanshuf Root CA';

export type CertFlowStep = 'install' | 'ready';

export const CERT_FLOW_STEPS: { id: CertFlowStep; label: string }[] = [
  { id: 'install', label: 'Install & Trust' },
  { id: 'ready', label: 'Ready' },
];

export function getCertFlowStep(trusted: CertStatus['trusted']): CertFlowStep {
  if (trusted === 'installed') return 'ready';
  return 'install';
}

export function isCertFlowStepComplete(_step: CertFlowStep, trusted: CertStatus['trusted']): boolean {
  return trusted === 'installed';
}
