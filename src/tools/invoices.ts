// ─────────────────────────────────────────────────────────────
// Tool: search_sales_documents + get_invoice
// Covers Invoice + Estimate domains
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

const searchSchema = z.object({
  clientId: z.string().optional().describe('Filter by client ID'),
  status: z.enum(['DRAFT', 'SENT', 'OVERDUE', 'PAID', 'ALL']).default('ALL'),
  dateFrom: z.string().optional().describe('ISO date YYYY-MM-DD'),
  dateTo: z.string().optional().describe('ISO date YYYY-MM-DD'),
  includeEstimates: z.boolean().default(false).describe('Also search estimates'),
  maxResults: z.number().int().min(1).max(100).default(20),
});

export function registerInvoiceTools(server: McpServer, env: Env) {
  server.tool(
    'search_sales_documents',
    'Search invoices (and optionally estimates) with filters for client, status, and date range. Returns live data with provenance.',
    searchSchema.shape,
    async (args) => {
      const { clientId, status, dateFrom, dateTo, includeEstimates, maxResults } = searchSchema.parse(args);
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [];

      const invBody: Record<string, unknown> = { MaxRecords: maxResults };
      if (clientId) invBody['ClientID'] = clientId;
      if (status !== 'ALL') invBody['InvoiceStatus'] = status;
      if (dateFrom) invBody['FromDate'] = dateFrom;
      if (dateTo) invBody['ToDate'] = dateTo;

      calls.push({ domain: 'invoice', method: 'Invoice_Search', label: 'invoices', body: invBody });

      if (includeEstimates) {
        const estBody = { ...invBody };
        calls.push({ domain: 'estimate', method: 'Estimate_Search', label: 'estimates', body: estBody });
      }

      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults, {
        metadata: { filters: { clientId, status, dateFrom, dateTo, includeEstimates } },
      });
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_sales_documents');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  server.tool(
    'get_invoice',
    'Retrieve the full detail of a single invoice or estimate by its QuickFile invoice number.',
    { invoiceNumber: z.string().describe('QuickFile invoice number') }.valueOf(),
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'invoice', method: 'Invoice_Get', label: 'invoice',
        body: { InvoiceNumber: args.invoiceNumber },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_invoice');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
