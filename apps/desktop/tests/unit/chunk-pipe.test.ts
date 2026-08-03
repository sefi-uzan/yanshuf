import { describe, expect, it } from 'vitest';
import { ChunkPipe } from '../../src/main/proxy/chunk-pipe';
import { SessionThrottle } from '../../src/main/proxy/throttle';

describe('ChunkPipe', () => {
  it('forwards synchronously when no throttle is active', () => {
    const pipe = new ChunkPipe('download', () => undefined);
    const forwarded: Buffer[] = [];

    pipe.write(Buffer.from('a'), (_err, chunk) => forwarded.push(chunk!));
    pipe.write(Buffer.from('b'), (_err, chunk) => forwarded.push(chunk!));

    expect(forwarded.map((c) => c.toString())).toEqual(['a', 'b']);
    expect(pipe.drain()).toBeNull();
  });

  it('drains every throttled chunk before the end handler runs', async () => {
    const throttle = new SessionThrottle(0, 8);
    const pipe = new ChunkPipe('download', () => throttle);
    const forwarded: string[] = [];

    for (const label of ['a', 'b', 'c']) {
      pipe.write(Buffer.alloc(256, label), (_err, chunk) => {
        forwarded.push(chunk!.subarray(0, 1).toString());
      });
    }

    expect(forwarded).toEqual([]);
    await pipe.drain();
    expect(forwarded).toEqual(['a', 'b', 'c']);
  });

  it('reports a throttle failure on the chunk that caused it', async () => {
    const failing = {
      throttleUpload: () => Promise.reject(new Error('nope')),
      throttleDownload: () => Promise.resolve(),
    } as unknown as SessionThrottle;
    const pipe = new ChunkPipe('upload', () => failing);

    let seen: Error | null | undefined;
    pipe.write(Buffer.from('a'), (err) => {
      seen = err;
    });

    await pipe.drain();
    expect(seen).toBeInstanceOf(Error);
  });
});
