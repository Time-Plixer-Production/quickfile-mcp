// ─────────────────────────────────────────────────────────────
// Tool: search_journals + get_journal
// Dedicated Journal domain tools
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerJournalTools(server: McpServer, env: Env) {
  // ── search_journals ──────────────────────────────────────────
  server.tool(
    'search_journals',
    'Search manual journal entries by date range or reference. Journals are manual accounting adjustments in QuickFile.',
    {
      dateFrom:   z.string().optional().describe('ISO date YYYY-MM-DD'),
      dateTo:     z.string().optional().describe('ISO date YYYY-MM-DD'),
      reference:  z.string().optional().describe('Reference keyword'),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const body: Record<string, unknown> = { MaxRecords: args.maxResults };
      if (args.dateFrom)  body['FromDate']  = args.dateFrom;
      if (args.dateTo)    body['ToDate']    = args.dateTo;
      if (args.reference) body['Reference'] = args.reference;

      const calls: FanOutCall[] = [
        { domain: 'journal', method: 'Journal_Search', label: 'journals', body },
      ];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_journals');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── get_journal ──────────────────────────────────────────────
  server.tool(
    'get_journal',
    'Retrieve a single journal entry by its QuickFile journal ID.',
    { journalId: z.string().describe('QuickFile journal ID') },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'journal', method: 'Journal_Get', label: 'journal',
        body: { JournalID: args.journalId },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_journal');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
