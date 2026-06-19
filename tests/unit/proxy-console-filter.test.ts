import { describe, expect, it } from 'vitest';
import { isBenignProxyError } from '../../src/main/proxy/console-filter';

describe('isBenignProxyError', () => {
  it('treats client disconnects as benign', () => {
    expect(isBenignProxyError(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }), 'HTTPS_CLIENT_ERROR')).toBe(true);
    expect(isBenignProxyError(new Error('aborted'), 'CLIENT_TO_PROXY_REQUEST_ERROR')).toBe(true);
    expect(isBenignProxyError(Object.assign(new Error('Request timeout'), { code: 'ERR_HTTP_REQUEST_TIMEOUT' }), 'HTTPS_CLIENT_ERROR')).toBe(true);
  });

  it('treats HTTP/2 and truncated gzip noise as benign', () => {
    expect(isBenignProxyError(Object.assign(new Error('Parse Error: Invalid method encountered'), { code: 'HPE_INVALID_METHOD' }), 'HTTPS_CLIENT_ERROR')).toBe(true);
    expect(isBenignProxyError(Object.assign(new Error('unexpected end of file'), { code: 'Z_BUF_ERROR' }), 'RESPONSE_FILTER_ERROR')).toBe(true);
  });

  it('does not hide unexpected proxy failures', () => {
    expect(isBenignProxyError(new Error('certificate verify failed'), 'HTTPS_CLIENT_ERROR')).toBe(false);
  });
});
