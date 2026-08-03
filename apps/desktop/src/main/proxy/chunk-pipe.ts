import type { SessionThrottle } from './throttle';

export type ChunkCallback = (error?: Error | null, chunk?: Buffer) => void;

type Direction = 'upload' | 'download';

/**
 * Forwards body chunks through the MITM pipeline in arrival order.
 *
 * `http-mitm-proxy` filters ignore backpressure and close the client stream as
 * soon as their end handler returns, so a chunk callback still pending at that
 * moment is dropped and the client is left with a truncated body. Chunks
 * therefore pass through synchronously unless throttling is active, and when it
 * is, the waits are serialized so `drain()` can hold the end handler back until
 * every chunk has been written.
 */
export class ChunkPipe {
  private tail: Promise<void> | null = null;

  constructor(
    private readonly direction: Direction,
    private readonly resolveThrottle: () => SessionThrottle | undefined,
  ) {}

  write(chunk: Buffer, cb: ChunkCallback): void {
    const throttle = this.resolveThrottle();
    if (!throttle) {
      cb(null, chunk);
      return;
    }

    const wait = () =>
      this.direction === 'upload'
        ? throttle.throttleUpload(chunk)
        : throttle.throttleDownload(chunk);

    this.tail = (this.tail ?? Promise.resolve()).then(() =>
      wait().then(
        () => cb(null, chunk),
        (err: unknown) => cb(err instanceof Error ? err : new Error(String(err))),
      ),
    );
  }

  /** Pending writes, or null when every chunk has already been forwarded. */
  drain(): Promise<void> | null {
    return this.tail;
  }
}
