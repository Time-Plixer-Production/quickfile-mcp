// ─────────────────────────────────────────────────────────────
// Unit tests — domain router
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { routeQuery, isOverviewQuery, allDomains } from '../src/lib/router.js';

describe('routeQuery', () => {
  it('routes invoice-related queries to invoice domain', () => {
    const domains = routeQuery('show me overdue invoices this month');
    expect(domains).toContain('invoice');
  });

  it('routes bank queries to bank domain', () => {
    const domains = routeQuery('what is my bank balance');
    expect(domains).toContain('bank');
  });

  it('routes supplier queries to supplier domain', () => {
    const domains = routeQuery('list all my suppliers');
    expect(domains).toContain('supplier');
  });

  it('returns empty array for unrecognised query', () => {
    const domains = routeQuery('zzz unrelated nonsense zzz');
    expect(domains).toHaveLength(0);
  });

  it('respects topN limit', () => {
    const domains = routeQuery('invoices bank payments suppliers clients reports', 3);
    expect(domains.length).toBeLessThanOrEqual(3);
  });
});

describe('isOverviewQuery', () => {
  it('detects overview keywords', () => {
    expect(isOverviewQuery('give me a full account overview')).toBe(true);
    expect(isOverviewQuery('how are we doing this year')).toBe(true);
  });

  it('does not false-positive on specific queries', () => {
    expect(isOverviewQuery('get invoice INV-001')).toBe(false);
  });
});

describe('allDomains', () => {
  it('returns all 15 domains', () => {
    expect(allDomains()).toHaveLength(15);
  });
});
