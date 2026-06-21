import { toast } from 'sonner';

export const COPY_SUCCESS_MESSAGE = 'Copied to clipboard';

/** Origin + pathname, without query string or hash. */
export function urlWithoutQuery(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    const queryIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');
    const end =
      queryIndex >= 0 && hashIndex >= 0
        ? Math.min(queryIndex, hashIndex)
        : queryIndex >= 0
          ? queryIndex
          : hashIndex >= 0
            ? hashIndex
            : url.length;
    return url.slice(0, end);
  }
}

export async function copyToClipboard(
  text: string,
  options?: { toast?: boolean; message?: string },
): Promise<boolean> {
  if (!text) return false;
  const showToast = options?.toast ?? true;
  const message = options?.message ?? COPY_SUCCESS_MESSAGE;

  const notify = (ok: boolean) => {
    if (!showToast) return;
    if (ok) toast.success(message);
    else toast.error('Failed to copy to clipboard');
  };

  try {
    await navigator.clipboard.writeText(text);
    notify(true);
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
      notify(true);
      return true;
    } catch {
      notify(false);
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
