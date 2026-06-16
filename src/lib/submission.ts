// ─────────────────────────────────────────────────────────────
// Submission Number Generator
// QuickFile requires a unique SubmissionNumber per API call.
// We use crypto.randomUUID() which is available in:
//   - Cloudflare Workers (global crypto)
//   - Node.js >= 14.17 (global crypto since Node 19, or via import)
//   - All modern browsers
// ─────────────────────────────────────────────────────────────

/**
 * Generates a new RFC 4122 v4 UUID string.
 * Each QuickFile API call MUST get its own unique value.
 */
export function generateSubmissionNumber(): string {
  // crypto.randomUUID is available globally in Workers and Node >= 19
  // For Node 14-18, fall back to a manual random approach
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4 from Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
