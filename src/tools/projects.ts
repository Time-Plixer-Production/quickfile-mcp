// ─────────────────────────────────────────────────────────────
// Tools: search_projects + get_project
// Covers Project domain — project tags
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerProjectTools(server: McpServer, env: Env) {
  // ── search_projects ──────────────────────────────────────────
  server.tool(
    'search_projects',
    'Search project tags in QuickFile. Projects can be attached to invoices, purchases, and estimates for cost tracking.',
    {
      query:      z.string().optional().describe('Project name or tag keyword'),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'project', method: 'Project_Search', label: 'projects',
        body: { SearchParameters: { TagName: args.query ?? '', MaxRecords: args.maxResults } },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_projects');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );

  // ── get_project ──────────────────────────────────────────────
  server.tool(
    'get_project',
    'Retrieve a project tag by its QuickFile TagID, including all associated invoices and purchases.',
    { tagId: z.string().describe('QuickFile TagID') },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'project', method: 'Project_Get', label: 'project',
        body: { TagID: args.tagId },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result  = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_project');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
