// ─────────────────────────────────────────────────────────────
// Tools: query_ledger (Ledger domain)
// Also fans out to Journal when includeJournals=true
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
    'Query nominal ledger entries for a date range. Optionally include manual journal entries. Useful for accountants reviewing postings.',
    {
      dateFrom:       z.string().describe('ISO date YYYY-MM-DD — start of the query range'),
      dateTo:         z.string().describe('ISO date YYYY-MM-DD — end of the query range'),
      nominalCode:    z.string().optional().describe('Filter by specific nominal/chart-of-accounts code'),
      includeJournals: z.boolean().default(false).describe('Also fan out to journal domain for manual entries'),
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
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'query_ledger');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
