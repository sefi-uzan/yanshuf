/** True when OS prefers dark, or has no explicit light preference. */
export function prefersDark(): boolean {
  return !window.matchMedia('(prefers-color-scheme: light)').matches;
}

export function applyTheme(): void {
  document.documentElement.classList.toggle('dark', prefersDark());
}

export function initTheme(): void {
  applyTheme();
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
}

export function getCodeTheme(): 'github-dark' | 'github-light' {
  return prefersDark() ? 'github-dark' : 'github-light';
}
