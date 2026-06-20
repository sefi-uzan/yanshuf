import { describe, expect, it } from 'vitest';
import { YanshufApiClient } from '../src/client.js';

describe('YanshufApiClient', () => {
  it('throws when fetch fails', async () => {
    const client = new YanshufApiClient({ baseUrl: 'http://127.0.0.1:1', token: 'x' });
    await expect(client.getStatus()).rejects.toThrow('Yanshuf is not running');
  });
});
