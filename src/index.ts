// ─────────────────────────────────────────────────────────────
// QuickFile MCP Server — Main Entry Point v2.0
// Works as:
//   1. Cloudflare Worker (HTTP/SSE transport — remote)
//   2. Node.js stdio (Claude Desktop / local MCP clients)
// All 15 QuickFile domains registered here.
// ─────────────────────────────────────────────────────────────

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { Env } from './types/index.js';
import { createLogger } from './lib/logger.js';

import { registerInvoiceTools }       from './tools/invoices.js';
import { registerEstimateTools }      from './tools/estimates.js';
import { registerContactTools }       from './tools/contacts.js';
import { registerSupplierTools }      from './tools/suppliers.js';
import { registerBankTools }          from './tools/bank.js';
import { registerPurchaseTools }      from './tools/purchases.js';
import { registerPurchaseOrderTools } from './tools/purchaseorders.js';
import { registerPaymentTools }       from './tools/payments.js';
import { registerReportTools }        from './tools/reports.js';
import { registerLedgerTools }        from './tools/ledger.js';
import { registerJournalTools }       from './tools/journals.js';
import { registerItemTools }          from './tools/items.js';
import { registerProjectTools }       from './tools/projects.js';
import { registerDocumentTools }      from './tools/documents.js';
import { registerSystemTools }        from './tools/system.js';
import { registerOverviewTool }       from './tools/overview.js';

export function createServer(env: Env): McpServer {
  const log = createLogger('server', env.LOG_LEVEL);
  log.info('Initialising QuickFile MCP server v2.0 — registering all 15 domains');

  const server = new McpServer({
    name: 'quickfile-mcp',
    version: '2.0.0',
  });

  // ── Domain tools ────────────────────────────────────────────
  registerOverviewTool(server, env);        // cross-domain fan-out
  registerSystemTools(server, env);         // system / account info
  registerInvoiceTools(server, env);        // invoices
  registerEstimateTools(server, env);       // estimates
  registerContactTools(server, env);        // clients
  registerSupplierTools(server, env);       // suppliers
  registerBankTools(server, env);           // bank accounts + transactions
  registerPurchaseTools(server, env);       // purchase invoices
  registerPurchaseOrderTools(server, env);  // purchase orders
  registerPaymentTools(server, env);        // payments
  registerReportTools(server, env);         // P&L, BS, aged, VAT
  registerLedgerTools(server, env);         // nominal ledger
  registerJournalTools(server, env);        // journals
  registerItemTools(server, env);           // inventory items
  registerProjectTools(server, env);        // project tags
  registerDocumentTools(server, env);       // document/receipt hub

  log.info('All tools registered — server ready');
  return server;
}

// ── Cloudflare Workers export ────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          server: 'quickfile-mcp',
          version: '2.0.0',
          domains: 15,
          timestamp: new Date().toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      'QuickFile MCP Server v2.0 — connect via an MCP-compatible client.',
      { status: 200 }
    );
  },
};

// ── Node.js stdio entry (Claude Desktop / local use) ─────────
if (
  typeof process !== 'undefined' &&
  process.env['QF_ACCOUNT_NUMBER'] &&
  process.env['QF_API_KEY'] &&
  process.env['QF_APP_ID']
) {
  const env: Env = {
    QF_ACCOUNT_NUMBER:   process.env['QF_ACCOUNT_NUMBER']!,
    QF_API_KEY:          process.env['QF_API_KEY']!,
    QF_APP_ID:           process.env['QF_APP_ID']!,
    RATE_LIMIT_OVERRIDE: process.env['RATE_LIMIT_OVERRIDE'],
    LOG_LEVEL:           process.env['LOG_LEVEL'],
  };
  const server    = createServer(env);
  const transport = new StdioServerTransport();
  server.connect(transport).catch(err => {
    console.error('[quickfile-mcp] Fatal stdio error:', err);
    process.exit(1);
  });
}
