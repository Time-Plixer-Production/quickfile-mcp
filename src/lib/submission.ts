// ─────────────────────────────────────────────────────────────
// Unique Submission Number generator
// QuickFile REQUIRES a globally unique string per API call.
// We use a UUID v4 (via crypto.randomUUID) — guaranteed unique,
// never reused, no external dependency.
// ─────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically unique submission number.
 * Uses the Web Crypto API (available in Cloudflare Workers & modern Node).
 * Format: qf-<timestamp_ms>-<uuid_v4_without_dashes>
 * This guarantees uniqueness even in concurrent Worker invocations.
 */
export function generateSubmissionNumber(): string {
  const ts = Date.now().toString(36); // base-36 timestamp for compactness
  const uuid = crypto.randomUUID().replace(/-/g, '');
  return `qf-${ts}-${uuid}`;
}

/**
 * Generates N unique submission numbers at once (for fan-out calls).
 */
export function generateSubmissionNumbers(count: number): string[] {
  return Array.from({ length: count }, () => generateSubmissionNumber());
}
