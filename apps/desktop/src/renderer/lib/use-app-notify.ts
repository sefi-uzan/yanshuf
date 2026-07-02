import { useEffect } from 'react';
import { toast } from 'sonner';
import type { AppNotifyPayload } from '@yanshuf/shared';

export function useAppNotify(): void {
  useEffect(() => {
    return window.yanshuf.app.onNotify((payload: AppNotifyPayload) => {
      const { title, description, variant = 'error', externalUrl, externalLabel } = payload;
      const options: Parameters<typeof toast.info>[1] = description ? { description } : undefined;

      const withAction =
        externalUrl && options
          ? {
              ...options,
              action: {
                label: externalLabel ?? 'Open',
                onClick: () => void window.yanshuf.app.openExternal(externalUrl),
              },
            }
          : externalUrl
            ? {
                action: {
                  label: externalLabel ?? 'Open',
                  onClick: () => void window.yanshuf.app.openExternal(externalUrl),
                },
              }
            : options;

      if (variant === 'success') toast.success(title, withAction);
      else if (variant === 'info') toast.info(title, withAction);
      else toast.error(title, withAction);
    });
  }, []);
}
