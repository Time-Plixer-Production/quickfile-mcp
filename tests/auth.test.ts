// ─────────────────────────────────────────────────────────────
// Unit tests — auth + submission number
// Run with: npm test
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { generateSubmissionNumber } from '../src/lib/submission.js';

describe('generateSubmissionNumber', () => {
  it('returns a valid UUID v4 string', () => {
    const uuid = generateSubmissionNumber();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('generates unique values on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSubmissionNumber()));
    expect(ids.size).toBe(100);
  });
});
