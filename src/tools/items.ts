// ─────────────────────────────────────────────────────────────
// Tools: search_inventory_items + get_item
// Covers Item domain — inventory products and services
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerItemTools(server: McpServer, env: Env) {
  // ── search_inventory_items ───────────────────────────────────
  server.tool(
    'search_inventory_items',
    'Search inventory items (products and services used on invoices) by name or code.',
    {
      query:      z.string().optional().describe('Item name or code keyword'),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'item', method: 'Item_Search', label: 'items',
        body: { SearchParameters: { ItemName: args.query ?? '', MaxRecords: args.maxResults } },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_inventory_items');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── get_item ─────────────────────────────────────────────────
  server.tool(
    'get_item',
    'Retrieve full details for a single inventory item by its QuickFile ItemID.',
    { itemId: z.string().describe('QuickFile ItemID') },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'item', method: 'Item_Get', label: 'item',
        body: { ItemID: args.itemId },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_item');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
