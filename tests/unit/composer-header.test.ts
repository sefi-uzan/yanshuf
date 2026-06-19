import { describe, expect, it } from 'vitest';
import {
  isComposerCaptureHeader,
  stripComposerCaptureHeader,
  YANSHUF_COMPOSER_HEADER,
} from '../../src/shared/composer';

describe('composer capture header', () => {
  it('detects the composer marker header regardless of casing', () => {
    expect(isComposerCaptureHeader({ [YANSHUF_COMPOSER_HEADER]: '1' })).toBe(true);
    expect(isComposerCaptureHeader({ 'X-Yanshuf-Composer': 'true' })).toBe(true);
  });

  it('strips the composer marker header from captured requests', () => {
    expect(
      stripComposerCaptureHeader({
        host: 'api.example.com',
        [YANSHUF_COMPOSER_HEADER]: '1',
      }),
    ).toEqual({ host: 'api.example.com' });
  });
});
