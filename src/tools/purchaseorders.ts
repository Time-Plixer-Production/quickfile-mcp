// ─────────────────────────────────────────────────────────────
// Tool: search_purchase_orders + get_purchase_order
// Dedicated PurchaseOrder domain tools
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerPurchaseOrderTools(server: McpServer, env: Env) {
  // ── search_purchase_orders ───────────────────────────────────
  server.tool(
    'search_purchase_orders',
    'Search purchase orders by supplier, status, or date range.',
    {
      supplierId: z.string().optional().describe('Filter by supplier ID'),
      dateFrom:   z.string().optional().describe('ISO date YYYY-MM-DD'),
      dateTo:     z.string().optional().describe('ISO date YYYY-MM-DD'),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const body: Record<string, unknown> = { MaxRecords: args.maxResults };
      if (args.supplierId) body['SupplierID'] = args.supplierId;
      if (args.dateFrom)   body['FromDate']   = args.dateFrom;
      if (args.dateTo)     body['ToDate']     = args.dateTo;

      const calls: FanOutCall[] = [{
        domain: 'purchaseorder', method: 'PurchaseOrder_Search', label: 'purchaseOrders', body,
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_purchase_orders');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── get_purchase_order ───────────────────────────────────────
  server.tool(
    'get_purchase_order',
    'Retrieve full detail of a single purchase order by its QuickFile PO number.',
    { poNumber: z.string().describe('QuickFile PO number') },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'purchaseorder', method: 'PurchaseOrder_Get', label: 'purchaseOrder',
        body: { PONumber: args.poNumber },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_purchase_order');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
