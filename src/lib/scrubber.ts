// ─────────────────────────────────────────────────────────────
// Secret & PII Scrubber
// Prevents credentials, API keys, account numbers, and sensitive
// financial PII from appearing in logs, error messages, or any
// data returned through the MCP tool response envelope.
//
// Called:
//   1. Before any string is passed to the logger
//   2. Before error messages are propagated out of callQF()
//   3. In the CI secret-scan workflow (trufflehog/gitleaks)
// ─────────────────────────────────────────────────────────────

import type { Env } from '../types/index.js';

// Patterns that should NEVER appear in logs or responses
const STATIC_REDACT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // MD5 hex hashes (32 hex chars)
  { pattern: /\b[0-9a-f]{32}\b/gi,                         label: '[REDACTED:MD5]' },
  // UUID v4 — submission numbers
  { pattern: /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, label: '[REDACTED:UUID]' },
  // Generic API key patterns
  { pattern: /\b[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/g, label: '[REDACTED:APIKEY]' },
  // Long numeric account numbers (8–12 digits)
  { pattern: /\b\d{8,12}\b/g,                              label: '[REDACTED:ACCOUNTNUM]' },
  // Bearer / Authorization headers in stringified JSON
  { pattern: /"(Authorization|X-Api-Key|x-api-key)"\s*:\s*"[^"]+"/gi, label: '"Authorization":"[REDACTED]"' },
  // MD5Value field in JSON
  { pattern: /"MD5Value"\s*:\s*"[^"]+"/gi,               label: '"MD5Value":"[REDACTED]"' },
  // AccNumber field in JSON
  { pattern: /"AccNumber"\s*:\s*"[^"]+"/gi,              label: '"AccNumber":"[REDACTED]"' },
  // ApplicationID field in JSON
  { pattern: /"ApplicationID"\s*:\s*"[^"]+"/gi,          label: '"ApplicationID":"[REDACTED]"' },
  // Generic password fields
  { pattern: /"(password|passwd|secret|token|apikey|api_key)"\s*:\s*"[^"]+"/gi, label: '"[field]":"[REDACTED]"' },
];

/**
 * Scrubs a string of all known secret patterns.
 * Safe to call on log messages, error strings, or any text going out.
 */
export function scrub(input: string): string {
  let out = input;
  for (const { pattern, label } of STATIC_REDACT_PATTERNS) {
    out = out.replace(pattern, label);
  }
  return out;
}

/**
 * Scrubs runtime secret values from a string.
 * Call with `env` after env is loaded so actual credential values
 * are also redacted if they somehow appear in log output.
 */
export function scrubWithEnv(input: string, env: Env): string {
  let out = scrub(input);
  // Redact actual runtime secret values
  const sensitive = [
    { val: env.QF_ACCOUNT_NUMBER, label: '[REDACTED:QF_ACCOUNT_NUMBER]' },
    { val: env.QF_API_KEY,        label: '[REDACTED:QF_API_KEY]' },
    { val: env.QF_APP_ID,         label: '[REDACTED:QF_APP_ID]' },
  ];
  for (const { val, label } of sensitive) {
    if (val && val.length > 3) {
      // Escape the value for use in a regex
      const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(escaped, 'g'), label);
    }
  }
  return out;
}

/**
 * Returns a safe version of an error message, with all secrets removed.
 */
export function safeError(err: unknown, env?: Env): string {
  const msg = err instanceof Error ? err.message : String(err);
  return env ? scrubWithEnv(msg, env) : scrub(msg);
}
