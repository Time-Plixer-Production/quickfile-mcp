// ─────────────────────────────────────────────────────────────
// Tool: query_ledger + search_journals
// Covers Ledger + Journal domains
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerLedgerTools(server: McpServer, env: Env) {
  server.tool(
    'query_ledger',
    'Query nominal ledger entries for a date range. Optionally also fetch related journal entries.',
    {
      dateFrom: z.string().describe('ISO date YYYY-MM-DD'),
      dateTo: z.string().describe('ISO date YYYY-MM-DD'),
      nominalCode: z.string().optional(),
      includeJournals: z.boolean().default(false).describe('Also fetch journal entries'),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const body: Record<string, unknown> = { FromDate: args.dateFrom, ToDate: args.dateTo };
      if (args.nominalCode) body['NominalCode'] = args.nominalCode;

      const calls: FanOutCall[] = [
        { domain: 'ledger', method: 'Ledger_Search', label: 'ledger', body },
      ];
      if (args.includeJournals) {
        calls.push({ domain: 'journal', method: 'Journal_Search', label: 'journals', body });
      }

      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'query_ledger');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
