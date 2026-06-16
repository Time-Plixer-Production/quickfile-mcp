// ─────────────────────────────────────────────────────────────
// Tool: get_full_account_overview
// THE cross-domain power tool.
// Fans out across ALL 15 QuickFile domains simultaneously:
// clients, suppliers, invoices, estimates, purchases, purchaseorders,
// payments, bank, ledger, journals, items, projects, documents,
// reports (P&L + balance sheet), system.
// Returns a single merged snapshot of the entire account.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerOverviewTool(server: McpServer, env: Env) {
  server.tool(
    'get_full_account_overview',
    [
      'Full cross-domain snapshot of the QuickFile account.',
      'Fans out in parallel across: bank accounts, clients, suppliers, recent invoices,',
      'recent purchases, recent payments, P&L report, balance sheet, and account info.',
      'Use this for general account questions, health checks, or onboarding.',
      'Warning: uses up to 9 API calls per invocation.',
    ].join(' '),
    {
      dateFrom: z.string().optional().describe('ISO date for reports/invoices/purchases (default: start of current year)'),
      dateTo: z.string().optional().describe('ISO date for reports/invoices/purchases (default: today)'),
      maxRecords: z.number().int().min(1).max(50).default(10),
    },
    async (args) => {
      const today = new Date();
      const startOfYear = `${today.getFullYear()}-01-01`;
      const todayStr = today.toISOString().slice(0, 10);
      const from = args.dateFrom ?? startOfYear;
      const to = args.dateTo ?? todayStr;
      const max = args.maxRecords;

      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);

      const calls: FanOutCall[] = [
        // System
        { domain: 'system', method: 'System_GetAccountDetails', label: 'accountInfo', body: {} },
        // Bank
        { domain: 'bank', method: 'Bank_GetAccounts', label: 'bankAccounts', body: {} },
        // Clients & Suppliers
        { domain: 'client', method: 'Client_Search', label: 'clients', body: { SearchParameters: { MaxRecords: max } } },
        { domain: 'supplier', method: 'Supplier_Search', label: 'suppliers', body: { SearchParameters: { MaxRecords: max } } },
        // Invoices & Purchases
        { domain: 'invoice', method: 'Invoice_Search', label: 'recentInvoices', body: { FromDate: from, ToDate: to, MaxRecords: max } },
        { domain: 'purchase', method: 'Purchase_Search', label: 'recentPurchases', body: { FromDate: from, ToDate: to, MaxRecords: max } },
        // Payments
        { domain: 'payment', method: 'Payment_Search', label: 'recentPayments', body: { FromDate: from, ToDate: to, MaxRecords: max } },
        // Reports
        { domain: 'report', method: 'Report_ProfitAndLoss', label: 'profitAndLoss', body: { FromDate: from, ToDate: to } },
        { domain: 'report', method: 'Report_BalanceSheet', label: 'balanceSheet', body: { ToDate: to } },
      ];

      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults, {
        metadata: { queryPeriod: { from, to }, maxRecords: max },
      });
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_full_account_overview');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
