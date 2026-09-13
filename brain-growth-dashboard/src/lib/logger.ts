type Level = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel: number = LOG_LEVELS[(process.env.LOG_LEVEL as Level) || "info"] || LOG_LEVELS.info;

const redactedKeys = new Set(["password", "token", "authorization", "api_key", "apikey", "secret", "access_token", "refresh_token"]);

function redact(value: unknown, key = ""): unknown {
  if (key && redactedKeys.has(key.toLowerCase())) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redact(v, k);
    return out;
  }
  return value;
}

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// Logger used by services. Errors should carry err signature: { message, status? , stack? }.
export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),

  /** Serialize an unknown error into safe meta (never includes secrets). */
  errorMeta(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
      const e = err as Error & { status?: number };
      const meta: Record<string, unknown> = { err: e.message };
      if (typeof e.status === "number") meta.status = e.status;
      if (process.env.NODE_ENV !== "production" && e.stack) meta.stack = e.stack.split("\n").slice(0, 6);
      return meta;
    }
    return { err: String(err) };
  },
};