import fs from 'node:fs/promises';
import { fetch, ProxyAgent } from 'undici';
import type { ComposerRequest, ComposerResponse } from '@yanshuf/shared';
import { methodSupportsBody , YANSHUF_COMPOSER_HEADER } from '@yanshuf/shared';

export interface ComposerSendOptions {
  proxyPort: number;
  caCertPath: string;
}

export function parseCurl(curl: string): ComposerRequest {
  const trimmed = curl.trim();
  if (!trimmed.startsWith('curl')) {
    throw new Error('Input must start with curl');
  }

  let method = 'GET';
  let url = '';
  const headers: Record<string, string> = {};
  let body: string | undefined;

  const tokens = tokenizeCurl(trimmed);
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '-X' || token === '--request') {
      method = tokens[++i]?.toUpperCase() ?? 'GET';
    } else if (token === '-H' || token === '--header') {
      const header = tokens[++i] ?? '';
      const colon = header.indexOf(':');
      if (colon > 0) {
        headers[header.slice(0, colon).trim()] = header.slice(colon + 1).trim();
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw') {
      body = tokens[++i];
      if (method === 'GET') method = 'POST';
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      url = token.replace(/^['"]|['"]$/g, '');
    } else if (!token.startsWith('-') && (token.includes('://') || token.startsWith("'http") || token.startsWith('"http'))) {
      url = token.replace(/^['"]|['"]$/g, '');
    }
  }

  if (!url) throw new Error('Could not parse URL from cURL command');

  return { method, url, headers, body };
}

function tokenizeCurl(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
        tokens.push(current);
        current = '';
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      if (current) {
        tokens.push(current);
        current = '';
      }
      quote = ch;
    } else if (ch === ' ' || ch === '\n') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

export class ComposerService {
  async send(
    request: ComposerRequest,
    options?: ComposerSendOptions,
  ): Promise<ComposerResponse> {
    const url = request.url;
    const headers = request.headers;
    const body = request.body || undefined;

    const start = Date.now();
    let dispatcher: ProxyAgent | undefined;
    const fetchOptions: Parameters<typeof fetch>[1] = {
      method: request.method,
      headers: options
        ? { ...headers, [YANSHUF_COMPOSER_HEADER]: '1' }
        : headers,
      body: body && methodSupportsBody(request.method) ? body : undefined,
    };

    if (options) {
      const ca = await fs.readFile(options.caCertPath, 'utf8');
      dispatcher = new ProxyAgent({
        uri: `http://127.0.0.1:${options.proxyPort}`,
        requestTls: { ca },
      });
      fetchOptions.dispatcher = dispatcher;
    }

    try {
      const response = await fetch(url, fetchOptions);

      const responseBody = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
        durationMs: Date.now() - start,
      };
    } finally {
      await dispatcher?.close();
    }
  }
}
