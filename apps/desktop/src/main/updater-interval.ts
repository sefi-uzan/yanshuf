const FLAG_PREFIX = '--update-check-interval=';

export function parseUpdateCheckInterval(argv: string[]): number | null {
  const arg = argv.find((entry) => entry.startsWith(FLAG_PREFIX));
  if (!arg) return null;

  const seconds = Number(arg.slice(FLAG_PREFIX.length));
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  return Math.round(seconds * 1000);
}
