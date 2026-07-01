import { describe, expect, it } from 'vitest';
import {
  getInitialStep,
  getStepperFlowStep,
  isIntegrationStepComplete,
  verifyAllCritical,
} from '../../src/renderer/features/integration/integration-flow';
import type { IntegrationPrerequisites, IntegrationVerifyResult } from '@yanshuf/shared';

describe('integration-flow', () => {
  it('skips prerequisites when all met', () => {
    const prereqs: IntegrationPrerequisites = {
      node: { ok: true, version: 'v22.0.0' },
      cert: { ok: true },
      allMet: true,
    };
    expect(getInitialStep(prereqs)).toBe(1);
  });

  it('starts at prerequisites when unmet', () => {
    const prereqs: IntegrationPrerequisites = {
      node: { ok: false, message: 'missing' },
      cert: { ok: true },
      allMet: false,
    };
    expect(getInitialStep(prereqs)).toBe(0);
  });

  it('verify step complete without node when MCP, skill, and hook pass', () => {
    const withoutNode: IntegrationVerifyResult = {
      mcpConfigured: true,
      skillInstalled: true,
      hookInstalled: true,
      apiReachable: false,
      certTrusted: false,
      nodeOk: false,
      details: [],
    };
    expect(isIntegrationStepComplete('verify', 4, withoutNode)).toBe(true);
    expect(verifyAllCritical(withoutNode)).toBe(true);
  });

  it('shows verify as current after hook installed on step 3', () => {
    expect(getStepperFlowStep(3, true)).toBe('verify');
    expect(isIntegrationStepComplete('hook', 3, null, true)).toBe(true);
    expect(isIntegrationStepComplete('verify', 3, null, true)).toBe(false);
  });
});
