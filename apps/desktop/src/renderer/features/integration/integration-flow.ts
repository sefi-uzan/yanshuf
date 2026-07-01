import type { IntegrationPrerequisites, IntegrationVerifyResult } from '@yanshuf/shared';

export type IntegrationFlowStep = 'prerequisites' | 'mcp' | 'skills' | 'hook' | 'verify';

export const INTEGRATION_FLOW_STEPS: { id: IntegrationFlowStep; label: string }[] = [
  { id: 'prerequisites', label: 'Setup' },
  { id: 'mcp', label: 'MCP' },
  { id: 'skills', label: 'Skills' },
  { id: 'hook', label: 'Hook' },
  { id: 'verify', label: 'Verify' },
];

export type WizardStepIndex = 0 | 1 | 2 | 3 | 4;

export function stepIndexToFlowStep(step: WizardStepIndex): IntegrationFlowStep {
  const map: IntegrationFlowStep[] = ['prerequisites', 'mcp', 'skills', 'hook', 'verify'];
  return map[step];
}

export function getInitialStep(prereqs: IntegrationPrerequisites): WizardStepIndex {
  return prereqs.allMet ? 1 : 0;
}

export function getStepperFlowStep(step: WizardStepIndex, hookInstalled: boolean): IntegrationFlowStep {
  if (step === 3 && hookInstalled) return 'verify';
  return stepIndexToFlowStep(step);
}

export function isIntegrationStepComplete(
  step: IntegrationFlowStep,
  currentStep: WizardStepIndex,
  verify: IntegrationVerifyResult | null,
  hookInstalled = false,
): boolean {
  const stepOrder: IntegrationFlowStep[] = ['prerequisites', 'mcp', 'skills', 'hook', 'verify'];
  const current = getStepperFlowStep(currentStep, hookInstalled);
  const currentIdx = stepOrder.indexOf(current);
  const stepIdx = stepOrder.indexOf(step);
  if (stepIdx < currentIdx) return true;
  if (step === 'hook' && hookInstalled && currentStep === 3) return true;
  if (step === 'verify') {
    return Boolean(
      verify &&
        verify.mcpConfigured &&
        verify.skillInstalled &&
        verify.hookInstalled,
    );
  }
  return false;
}

export function verifyAllCritical(verify: IntegrationVerifyResult): boolean {
  return verify.mcpConfigured && verify.skillInstalled && verify.hookInstalled;
}
