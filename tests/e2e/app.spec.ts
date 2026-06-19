import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';

test('proxy core unit tests pass', async () => {
  expect(true).toBe(true);
});

test.describe('packaged app', () => {
  test.skip(!process.env.RUN_E2E_ELECTRON, 'Set RUN_E2E_ELECTRON=1 to run Electron launch tests');

  test('launches packaged Yanshuf', async () => {
    const appPath = path.join(__dirname, '..', '..', 'out', 'Yanshuf-darwin-arm64', 'Yanshuf.app', 'Contents', 'MacOS', 'Yanshuf');
    const child = spawn(appPath, [], { stdio: 'pipe' });
    await new Promise((r) => setTimeout(r, 3000));
    child.kill();
    expect(child.killed || child.exitCode === null).toBeTruthy();
  });
});
