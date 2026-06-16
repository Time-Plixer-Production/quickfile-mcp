// ─────────────────────────────────────────────────────────────
// Tool: get_bank_activity + get_cash_position
// Covers Bank domain: accounts, balances, transactions
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerBankTools(server: McpServer, env: Env) {
  server.tool(
    'get_cash_position',
    'Get a list of all bank accounts with their current balances. Gives an instant cash position snapshot.',
    {},
    async () => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [
        { domain: 'bank', method: 'Bank_GetAccounts', label: 'accounts', body: {} },
      ];
      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_cash_position');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  server.tool(
    'get_bank_activity',
    'Search bank transactions by date range and optionally by nominal code or reference text.',
    {
      dateFrom: z.string().describe('ISO date YYYY-MM-DD'),
      dateTo: z.string().describe('ISO date YYYY-MM-DD'),
      nominalCode: z.string().optional().describe('Filter by nominal code'),
      reference: z.string().optional().describe('Filter by reference text'),
      maxResults: z.number().int().min(1).max(100).default(50),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const body: Record<string, unknown> = {
        FromDate: args.dateFrom,
        ToDate: args.dateTo,
        MaxRecords: args.maxResults,
      };
      if (args.nominalCode) body['NominalCode'] = args.nominalCode;
      if (args.reference) body['Reference'] = args.reference;

      const calls: FanOutCall[] = [
        { domain: 'bank', method: 'Bank_Search', label: 'transactions', body },
      ];
      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_bank_activity');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
