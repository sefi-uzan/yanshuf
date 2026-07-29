import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type NotarizeCredentials = {
  appleId: string;
  appleIdPassword: string;
  teamId: string;
};

export function notarizeCredentialsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): NotarizeCredentials | null {
  const appleId = env.APPLE_ID;
  const appleIdPassword = env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = env.APPLE_TEAM_ID;
  if (!appleId || !appleIdPassword || !teamId) return null;
  return { appleId, appleIdPassword, teamId };
}

/**
 * Gatekeeper assesses the downloaded .dmg itself, not only the .app inside it, so the
 * disk image needs its own notarization submission and stapled ticket on top of the
 * app-level notarization that @electron/packager performs.
 */
export async function notarizeAndStapleDmg(
  dmgPath: string,
  { appleId, appleIdPassword, teamId }: NotarizeCredentials,
): Promise<void> {
  const { stdout } = await execFileAsync(
    'xcrun',
    [
      'notarytool',
      'submit',
      dmgPath,
      '--apple-id',
      appleId,
      '--password',
      appleIdPassword,
      '--team-id',
      teamId,
      '--wait',
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );

  // notarytool has shipped versions that exit 0 on a rejected submission, so trust the
  // reported status rather than the exit code.
  if (!/status:\s*Accepted/i.test(stdout)) {
    throw new Error(`Notarization failed for ${path.basename(dmgPath)}:\n${stdout}`);
  }

  await execFileAsync('xcrun', ['stapler', 'staple', dmgPath]);
}
