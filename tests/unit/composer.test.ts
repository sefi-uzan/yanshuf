import { describe, expect, it } from 'vitest';
import { exportCurl } from '../../src/shared/composer-curl';
import { parseCurl } from '../../src/main/composer/service';

describe('cURL parsing', () => {
  it('parses a basic GET curl command', () => {
    const req = parseCurl("curl 'https://api.example.com/users'");
    expect(req.method).toBe('GET');
    expect(req.url).toBe('https://api.example.com/users');
  });

  it('parses method, headers, and body', () => {
    const req = parseCurl(`curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{"name":"Ada"}'`);
    expect(req.method).toBe('POST');
    expect(req.headers['Content-Type']).toBe('application/json');
    expect(req.body).toBe('{"name":"Ada"}');
  });

  it('exports curl compatible with parser', () => {
    const original = {
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: { Authorization: 'Bearer token' },
      body: '{"ok":true}',
    };
    const curl = exportCurl(original);
    const parsed = parseCurl(curl);
    expect(parsed.method).toBe('POST');
    expect(parsed.url).toBe(original.url);
    expect(parsed.body).toBe(original.body);
  });
});
