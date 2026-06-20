import { useEffect } from 'react';
import { toast } from 'sonner';
import type { AppNotifyPayload } from '@yanshuf/shared';

export function useAppNotify(): void {
  useEffect(() => {
    return window.yanshuf.app.onNotify((payload: AppNotifyPayload) => {
      const { title, description, variant = 'error' } = payload;
      const options = description ? { description } : undefined;
      if (variant === 'success') toast.success(title, options);
      else if (variant === 'info') toast.info(title, options);
      else toast.error(title, options);
    });
  }, []);
}
