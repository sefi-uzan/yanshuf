import { useEffect, useRef } from 'react';
import type { CertStatus } from '@yanshuf/shared';

const POLL_INTERVAL_MS = 2000;

interface UseCertStatusPollingOptions {
  enabled: boolean;
  onStatusChange?: (status: CertStatus) => void;
  onTrusted?: () => void;
}

export function useCertStatusPolling({
  enabled,
  onStatusChange,
  onTrusted,
}: UseCertStatusPollingOptions): void {
  const wasTrustedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const poll = async () => {
      const status = await window.yanshuf.cert.status();
      if (cancelled) return;
      onStatusChange?.(status);
      if (status.trusted === 'installed' && !wasTrustedRef.current) {
        wasTrustedRef.current = true;
        onTrusted?.();
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, onStatusChange, onTrusted]);
}
