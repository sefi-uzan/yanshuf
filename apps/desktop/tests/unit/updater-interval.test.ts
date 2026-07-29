import { describe, expect, it } from 'vitest';
import { parseUpdateCheckInterval } from '../../src/main/updater-interval';

describe('parseUpdateCheckInterval', () => {
  it('returns null when the flag is missing', () => {
    expect(parseUpdateCheckInterval(['/Applications/Yanshuf.app/Contents/MacOS/Yanshuf'])).toBeNull();
  });

  it('converts seconds to milliseconds', () => {
    expect(parseUpdateCheckInterval(['--update-check-interval=30'])).toBe(30_000);
  });

  it('returns null for invalid values', () => {
    expect(parseUpdateCheckInterval(['--update-check-interval=0'])).toBeNull();
    expect(parseUpdateCheckInterval(['--update-check-interval=abc'])).toBeNull();
    expect(parseUpdateCheckInterval(['--update-check-interval=-5'])).toBeNull();
  });
});
