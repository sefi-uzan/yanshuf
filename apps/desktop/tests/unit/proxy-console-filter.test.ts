import { describe, expect, it } from 'vitest';
import { formatUpstreamError, isBenignProxyError, isExpectedUpstreamError } from '../../src/main/proxy/console-filter';

describe('isBenignProxyError', () => {
  it('treats client disconnects as benign', () => {
    expect(isBenignProxyError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }), 'HTTPS_CLIENT_ERROR')).toBe(true);
    expect(isBenignProxyError(new Error('aborted'), 'CLIENT_TO_PROXY_REQUEST_ERROR')).toBe(true);
    expect(isBenignProxyError(Object.assign(new Error('Request timeout'), { code: 'ERR_HTTP_REQUEST_TIMEOUT' }), 'HTTPS_CLIENT_ERROR')).toBe(true);
  });

  it('treats client abort and unsupported TLS as benign', () => {
    expect(
      isBenignProxyError(Object.assign(new Error('write after end'), { code: 'ERR_STREAM_WRITE_AFTER_END' }), 'PROXY_TO_CLIENT_RESPONSE_ERROR'),
    ).toBe(true);
    expect(
      isBenignProxyError(Object.assign(new Error('unsupported protocol'), { code: 'ERR_SSL_UNSUPPORTED_PROTOCOL' }), 'HTTPS_CLIENT_ERROR'),
    ).toBe(true);
  });

  it('treats HTTP/2 and truncated gzip noise as benign', () => {
    expect(isBenignProxyError(Object.assign(new Error('Parse Error: Invalid method encountered'), { code: 'HPE_INVALID_METHOD' }), 'HTTPS_CLIENT_ERROR')).toBe(true);
    expect(isBenignProxyError(Object.assign(new Error('unexpected end of file'), { code: 'Z_BUF_ERROR' }), 'RESPONSE_FILTER_ERROR')).toBe(true);
  });

  it('does not hide unexpected proxy failures', () => {
    expect(isBenignProxyError(new Error('certificate verify failed'), 'HTTPS_CLIENT_ERROR')).toBe(false);
  });
});

describe('isExpectedUpstreamError', () => {
  it('treats DNS and connection failures as expected upstream errors', () => {
    expect(isExpectedUpstreamError(Object.assign(new Error('getaddrinfo ENOTFOUND test.com'), { code: 'ENOTFOUND' }))).toBe(true);
    expect(isExpectedUpstreamError(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:9999'), { code: 'ECONNREFUSED' }))).toBe(true);
    expect(isExpectedUpstreamError(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }))).toBe(true);
  });

  it('does not treat certificate failures as expected upstream errors', () => {
    expect(isExpectedUpstreamError(new Error('certificate verify failed'))).toBe(false);
  });
});

describe('formatUpstreamError', () => {
  it('formats ENOTFOUND with host name', () => {
    expect(formatUpstreamError(Object.assign(new Error('getaddrinfo ENOTFOUND test.com'), { code: 'ENOTFOUND' }))).toBe(
      'Could not resolve host: test.com',
    );
  });
});
