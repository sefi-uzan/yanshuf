import { useEffect } from 'react';
import { toast } from 'sonner';
import type { AppNotifyPayload } from '@yanshuf/shared';

function toastAction(payload: AppNotifyPayload): Parameters<typeof toast.info>[1] | undefined {
  const { description, externalUrl, externalLabel, action, actionLabel } = payload;
  const options: Parameters<typeof toast.info>[1] = description ? { description } : undefined;

  if (action === 'install-update') {
    return {
      ...options,
      action: {
        label: actionLabel ?? 'Restart & update',
        onClick: () => void window.yanshuf.app.installUpdate(),
      },
    };
  }

  if (!externalUrl) return options;

  return {
    ...options,
    action: {
      label: externalLabel ?? 'Open',
      onClick: () => void window.yanshuf.app.openExternal(externalUrl),
    },
  };
}

export function useAppNotify(): void {
  useEffect(() => {
    return window.yanshuf.app.onNotify((payload: AppNotifyPayload) => {
      const { title, variant = 'error' } = payload;
      const options = toastAction(payload);

      if (variant === 'success') toast.success(title, options);
      else if (variant === 'info') toast.info(title, options);
      else toast.error(title, options);
    });
  }, []);
}
