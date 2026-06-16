// ─────────────────────────────────────────────────────────────
// In-memory response cache (single Worker request / stdio session).
// For persistent cross-request caching, swap the backing store
// with Cloudflare KV or D1 and call kv.get/put instead.
//
// TTL defaults:
//   Financial data (invoices, payments, bank): 60 s
//   Reference data (clients, items, projects):  300 s
//   Reports (P&L, BS):                          600 s
// ─────────────────────────────────────────────────────────────

interface CacheEntry {
  data:      unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export const TTL = {
  financial:  60,
  reference:  300,
  reports:    600,
} as const;

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet(key: string, data: unknown, ttlSeconds: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheClear(keyPrefix?: string): void {
  if (!keyPrefix) { store.clear(); return; }
  for (const k of store.keys()) {
    if (k.startsWith(keyPrefix)) store.delete(k);
  }
}

export function cacheKey(...parts: (string | number | undefined)[]): string {
  return parts.filter(Boolean).join(':');
}
