// ─────────────────────────────────────────────────────────────
// Tools: get_account_info + add_note
// Covers System domain — account details, notes, event log
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerSystemTools(server: McpServer, env: Env) {
  // ── get_account_info ─────────────────────────────────────────
  server.tool(
    'get_account_info',
    'Get QuickFile account details: company name, address, VAT number, financial year settings. Use this to confirm the account is live and correctly connected.',
    {},
    async () => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'system', method: 'System_GetAccountDetails', label: 'accountInfo', body: {},
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_account_info');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── add_note ─────────────────────────────────────────────────
  server.tool(
    'add_note',
    'Add a note to an invoice, purchase, client, or supplier record in QuickFile.',
    {
      entityType: z.enum(['invoice', 'purchase', 'client', 'supplier']).describe('The type of record to add the note to'),
      entityId:   z.string().describe('The ID of the record'),
      note:       z.string().min(1).max(2000).describe('The note text to add'),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'system', method: 'System_AddNote', label: 'note',
        body: { EntityType: args.entityType, EntityID: args.entityId, NoteText: args.note },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'add_note');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── search_event_log ─────────────────────────────────────────
  server.tool(
    'search_event_log',
    'Search the QuickFile system event log for recent account activity.',
    {
      dateFrom:   z.string().optional().describe('ISO date YYYY-MM-DD'),
      dateTo:     z.string().optional().describe('ISO date YYYY-MM-DD'),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const body: Record<string, unknown> = { MaxRecords: args.maxResults };
      if (args.dateFrom) body['FromDate'] = args.dateFrom;
      if (args.dateTo)   body['ToDate']   = args.dateTo;

      const calls: FanOutCall[] = [{
        domain: 'system', method: 'System_SearchEventLog', label: 'events', body,
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_event_log');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
