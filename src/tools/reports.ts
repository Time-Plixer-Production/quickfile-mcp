// ─────────────────────────────────────────────────────────────
// Tool: get_financial_report
// Covers Report domain: P&L, Balance Sheet, Ageing, VAT, Chart of Accounts
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

const REPORT_METHODS: Record<string, string> = {
  profit_and_loss: 'Report_ProfitAndLoss',
  balance_sheet: 'Report_BalanceSheet',
  aged_debtors: 'Report_AgedDebtors',
  aged_creditors: 'Report_AgedCreditors',
  chart_of_accounts: 'Report_ChartOfAccounts',
  vat_return: 'Report_VATReturn',
};

export function registerReportTools(server: McpServer, env: Env) {
  server.tool(
    'get_financial_report',
    'Run a QuickFile financial report. Types: profit_and_loss, balance_sheet, aged_debtors, aged_creditors, chart_of_accounts, vat_return.',
    {
      reportType: z.enum([
        'profit_and_loss', 'balance_sheet', 'aged_debtors',
        'aged_creditors', 'chart_of_accounts', 'vat_return',
      ]).describe('Type of financial report to run'),
      dateFrom: z.string().optional().describe('ISO date YYYY-MM-DD'),
      dateTo: z.string().optional().describe('ISO date YYYY-MM-DD'),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const method = REPORT_METHODS[args.reportType];
      if (!method) throw new Error(`Unknown report type: ${args.reportType}`);

      const body: Record<string, unknown> = {};
      if (args.dateFrom) body['FromDate'] = args.dateFrom;
      if (args.dateTo) body['ToDate'] = args.dateTo;

      const calls: FanOutCall[] = [{
        domain: 'report', method, label: args.reportType, body,
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_financial_report');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
