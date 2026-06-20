import { describe, expect, it } from 'vitest';
import { CaptureStore, buildCaptureEntry, type PendingCapture } from '../../src/main/proxy/capture-store';

describe('CaptureStore', () => {
  it('evicts oldest entries when over capacity', () => {
    const store = new CaptureStore(2);
    const pending: PendingCapture = {
      id: '1',
      startedAt: Date.now(),
      method: 'GET',
      url: 'http://a.test',
      host: 'a.test',
      path: '/',
      tls: false,
      protocol: 'http1',
      requestHeaders: {},
      requestChunks: [],
    };
    store.add(buildCaptureEntry(pending, 200, {}, Buffer.alloc(0), 1024));
    pending.id = '2';
    store.add(buildCaptureEntry(pending, 200, {}, Buffer.alloc(0), 1024));
    pending.id = '3';
    store.add(buildCaptureEntry(pending, 200, {}, Buffer.alloc(0), 1024));
    expect(store.list()).toHaveLength(2);
    expect(store.list()[0].id).toBe('2');
  });

  it('marks an entry as sent from composer', () => {
    const store = new CaptureStore(10);
    const pending: PendingCapture = {
      id: 'composer-1',
      startedAt: Date.now(),
      method: 'GET',
      url: 'https://httpbin.org/get',
      host: 'httpbin.org',
      path: '/get',
      tls: true,
      protocol: 'http1',
      requestHeaders: {},
      requestChunks: [],
    };
    store.add(buildCaptureEntry(pending, 200, {}, Buffer.alloc(0), 1024));
    expect(store.list()[0].fromComposer).toBeUndefined();
    expect(store.markFromComposer('composer-1')).toBe(true);
    expect(store.list()[0].fromComposer).toBe(true);
  });
});
