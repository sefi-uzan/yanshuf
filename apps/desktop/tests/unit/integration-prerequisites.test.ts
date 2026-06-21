import { describe, expect, it } from 'vitest';
import { checkNodeOnPath } from '../../src/main/mcp-api/integration-prerequisites';
import { INTEGRATION_MIN_NODE_VERSION } from '@yanshuf/shared';

describe('checkNodeOnPath', () => {
  it('finds node on PATH with sufficient version', async () => {
    const result = await checkNodeOnPath();
    expect(result.version).toMatch(/^v?\d+/);
    if (result.ok) {
      expect(result.message).toBeUndefined();
    } else {
      expect(result.message).toContain(INTEGRATION_MIN_NODE_VERSION);
    }
  });
});
