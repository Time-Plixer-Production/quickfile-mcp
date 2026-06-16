// ─────────────────────────────────────────────────────────────
// Structured logger — HARDENED
// - Respects LOG_LEVEL: debug | info | warn | error
// - Outputs JSON to stderr so it does NOT pollute MCP stdio
// - ALL log output passes through the secret scrubber
// - msg and every meta value is scrubbed before writing
// ─────────────────────────────────────────────────────────────

import { scrub } from './scrubber.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info (msg: string, meta?: Record<string, unknown>): void;
  warn (msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/** Recursively scrub all string values in a plain object */
function scrubMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === 'string') {
      out[k] = scrub(v);
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = scrubMeta(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function createLogger(namespace: string, levelOverride?: string): Logger {
  const minLevel = LEVELS[(levelOverride?.toLowerCase() as Level) ?? 'info'] ?? LEVELS.info;

  function log(level: Level, msg: string, meta?: Record<string, unknown>): void {
    if (LEVELS[level] < minLevel) return;
    const line = JSON.stringify({
      ts:  new Date().toISOString(),
      lvl: level,
      ns:  namespace,
      msg: scrub(msg),                                  // ← scrubbed
      ...(meta ? scrubMeta(meta) : {}),                 // ← scrubbed
    });
    // Always write to stderr — never stdout (MCP transport wire)
    if (typeof process !== 'undefined') {
      process.stderr.write(line + '\n');
    } else {
      console.error(line);
    }
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info:  (msg, meta) => log('info',  msg, meta),
    warn:  (msg, meta) => log('warn',  msg, meta),
    error: (msg, meta) => log('error', msg, meta),
  };
}
