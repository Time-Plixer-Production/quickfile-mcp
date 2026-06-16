// Tool: search_projects — covers Project domain
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerProjectTools(server: McpServer, env: Env) {
  server.tool(
    'search_projects',
    'Search project tags in QuickFile. Projects can be attached to invoices, purchases, and estimates.',
    {
      query: z.string().optional().describe('Project name or tag keyword'),
      maxResults: z.number().int().min(1).max(100).default(20),
    },
    async (args) => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'project', method: 'Project_Search', label: 'projects',
        body: { SearchParameters: { TagName: args.query ?? '', MaxRecords: args.maxResults } },
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'search_projects');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
