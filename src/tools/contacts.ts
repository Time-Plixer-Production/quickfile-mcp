// ─────────────────────────────────────────────────────────────
// Tools: search_contacts + get_client + create_client
// Covers Client domain (suppliers handled in suppliers.ts)
// Fan-out: client + supplier simultaneously on search
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerContactTools(server: McpServer, env: Env) {
  // ── search_contacts ──────────────────────────────────────────
  server.tool(
    'search_contacts',
    'Search clients and/or suppliers by name, email or keyword. Queries both domains in parallel and returns unified live results.',
    {
      query:            z.string().optional().describe('Name, email or keyword'),
      includeClients:   z.boolean().default(true),
      includeSuppliers: z.boolean().default(true),
      maxResults:       z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [];

      if (args.includeClients) {
        calls.push({
          domain: 'client', method: 'Client_Search', label: 'clients',
          body: { SearchParameters: { CompanyName: args.query ?? '', MaxRecords: args.maxResults } },
        });
      }
      if (args.includeSuppliers) {
        calls.push({
          domain: 'supplier', method: 'Supplier_Search', label: 'suppliers',
          body: { SearchParameters: { CompanyName: args.query ?? '', MaxRecords: args.maxResults } },
        });
      }

      if (calls.length === 0) {
        return { content: [{ type: 'text', text: 'No domains selected — set includeClients or includeSuppliers to true.' }] };
      }

      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_contacts');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── get_client ───────────────────────────────────────────────
  server.tool(
    'get_client',
    'Retrieve full details for a single client by their QuickFile ClientID.',
    { clientId: z.string().describe('QuickFile ClientID') },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'client', method: 'Client_Get', label: 'client',
        body: { ClientID: args.clientId },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_client');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── create_client ─────────────────────────────────────────────
  server.tool(
    'create_client',
    'Create a new client record in QuickFile.',
    {
      companyName: z.string().describe('Client company name'),
      email:       z.string().email().optional(),
      telephone:   z.string().optional(),
      address1:    z.string().optional(),
      address2:    z.string().optional(),
      town:        z.string().optional(),
      postcode:    z.string().optional(),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const body: Record<string, unknown> = { CompanyName: args.companyName };
      if (args.email)     body['Email']     = args.email;
      if (args.telephone) body['Telephone'] = args.telephone;
      if (args.address1)  body['Address1']  = args.address1;
      if (args.address2)  body['Address2']  = args.address2;
      if (args.town)      body['Town']      = args.town;
      if (args.postcode)  body['Postcode']  = args.postcode;

      const calls: FanOutCall[] = [{
        domain: 'client', method: 'Client_Create', label: 'created', body,
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'create_client');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
