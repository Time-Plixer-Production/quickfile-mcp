// Tool: search_payments — covers Payment domain
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerPaymentTools(server: McpServer, env: Env) {
  server.tool(
    'search_payments',
    'Search payment records by date range, client, or amount. Returns live payment data with provenance.',
    {
      dateFrom: z.string().optional().describe('ISO date YYYY-MM-DD'),
      dateTo: z.string().optional().describe('ISO date YYYY-MM-DD'),
      clientId: z.string().optional(),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const body: Record<string, unknown> = { MaxRecords: args.maxResults };
      if (args.dateFrom) body['FromDate'] = args.dateFrom;
      if (args.dateTo) body['ToDate'] = args.dateTo;
      if (args.clientId) body['ClientID'] = args.clientId;

      const calls: FanOutCall[] = [
        { domain: 'payment', method: 'Payment_Search', label: 'payments', body },
      ];
      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_payments');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
