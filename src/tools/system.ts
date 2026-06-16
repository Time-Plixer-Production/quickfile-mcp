// Tool: get_account_info — covers System domain
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env, FanOutCall } from '../types/index.js';
import { fanOut, toMCPResult } from '../lib/fanout.js';
import { applyReasoningGuard, formatGuardedResponse } from '../lib/reasoning.js';
import { RateLimiter } from '../lib/rateLimit.js';

export function registerSystemTools(server: McpServer, env: Env) {
  server.tool(
    'get_account_info',
    'Get QuickFile account details: company name, address, VAT number, financial year settings. Use this to confirm the account is connected and live.',
    {},
    async () => {
      const rl = new RateLimiter(env.RATE_LIMIT_OVERRIDE);
      const calls: FanOutCall[] = [{
        domain: 'system', method: 'System_GetAccountDetails', label: 'accountInfo', body: {},
      }];
      const fanOutResults = await fanOut(env, calls, rl);
      const result = toMCPResult(fanOutResults);
      const guarded = applyReasoningGuard(result, fanOutResults, 'get_account_info');
      return { content: [{ type: 'text', text: formatGuardedResponse(guarded) }] };
    }
  );
}
