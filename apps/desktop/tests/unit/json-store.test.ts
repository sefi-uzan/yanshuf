import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { JsonFileStore } from '../../src/main/storage/json-store';

let baseDir: string;
let store: JsonFileStore;

beforeEach(async () => {
  baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yanshuf-store-'));
  store = new JsonFileStore(baseDir);
  await store.init();
});

afterEach(async () => {
  await fs.rm(baseDir, { recursive: true, force: true });
});

describe('JsonFileStore', () => {
  it('round-trips a value', async () => {
    await store.write('settings.json', { port: 8888 });
    expect(await store.read('settings.json', {})).toEqual({ port: 8888 });
  });

  it('falls back when the file is missing', async () => {
    expect(await store.read('nope.json', { fallback: true })).toEqual({ fallback: true });
  });

  it('survives concurrent writes to the same file', async () => {
    // Settings save as the user edits, so overlapping writes are routine. These
    // used to share one pid-based temp name and the loser's rename hit ENOENT.
    await expect(
      Promise.all([
        store.write('settings.json', { n: 1 }),
        store.write('settings.json', { n: 2 }),
        store.write('settings.json', { n: 3 }),
      ]),
    ).resolves.toBeDefined();

    expect(await store.read('settings.json', {})).toEqual({ n: 3 });
  });

  it('applies concurrent writes in call order', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => store.write('settings.json', { n: i })),
    );

    expect(await store.read('settings.json', {})).toEqual({ n: 19 });
  });

  it('leaves no temp files behind', async () => {
    await Promise.all([
      store.write('settings.json', { n: 1 }),
      store.write('settings.json', { n: 2 }),
    ]);

    const leftovers = (await fs.readdir(baseDir)).filter((f) => f.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
  });

  it('keeps writes to different files independent', async () => {
    await Promise.all([
      store.write('a.json', { a: 1 }),
      store.write('b.json', { b: 2 }),
    ]);

    expect(await store.read('a.json', {})).toEqual({ a: 1 });
    expect(await store.read('b.json', {})).toEqual({ b: 2 });
  });
});
