// ─────────────────────────────────────────────────────────────
// Unit tests — cache layer
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { cacheGet, cacheSet, cacheClear, cacheKey } from '../src/lib/cache.js';

beforeEach(() => cacheClear());

describe('cache', () => {
  it('returns null for missing keys', () => {
    expect(cacheGet('missing-key')).toBeNull();
  });

  it('stores and retrieves data', () => {
    cacheSet('test-key', { value: 42 }, 60);
    expect(cacheGet('test-key')).toEqual({ value: 42 });
  });

  it('expires after TTL', async () => {
    cacheSet('expiry-key', 'data', 0);
    await new Promise(r => setTimeout(r, 10));
    expect(cacheGet('expiry-key')).toBeNull();
  });

  it('generates cache keys correctly', () => {
    expect(cacheKey('invoice', 'search', '2024-01-01')).toBe('invoice:search:2024-01-01');
    expect(cacheKey('bank', undefined, 'accounts')).toBe('bank:accounts');
  });

  it('clears by prefix', () => {
    cacheSet('invoice:1', 'a', 60);
    cacheSet('invoice:2', 'b', 60);
    cacheSet('bank:1', 'c', 60);
    cacheClear('invoice');
    expect(cacheGet('invoice:1')).toBeNull();
    expect(cacheGet('invoice:2')).toBeNull();
    expect(cacheGet('bank:1')).toEqual('c');
  });
});
