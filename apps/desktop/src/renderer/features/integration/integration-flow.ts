import type { IntegrationPrerequisites, IntegrationVerifyResult } from '@yanshuf/shared';

export type IntegrationFlowStep = 'prerequisites' | 'mcp' | 'skills' | 'verify';

export const INTEGRATION_FLOW_STEPS: { id: IntegrationFlowStep; label: string }[] = [
  { id: 'prerequisites', label: 'Setup' },
  { id: 'mcp', label: 'MCP' },
  { id: 'skills', label: 'Skills' },
  { id: 'verify', label: 'Verify' },
];

export type WizardStepIndex = 0 | 1 | 2 | 3;

export function stepIndexToFlowStep(step: WizardStepIndex): IntegrationFlowStep {
  const map: IntegrationFlowStep[] = ['prerequisites', 'mcp', 'skills', 'verify'];
  return map[step];
}

export function getInitialStep(prereqs: IntegrationPrerequisites): WizardStepIndex {
  return prereqs.allMet ? 1 : 0;
}

export function isIntegrationStepComplete(
  step: IntegrationFlowStep,
  currentStep: WizardStepIndex,
  verify: IntegrationVerifyResult | null,
): boolean {
  const stepOrder: IntegrationFlowStep[] = ['prerequisites', 'mcp', 'skills', 'verify'];
  const current = stepIndexToFlowStep(currentStep);
  const currentIdx = stepOrder.indexOf(current);
  const stepIdx = stepOrder.indexOf(step);
  if (stepIdx < currentIdx) return true;
  if (step === 'verify') {
    return Boolean(verify && verify.mcpConfigured && verify.skillInstalled);
  }
  return false;
}

export function verifyAllCritical(verify: IntegrationVerifyResult): boolean {
  return verify.mcpConfigured && verify.skillInstalled;
}
