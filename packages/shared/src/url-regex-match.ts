export function matchesUrlRegex(pattern: string | undefined, url: string): boolean {
  const trimmed = pattern?.trim();
  if (!trimmed) return false;
  try {
    return new RegExp(trimmed, 'i').test(url);
  } catch {
    return false;
  }
}
