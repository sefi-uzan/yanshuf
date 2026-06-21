import type { BrowserWindow } from 'electron';
import type { AppNotifyPayload } from '@yanshuf/shared';
import { IPC_CHANNELS } from '@yanshuf/shared';

let getMainWindow: () => BrowserWindow | null = () => null;
const recent = new Map<string, number>();
const DEDUP_MS = 10_000;

export function bindNotifyWindow(getter: () => BrowserWindow | null): void {
  getMainWindow = getter;
}

export function notifyRenderer(payload: AppNotifyPayload): void {
  const key = `${payload.variant ?? 'error'}:${payload.title}:${payload.description ?? ''}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUP_MS) return;
  recent.set(key, now);

  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.APP_NOTIFY, payload);
  }
}
