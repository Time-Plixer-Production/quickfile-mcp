// ─────────────────────────────────────────────────────────────
// Tool: search_estimates + get_estimate + convert_estimate
// Dedicated Estimate domain tools (separate from invoices)
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerEstimateTools(server: McpServer, env: Env) {
  // ── search_estimates ────────────────────────────────────────
  server.tool(
    'search_estimates',
    'Search estimates/quotes by client, status, or date range. Returns live data with reasoning guard provenance.',
    {
      clientId:   z.string().optional().describe('Filter by client ID'),
      status:     z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'ALL']).default('ALL'),
      dateFrom:   z.string().optional().describe('ISO date YYYY-MM-DD'),
      dateTo:     z.string().optional().describe('ISO date YYYY-MM-DD'),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const body: Record<string, unknown> = { MaxRecords: args.maxResults };
      if (args.clientId)       body['ClientID']       = args.clientId;
      if (args.status !== 'ALL') body['EstimateStatus'] = args.status;
      if (args.dateFrom)       body['FromDate']        = args.dateFrom;
      if (args.dateTo)         body['ToDate']          = args.dateTo;

      const calls: FanOutCall[] = [
        { domain: 'estimate', method: 'Estimate_Search', label: 'estimates', body },
      ];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_estimates');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── get_estimate ─────────────────────────────────────────────
  server.tool(
    'get_estimate',
    'Retrieve full detail of a single estimate by its QuickFile estimate number.',
    { estimateNumber: z.string().describe('QuickFile estimate/quote number') },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'estimate', method: 'Estimate_Get', label: 'estimate',
        body: { EstimateNumber: args.estimateNumber },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_estimate');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── convert_estimate_to_invoice ───────────────────────────────
  server.tool(
    'convert_estimate_to_invoice',
    'Convert an accepted estimate to a sales invoice in QuickFile.',
    { estimateNumber: z.string().describe('Estimate number to convert') },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'estimate', method: 'Estimate_ConvertToInvoice', label: 'converted',
        body: { EstimateNumber: args.estimateNumber },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'convert_estimate_to_invoice');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
