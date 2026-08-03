import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { contentEncodingOf, decodeBody } from '../../src/main/proxy/content-encoding';
import { buildCaptureEntry, type BodySource } from '../../src/main/proxy/capture-store';

function source(buf: Buffer, total = buf.length): BodySource {
  return { concat: () => buf, total };
}

describe('decodeBody', () => {
  it('inflates gzip, deflate and brotli bodies', () => {
    const payload = Buffer.from('{"hello":"world"}');
    expect(decodeBody(zlib.gzipSync(payload), 'gzip')?.toString()).toBe(payload.toString());
    expect(decodeBody(zlib.deflateSync(payload), 'deflate')?.toString()).toBe(payload.toString());
    expect(decodeBody(zlib.brotliCompressSync(payload), 'br')?.toString()).toBe(payload.toString());
  });

  it('leaves unencoded bodies alone', () => {
    expect(decodeBody(Buffer.from('plain'), undefined)).toBeNull();
    expect(decodeBody(Buffer.from('plain'), 'identity')).toBeNull();
  });

  it('gives up on codings it cannot read', () => {
    expect(decodeBody(Buffer.from('compressed'), 'exotic')).toBeNull();
  });

  it('decodes as far as a truncated body allows', () => {
    const payload = Buffer.from('x'.repeat(4096));
    const gzipped = zlib.gzipSync(payload);
    const partial = decodeBody(gzipped.subarray(0, gzipped.length - 8), 'gzip');
    expect(partial?.length).toBeGreaterThan(0);
  });

  it('reads the header regardless of case', () => {
    expect(contentEncodingOf({ 'Content-Encoding': 'gzip' })).toBe('gzip');
  });
});

describe('buildCaptureEntry body decoding', () => {
  const pending = {
    id: '1',
    startedAt: Date.now(),
    method: 'GET',
    url: 'https://a.test/',
    host: 'a.test',
    path: '/',
    tls: true,
    protocol: 'http1' as const,
    requestHeaders: {},
    requestBody: source(Buffer.alloc(0)),
  };

  it('previews a compressed response as readable text', () => {
    const payload = Buffer.from('{"ok":true}');
    const gzipped = zlib.gzipSync(payload);
    const entry = buildCaptureEntry(
      pending,
      200,
      { 'content-encoding': 'gzip' },
      source(gzipped),
      1024,
    );

    expect(entry.server.body?.preview).toBe(payload.toString());
    expect(entry.responseBodySize).toBe(payload.length);
  });

  it('keeps the wire size when the body was truncated by retention', () => {
    const gzipped = zlib.gzipSync(Buffer.from('y'.repeat(4096)));
    const retained = gzipped.subarray(0, 32);
    const entry = buildCaptureEntry(
      pending,
      200,
      { 'content-encoding': 'gzip' },
      source(retained, gzipped.length),
      1024,
    );

    expect(entry.responseBodySize).toBe(gzipped.length);
  });
});
