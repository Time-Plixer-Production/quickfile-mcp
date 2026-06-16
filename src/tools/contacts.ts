// ─────────────────────────────────────────────────────────────
// Tool: search_contacts
// Searches clients AND suppliers simultaneously in one call.
// Fan-out: client/Client_Search + supplier/Supplier_Search
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

const schema = z.object({
  query: z.string().optional().describe('Name, email or keyword to search'),
  includeClients: z.boolean().default(true).describe('Include client records'),
  includeSuppliers: z.boolean().default(true).describe('Include supplier records'),
  maxResults: z.number().int().min(1).max(100).default(20),
});

export function registerContactsTools(server: McpServer, env: Env) {
  server.tool(
    'search_contacts',
    'Search clients and/or suppliers by name, email or keyword. Queries both domains in parallel and returns unified results with live provenance.',
    schema.shape,
    async (args) => {
      const { query, includeClients, includeSuppliers, maxResults } = schema.parse(args);
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [];

      if (includeClients) {
        calls.push({
          domain: 'client', method: 'Client_Search', label: 'clients',
          body: { SearchParameters: { CompanyName: query ?? '', MaxRecords: maxResults } },
        });
      }
      if (includeSuppliers) {
        calls.push({
          domain: 'supplier', method: 'Supplier_Search', label: 'suppliers',
          body: { SearchParameters: { CompanyName: query ?? '', MaxRecords: maxResults } },
        });
      }

      if (calls.length === 0) {
        return { content: [{ type: 'text', text: 'No domains selected. Set includeClients or includeSuppliers to true.' }] };
      }

      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_contacts');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  server.tool(
    'get_client',
    'Retrieve full details for a single client by their QuickFile ClientID.',
    { clientId: z.string().describe('QuickFile ClientID') }.valueOf(),
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'client', method: 'Client_Get', label: 'client',
        body: { ClientID: args.clientId },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_client');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
