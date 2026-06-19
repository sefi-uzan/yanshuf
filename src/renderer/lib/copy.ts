export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/** Best-effort convert an exact-match URL regex back to a plain URL for copying. */
export function urlFromMatchRegex(regex: string): string {
  if (!regex) return '';

  let value = regex;
  if (value.startsWith('^')) value = value.slice(1);
  if (value.endsWith('$')) value = value.slice(0, -1);

  if (/^https?:[/\\]/.test(value)) {
    return value.replace(/\\(.)/g, '$1');
  }

  return regex;
}
