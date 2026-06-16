// ─────────────────────────────────────────────────────────────
// Tool: search_suppliers + get_supplier + create_supplier
// Dedicated Supplier domain tools
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerSupplierTools(server: McpServer, env: Env) {
  // ── search_suppliers ─────────────────────────────────────────
  server.tool(
    'search_suppliers',
    'Search supplier records by name, email, or keyword. Returns live data with provenance.',
    {
      query:      z.string().optional().describe('Supplier name or email keyword'),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'supplier', method: 'Supplier_Search', label: 'suppliers',
        body: { SearchParameters: { CompanyName: args.query ?? '', MaxRecords: args.maxResults } },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_suppliers');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── get_supplier ─────────────────────────────────────────────
  server.tool(
    'get_supplier',
    'Retrieve full details for a single supplier by their QuickFile SupplierID.',
    { supplierId: z.string().describe('QuickFile SupplierID') },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'supplier', method: 'Supplier_Get', label: 'supplier',
        body: { SupplierID: args.supplierId },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_supplier');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── create_supplier ──────────────────────────────────────────
  server.tool(
    'create_supplier',
    'Create a new supplier record in QuickFile.',
    {
      companyName: z.string().describe('Supplier company name'),
      email:       z.string().email().optional().describe('Supplier email address'),
      telephone:   z.string().optional().describe('Supplier telephone number'),
      address1:    z.string().optional().describe('Address line 1'),
      address2:    z.string().optional().describe('Address line 2'),
      town:        z.string().optional().describe('Town / city'),
      postcode:    z.string().optional().describe('Postcode'),
      vatNumber:   z.string().optional().describe('Supplier VAT number'),
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
      if (args.vatNumber) body['VATNumber'] = args.vatNumber;

      const calls: FanOutCall[] = [{
        domain: 'supplier', method: 'Supplier_Create', label: 'created',
        body,
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'create_supplier');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
