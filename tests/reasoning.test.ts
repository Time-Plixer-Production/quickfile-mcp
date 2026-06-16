// ─────────────────────────────────────────────────────────────
// Unit tests — reasoning guard
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { applyReasoningGuard } from '../src/lib/reasoning.js';
import type { MCPResult, FanOutResult } from '../src/types/index.js';

function makeResult(overrides: Partial<MCPResult> = {}): MCPResult {
  return {
    domain: 'invoice',
    method: 'Invoice_Search',
    submissionNumbers: ['test-uuid'],
    liveData: true,
    fetchedAt: new Date().toISOString(),
    data: { invoices: [] },
    ...overrides,
  };
}

function makeFanOut(ok: boolean, domain = 'invoice', method = 'Invoice_Search'): FanOutResult {
  return {
    label: domain,
    domain: domain as any,
    method,
    submissionNumber: 'test-uuid',
    ok,
    ...(ok ? { data: {} } : { error: 'API timeout' }),
  };
}

describe('applyReasoningGuard', () => {
  it('marks all-success with ✅ summary', () => {
    const guarded = applyReasoningGuard(makeResult(), [makeFanOut(true)], 'test_tool');
    expect(guarded.summary).toMatch(/✅/);
    expect(guarded.__provenance.liveData).toBe(true);
    expect(guarded.__provenance.partialFailures).toHaveLength(0);
  });

  it('marks all-failure with ❌ summary', () => {
    const guarded = applyReasoningGuard(
      makeResult({ liveData: false }),
      [makeFanOut(false)],
      'test_tool'
    );
    expect(guarded.summary).toMatch(/❌/);
  });

  it('marks partial failure with ⚠️ summary', () => {
    const guarded = applyReasoningGuard(
      makeResult(),
      [makeFanOut(true, 'invoice'), makeFanOut(false, 'bank')],
      'test_tool'
    );
    expect(guarded.summary).toMatch(/⚠️/);
    expect(guarded.__provenance.partialFailures).toHaveLength(1);
  });

  it('includes __instructions block', () => {
    const guarded = applyReasoningGuard(makeResult(), [makeFanOut(true)], 'test_tool');
    expect(guarded.__instructions).toBeTruthy();
    expect(guarded.__instructions).toContain('live QuickFile accounting API');
  });

  it('populates domainsQueried correctly', () => {
    const guarded = applyReasoningGuard(
      makeResult(),
      [makeFanOut(true, 'invoice'), makeFanOut(true, 'bank')],
      'test_tool'
    );
    expect(guarded.__provenance.domainsQueried).toContain('invoice');
    expect(guarded.__provenance.domainsQueried).toContain('bank');
  });
});
