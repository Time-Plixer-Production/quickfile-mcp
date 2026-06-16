// Tool: list_documents — covers Document domain
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerDocumentTools(server: McpServer, env: Env) {
  server.tool(
    'list_documents',
    'List uploaded documents from the QuickFile document / receipt hub.',
    {},
    async () => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'document', method: 'Document_List', label: 'documents', body: {},
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'list_documents');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
