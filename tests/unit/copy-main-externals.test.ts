import { describe, expect, it } from 'vitest';
import { collectDependencyTree, MAIN_EXTERNALS } from '../../scripts/copy-main-externals';

describe('copy-main-externals', () => {
  it('includes http-mitm-proxy and its production dependencies', () => {
    const packages = collectDependencyTree(MAIN_EXTERNALS);
    expect(packages).toContain('http-mitm-proxy');
    expect(packages).toContain('ws');
    expect(packages).toContain('async');
  });
});
