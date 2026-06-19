import { toast } from 'sonner';

export function notifyDeleted(subject: string): void {
  toast.success(`${subject} deleted`);
}

export function notifyCleared(subject: string): void {
  toast.success(`${subject} cleared`);
}

export function notifyRemoved(subject: string): void {
  toast.success(`${subject} removed`);
}

export function notifyApplied(subject: string, description?: string): void {
  toast.success(`${subject} applied`, description ? { description } : undefined);
}

export function notifySaved(subject: string): void {
  toast.success(`${subject} saved`);
}

export function notifyActionFailed(action: string, error?: unknown): void {
  const detail = error instanceof Error ? error.message : undefined;
  toast.error(detail ? `Could not ${action}: ${detail}` : `Could not ${action}`);
}

export async function clearCapturedRequests(options?: { toast?: boolean }): Promise<void> {
  const showToast = options?.toast ?? true;
  try {
    await window.yanshuf.capture.clear();
    if (showToast) notifyCleared('Captured requests');
  } catch (error) {
    if (showToast) notifyActionFailed('clear captured requests', error);
    else throw error;
  }
}
