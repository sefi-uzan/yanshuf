import type { Transform } from 'node:stream';
import zlib from 'node:zlib';

/**
 * Flushing instead of finishing lets a body that hit the capture retention cap
 * decode as far as its retained bytes go rather than throwing.
 */
const ZLIB_PARTIAL = { finishFlush: zlib.constants.Z_SYNC_FLUSH };
const BROTLI_PARTIAL = { finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH };

type Decoder = (input: Buffer) => Buffer;

const decoders: Record<string, Decoder | undefined> = {
  gzip: (input) => zlib.gunzipSync(input, ZLIB_PARTIAL),
  'x-gzip': (input) => zlib.gunzipSync(input, ZLIB_PARTIAL),
  deflate: (input) => {
    try {
      return zlib.inflateSync(input, ZLIB_PARTIAL);
    } catch {
      // Some servers send raw deflate without the zlib wrapper.
      return zlib.inflateRawSync(input, ZLIB_PARTIAL);
    }
  },
  br: (input) => zlib.brotliDecompressSync(input, BROTLI_PARTIAL),
  zstd:
    typeof zlib.zstdDecompressSync === 'function'
      ? (input) => zlib.zstdDecompressSync(input, { finishFlush: zlib.constants.ZSTD_e_flush })
      : undefined,
};

/** Codings we can undo, so callers can ask upstream for nothing else. */
export const DECODABLE_ACCEPT_ENCODING = 'gzip, deflate, br';

export function contentEncodingOf(headers: Record<string, string>): string | undefined {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'content-encoding') return value;
  }
  return undefined;
}

/**
 * Undo the transfer coding of a captured body. Returns null when the body is
 * not encoded or uses a coding we cannot read, in which case callers should
 * keep the bytes as they came off the wire.
 */
export function decodeBody(data: Buffer, contentEncoding: string | undefined): Buffer | null {
  if (data.length === 0 || !contentEncoding) return null;

  const codings = contentEncoding
    .split(',')
    .map((coding) => coding.trim().toLowerCase())
    .filter((coding) => coding.length > 0 && coding !== 'identity');
  if (codings.length === 0) return null;

  let current = data;
  // Codings are listed in the order they were applied, so undo them backwards.
  for (const coding of codings.reverse()) {
    const decode = decoders[coding];
    if (!decode) return null;
    try {
      current = decode(current);
    } catch {
      return null;
    }
  }
  return current;
}

/**
 * A stream that inflates a response body inline, for the rare rules that need
 * to read or replace it as it passes. Returns null when the coding is absent,
 * stacked, or one we cannot read, so callers leave the stream untouched.
 */
export function createDecoderStream(contentEncoding: string | undefined): Transform | null {
  const coding = contentEncoding?.trim().toLowerCase();
  switch (coding) {
    case 'gzip':
    case 'x-gzip':
      return zlib.createGunzip();
    case 'deflate':
      return zlib.createInflate();
    case 'br':
      return zlib.createBrotliDecompress();
    case 'zstd':
      return typeof zlib.createZstdDecompress === 'function' ? zlib.createZstdDecompress() : null;
    default:
      return null;
  }
}
