// ─────────────────────────────────────────────────────────────
// Tool: search_purchases
// Covers Purchase + PurchaseOrder domains in one fan-out
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

const schema = z.object({
  supplierId: z.string().optional().describe('Filter by supplier ID'),
  dateFrom: z.string().optional().describe('ISO date YYYY-MM-DD'),
  dateTo: z.string().optional().describe('ISO date YYYY-MM-DD'),
  includePurchaseOrders: z.boolean().default(false),
  maxResults: z.number().int().min(1).max(100).default(20),
});

export function registerPurchaseTools(server: McpServer, env: Env) {
  server.tool(
    'search_purchases',
    'Search purchase invoices and optionally purchase orders. Filters by supplier and date range.',
    schema.shape,
    async (args) => {
      const { supplierId, dateFrom, dateTo, includePurchaseOrders, maxResults } = schema.parse(args);
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [];

      const body: Record<string, unknown> = { MaxRecords: maxResults };
      if (supplierId) body['SupplierID'] = supplierId;
      if (dateFrom) body['FromDate'] = dateFrom;
      if (dateTo) body['ToDate'] = dateTo;

      calls.push({ domain: 'purchase', method: 'Purchase_Search', label: 'purchases', body });
      if (includePurchaseOrders) {
        calls.push({ domain: 'purchaseorder', method: 'PurchaseOrder_Search', label: 'purchaseOrders', body });
      }

      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_purchases');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
