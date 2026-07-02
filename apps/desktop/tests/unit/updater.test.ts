import { describe, expect, it } from 'vitest';
import { isNewerVersion } from '../../src/main/updater-version';

describe('isNewerVersion', () => {
  it('returns true when latest patch is higher', () => {
    expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
  });

  it('returns true when latest minor is higher', () => {
    expect(isNewerVersion('1.1.0', '1.0.9')).toBe(true);
  });

  it('returns false for equal versions', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns false when latest is older', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
  });
});
