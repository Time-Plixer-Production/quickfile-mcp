// ─────────────────────────────────────────────────────────────
// Submission Number Generator — HARDENED
// QuickFile requires a UNIQUE SubmissionNumber per API call.
// Predictable IDs (Math.random) are a security weakness:
//   - Easier to replay or guess submission numbers
//   - Weaker entropy than a true CSPRNG
// This module uses ONLY cryptographically secure randomness.
// Math.random() fallback has been REMOVED entirely.
// ─────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure RFC 4122 v4 UUID.
 * Available in:
 *   - Cloudflare Workers (global crypto)
 *   - Node.js >= 15 (global crypto.randomUUID)
 *   - Node.js 14: uses crypto.getRandomValues fallback
 * Math.random() is NEVER used — it is NOT cryptographically secure.
 */
export function generateSubmissionNumber(): string {
  // Path 1: crypto.randomUUID — available in CF Workers + Node 15+
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Path 2: crypto.getRandomValues — Node 14 + all modern browsers
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant bits per RFC 4122
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }

  // Path 3: Node.js built-in crypto module (Node 14 without global)
  // We use dynamic require to avoid breaking Workers bundle.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto') as { randomUUID?: () => string; randomBytes: (n: number) => Buffer };
    if (typeof nodeCrypto.randomUUID === 'function') {
      return nodeCrypto.randomUUID();
    }
    const buf = nodeCrypto.randomBytes(16);
    buf[6] = (buf[6]! & 0x0f) | 0x40;
    buf[8] = (buf[8]! & 0x3f) | 0x80;
    const h = buf.toString('hex');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  } catch {
    // Path 4: Hard fail — never fall back to Math.random()
    throw new Error(
      '[quickfile-mcp] FATAL: No cryptographically secure random source available. ' +
      'Cannot generate a safe SubmissionNumber. Upgrade to Node.js >= 15 or run in Cloudflare Workers.'
    );
  }
}
