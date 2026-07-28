/**
 * 带前缀的 logger。
 * WHY: 按 CLAUDE.md 调试偏好：console.log 前缀 `[DEBUG]` + 函数名 + 时间戳。
 * WHY: 生产构建时可一键关闭，避免在用户控制台刷屏。
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

let enabled = true;

export function setLoggerEnabled(value: boolean): void {
  enabled = value;
}

function format(level: Level, fn: string, message: string, context?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const ctx = context ? ` ${JSON.stringify(context)}` : '';
  return `[${ts}] [${level.toUpperCase()}] [${fn}] ${message}${ctx}`;
}

function emit(level: Level, fn: string, message: string, context?: Record<string, unknown>): void {
  if (!enabled) return;
  const line = format(level, fn, message, context);
  // WHY: error 走 console.error 才能触发浏览器/Sentry 收集；warn/info/debug 走 log。
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (fn: string, message: string, context?: Record<string, unknown>) => emit('debug', fn, message, context),
  info: (fn: string, message: string, context?: Record<string, unknown>) => emit('info', fn, message, context),
  warn: (fn: string, message: string, context?: Record<string, unknown>) => emit('warn', fn, message, context),
  error: (fn: string, message: string, context?: Record<string, unknown>) => emit('error', fn, message, context),
};
