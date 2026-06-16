// ─────────────────────────────────────────────────────────────
// Domain Router
// Maps a free-text user query to the QuickFile domains that are
// most likely to answer it. Used by the overview tool and any
// future smart-routing tools to select the minimal set of
// domain calls rather than always fanning out to all 15.
//
// Routing is keyword-based and deterministic — no LLM inference.
// The goal is SPEED + PREDICTABILITY, not cleverness.
// ─────────────────────────────────────────────────────────────

import type { QFDomain } from '../types/index.js';

type DomainWeight = { domain: QFDomain; weight: number };

const DOMAIN_KEYWORDS: Array<{ domain: QFDomain; keywords: string[] }> = [
  { domain: 'invoice',       keywords: ['invoice', 'invoices', 'sales', 'sale', 'bill', 'billed', 'billable', 'revenue', 'income', 'overdue', 'sent', 'draft'] },
  { domain: 'estimate',      keywords: ['estimate', 'estimates', 'quote', 'quotes', 'proposal', 'proposals', 'quotation'] },
  { domain: 'client',        keywords: ['client', 'clients', 'customer', 'customers', 'debtor', 'debtors', 'buyer'] },
  { domain: 'supplier',      keywords: ['supplier', 'suppliers', 'vendor', 'vendors', 'creditor', 'creditors'] },
  { domain: 'purchase',      keywords: ['purchase', 'purchases', 'expense', 'expenses', 'bill', 'bills', 'cost', 'costs', 'spend'] },
  { domain: 'purchaseorder', keywords: ['purchase order', 'po ', 'purchase orders', 'order', 'orders'] },
  { domain: 'payment',       keywords: ['payment', 'payments', 'paid', 'receipt', 'receipts', 'settled', 'received'] },
  { domain: 'bank',          keywords: ['bank', 'banking', 'account', 'accounts', 'balance', 'transaction', 'transactions', 'transfer', 'cash'] },
  { domain: 'report',        keywords: ['report', 'reports', 'profit', 'loss', 'p&l', 'balance sheet', 'vat', 'aged', 'ageing', 'summary', 'overview'] },
  { domain: 'ledger',        keywords: ['ledger', 'nominal', 'nominal code', 'chart of accounts', 'posting', 'postings'] },
  { domain: 'journal',       keywords: ['journal', 'journals', 'journal entry', 'manual entry', 'adjustment'] },
  { domain: 'item',          keywords: ['item', 'items', 'product', 'products', 'service', 'services', 'inventory', 'stock'] },
  { domain: 'project',       keywords: ['project', 'projects', 'tag', 'tags', 'job', 'jobs', 'cost centre'] },
  { domain: 'document',      keywords: ['document', 'documents', 'receipt', 'receipts', 'attachment', 'upload', 'file'] },
  { domain: 'system',        keywords: ['account', 'settings', 'company', 'details', 'info', 'vat number', 'registration'] },
];

/**
 * Scores a query against all known domains and returns those above threshold.
 * @param query   - User's natural-language query string
 * @param topN    - Return at most this many domains (default 5)
 * @returns       - Sorted array of matching domain names
 */
export function routeQuery(query: string, topN = 5): QFDomain[] {
  const q = query.toLowerCase();

  const scored: DomainWeight[] = DOMAIN_KEYWORDS.map(({ domain, keywords }) => ({
    domain,
    weight: keywords.reduce((sum, kw) => sum + (q.includes(kw) ? 1 + kw.split(' ').length : 0), 0),
  }));

  return scored
    .filter(s => s.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN)
    .map(s => s.domain);
}

/**
 * Returns ALL domains — used when the query is vague or
 * explicitly asks for a full overview.
 */
export function allDomains(): QFDomain[] {
  return DOMAIN_KEYWORDS.map(d => d.domain);
}

/**
 * Determine if a query is a full-account overview request.
 */
export function isOverviewQuery(query: string): boolean {
  const q = query.toLowerCase();
  const triggers = ['overview', 'everything', 'all', 'full', 'snapshot', 'health check', 'summary', 'how is my account', 'how are we doing'];
  return triggers.some(t => q.includes(t));
}
