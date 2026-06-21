const PROXY_ERROR_KINDS = new Set([
  'HTTPS_CLIENT_ERROR',
  'CLIENT_TO_PROXY_REQUEST_ERROR',
  'PROXY_TO_CLIENT_RESPONSE_ERROR',
  'PROXY_TO_SERVER_REQUEST_ERROR',
  'SERVER_TO_PROXY_RESPONSE_ERROR',
  'ON_REQUEST_ERROR',
  'ON_RESPONSE_ERROR',
  'RESPONSE_FILTER_ERROR',
  'REQUEST_FILTER_ERROR',
]);

const DEBUG_PREFIXES = ['starting server for ', 'https server started'];

const SUPPRESSED_DEBUG_SUBSTRINGS = ['Got ECONNRESET', 'ignoring.'];

const SOCKET_ERROR_PREFIXES = new Set(['Socket error:', 'Connection error:']);

let depth = 0;
let pendingErrorKind: string | null = null;
let pendingSocketErrorLine = false;
let originalError: typeof console.error | null = null;
let originalDebug: typeof console.debug | null = null;
let originalLog: typeof console.log | null = null;

export function isBenignProxyError(err: unknown, kind?: string): boolean {
  if (!(err instanceof Error)) return false;

  const code = (err as NodeJS.ErrnoException).code;
  const message = err.message.toLowerCase();

  if (
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ERR_HTTP_REQUEST_TIMEOUT' ||
    code === 'ERR_STREAM_WRITE_AFTER_END' ||
    code === 'ERR_SSL_UNSUPPORTED_PROTOCOL'
  ) {
    return true;
  }

  if (
    message.includes('socket hang up') ||
    message.includes('aborted') ||
    message.includes('client disconnected') ||
    message.includes('premature close') ||
    message.includes('unexpected end of file')
  ) {
    return true;
  }

  // Chrome may send HTTP/2 or other binary protocols the MITM proxy cannot parse as HTTP/1.1.
  if (code === 'HPE_INVALID_METHOD' || code === 'HPE_INVALID_CONSTANT' || code === 'HPE_CLOSED_CONNECTION') {
    return true;
  }

  // Truncated gzip when a client aborts mid-response.
  if (code === 'Z_BUF_ERROR') {
    return true;
  }

  if (kind === 'HTTPS_CLIENT_ERROR' && (code === 'ECONNRESET' || message.includes('hang up'))) {
    return true;
  }

  if (kind === 'RESPONSE_FILTER_ERROR' && (code === 'Z_BUF_ERROR' || message.includes('unexpected end of file'))) {
    return true;
  }

  return false;
}

const EXPECTED_UPSTREAM_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EHOSTDOWN',
]);

export function isExpectedUpstreamError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  if (code && EXPECTED_UPSTREAM_CODES.has(code)) return true;
  const message = err.message.toLowerCase();
  return message.includes('getaddrinfo enotfound') || message.includes('connect econnrefused');
}

export function formatUpstreamError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const code = (err as NodeJS.ErrnoException).code;
  const message = err.message;

  if (code === 'ENOTFOUND' || message.includes('getaddrinfo ENOTFOUND')) {
    const host = message.match(/getaddrinfo ENOTFOUND (\S+)/i)?.[1];
    return host ? `Could not resolve host: ${host}` : 'Could not resolve upstream host';
  }
  if (code === 'ECONNREFUSED') return 'Connection refused by upstream server';
  if (code === 'ETIMEDOUT' || code === 'ERR_HTTP_REQUEST_TIMEOUT') {
    return 'Upstream connection timed out';
  }
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH' || code === 'EHOSTDOWN') {
    return 'Upstream host is unreachable';
  }
  return message;
}

function shouldSuppressDebug(message: string): boolean {
  if (DEBUG_PREFIXES.some((prefix) => message.startsWith(prefix))) return true;
  return SUPPRESSED_DEBUG_SUBSTRINGS.some((substring) => message.includes(substring));
}

function filteredError(...args: unknown[]): void {
  if (args.length === 1 && typeof args[0] === 'string') {
    if (PROXY_ERROR_KINDS.has(args[0])) {
      pendingErrorKind = args[0];
      return;
    }
    if (SOCKET_ERROR_PREFIXES.has(args[0])) {
      pendingSocketErrorLine = true;
      return;
    }
  }

  if (args.length === 1 && args[0] instanceof Error) {
    if (pendingSocketErrorLine) {
      pendingSocketErrorLine = false;
      if (isBenignProxyError(args[0])) return;
      originalError!('Socket error:');
      originalError!(args[0]);
      return;
    }

    if (pendingErrorKind) {
      const kind = pendingErrorKind;
      pendingErrorKind = null;
      if (isBenignProxyError(args[0], kind) || isExpectedUpstreamError(args[0])) return;
      originalError!(kind);
      originalError!(args[0]);
      return;
    }
  }

  pendingErrorKind = null;
  pendingSocketErrorLine = false;
  originalError!(...args);
}

function filteredDebug(...args: unknown[]): void {
  const message = String(args[0] ?? '');
  if (shouldSuppressDebug(message)) return;
  originalDebug!(...args);
}

function filteredLog(...args: unknown[]): void {
  const message = String(args[0] ?? '');
  if (shouldSuppressDebug(message)) return;
  originalLog!(...args);
}

export function installProxyConsoleFilter(): void {
  if (depth === 0) {
    originalError = console.error.bind(console);
    originalDebug = console.debug.bind(console);
    originalLog = console.log.bind(console);
    console.error = filteredError as typeof console.error;
    console.debug = filteredDebug as typeof console.debug;
    console.log = filteredLog as typeof console.log;
  }
  depth += 1;
}

export function uninstallProxyConsoleFilter(): void {
  if (depth === 0) return;
  depth -= 1;
  if (depth === 0 && originalError && originalDebug && originalLog) {
    console.error = originalError;
    console.debug = originalDebug;
    console.log = originalLog;
    originalError = null;
    originalDebug = null;
    originalLog = null;
    pendingErrorKind = null;
    pendingSocketErrorLine = false;
  }
}
