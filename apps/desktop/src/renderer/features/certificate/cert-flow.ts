import type { CertStatus } from '@yanshuf/shared';

export const CA_COMMON_NAME = 'Yanshuf Root CA';

export type CertFlowStep = 'install' | 'trust' | 'ready';

export const CERT_FLOW_STEPS: { id: CertFlowStep; label: string }[] = [
  { id: 'install', label: 'Install' },
  { id: 'trust', label: 'Trust' },
  { id: 'ready', label: 'Ready' },
];

export function getCertFlowStep(trusted: CertStatus['trusted']): CertFlowStep {
  if (trusted === 'installed') return 'ready';
  if (trusted === 'untrusted') return 'trust';
  return 'install';
}

export function isCertFlowStepComplete(step: CertFlowStep, trusted: CertStatus['trusted']): boolean {
  if (step === 'install') return trusted !== 'unknown';
  if (step === 'trust') return trusted === 'installed';
  return trusted === 'installed';
}
