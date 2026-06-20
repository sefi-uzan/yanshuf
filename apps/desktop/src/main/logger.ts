type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function enabled(): boolean {
  return process.env.YANSHUF_DEBUG !== '0';
}

function format(level: LogLevel, module: string, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [yanshuf:${module}] ${level.toUpperCase()} ${message}`;
  if (data === undefined) return prefix;
  return `${prefix} ${safeJson(data)}`;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function write(level: LogLevel, module: string, message: string, data?: unknown): void {
  if (!enabled()) return;
  const line = format(level, module, message, data);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(module: string) {
  return {
    debug: (message: string, data?: unknown) => write('debug', module, message, data),
    info: (message: string, data?: unknown) => write('info', module, message, data),
    warn: (message: string, data?: unknown) => write('warn', module, message, data),
    error: (message: string, data?: unknown) => write('error', module, message, data),
  };
}
