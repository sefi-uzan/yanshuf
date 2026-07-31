import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings } from '@yanshuf/shared';
import { DEFAULT_SETTINGS } from '@yanshuf/shared';
import { notifyActionFailed } from '@/lib/toast-actions';

/** Long enough to coalesce a burst of toggles, short enough to feel immediate. */
const SAVE_DEBOUNCE_MS = 300;

/**
 * Settings apply as you change them. Local state updates optimistically and the
 * IPC write is debounced, so there is no save button and no dirty state to track.
 */
export function useAppSettings(active: boolean) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const pendingRef = useRef<AppSettings | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    try {
      await window.yanshuf.settings.save(pending);
    } catch (error) {
      notifyActionFailed('save settings', error);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void window.yanshuf.settings.get().then((next) => {
      setSettings(next);
      setLoaded(true);
    });
  }, [active]);

  // A pending write must not be lost when the panel closes or the app quits.
  useEffect(() => {
    if (active) return;
    void flush();
  }, [active, flush]);

  useEffect(() => {
    const onUnload = () => void flush();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      void flush();
    };
  }, [flush]);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      pendingRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) {
          void window.yanshuf.settings
            .save(pending)
            .catch((error) => notifyActionFailed('save settings', error));
        }
      }, SAVE_DEBOUNCE_MS);
      return next;
    });
  }, []);

  return { settings, loaded, update, flush };
}
