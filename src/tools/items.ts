// Tool: search_items — covers Inventory Item domain
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerItemTools(server: McpServer, env: Env) {
  server.tool(
    'search_inventory_items',
    'Search inventory items (products/services used on invoices) by name or code.',
    {
      query: z.string().optional().describe('Item name or code search string'),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'item', method: 'Item_Search', label: 'items',
        body: { SearchParameters: { ItemName: args.query ?? '', MaxRecords: args.maxResults } },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_inventory_items');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
