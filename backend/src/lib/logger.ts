import { AsyncLocalStorage } from 'async_hooks';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

function parseLogLevel(): LogLevel {
  const v = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error') return v;
  return 'info';
}

const minRank = LEVEL_RANK[parseLogLevel()];

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= minRank;
}

export interface RequestContextStore {
  correlationId: string;
}

const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContext.getStore();
}

export function runWithRequestContext<T>(correlationId: string, fn: () => T): T {
  return requestContext.run({ correlationId }, fn);
}

function includeStack(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.LOG_STACK === 'true';
}

function baseRecord(level: LogLevel, msg: string, extra: Record<string, unknown>): Record<string, unknown> {
  const correlationId = getRequestContext()?.correlationId;
  return {
    level,
    time: new Date().toISOString(),
    msg,
    ...(correlationId ? { correlationId } : {}),
    ...extra
  };
}

function write(level: LogLevel, msg: string, extra: Record<string, unknown> = {}): void {
  if (!shouldLog(level)) return;
  const line = JSON.stringify(baseRecord(level, msg, extra));
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function logError(msg: string, err: unknown, extra: Record<string, unknown> = {}): void {
  const errObj = err instanceof Error ? err : new Error(String(err));
  const payload: Record<string, unknown> = {
    ...extra,
    errMessage: errObj.message
  };
  if (includeStack() && errObj.stack) {
    payload.errStack = errObj.stack;
  }
  const cause = (errObj as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    payload.errCause = cause instanceof Error ? cause.message : String(cause);
  }
  write('error', msg, payload);
}

export const logger = {
  debug(msg: string, extra?: Record<string, unknown>): void {
    write('debug', msg, extra ?? {});
  },
  info(msg: string, extra?: Record<string, unknown>): void {
    write('info', msg, extra ?? {});
  },
  warn(msg: string, extra?: Record<string, unknown>): void {
    write('warn', msg, extra ?? {});
  },
  error(msg: string, err?: unknown, extra?: Record<string, unknown>): void {
    if (err !== undefined) {
      logError(msg, err, extra ?? {});
    } else {
      write('error', msg, extra ?? {});
    }
  }
};
