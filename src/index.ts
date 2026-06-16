// ─────────────────────────────────────────────────────────────
// QuickFile MCP Server — Main Entry Point v2.0
// Works as:
//   1. Cloudflare Worker (HTTP/SSE transport — remote)
//   2. Node.js stdio (Claude Desktop / local MCP clients)
// All 15 QuickFile domains registered here.
// ─────────────────────────────────────────────────────────────

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { Env, BusinessProfile } from './types/index.js';
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

/**
 * Builds a BusinessProfile from raw env vars.
 * Called once at server startup — not per-request.
 */
function buildBusinessProfile(env: Env): BusinessProfile | undefined {
  const vatRegistered = env.QF_VAT_REGISTERED?.toLowerCase() === 'true';
  if (!vatRegistered && !env.QF_BUSINESS_NAME) return undefined;
  return {
    vatRegistered,
    vatPercentage: 20,   // UK standard rate
    businessName: env.QF_BUSINESS_NAME,
  };
}

export function createServer(env: Env): McpServer {
  const log = createLogger('server', env.LOG_LEVEL);

  // Attach businessProfile to env so all tools can read it
  const enrichedEnv: Env = {
    ...env,
    businessProfile: env.businessProfile ?? buildBusinessProfile(env),
  };

  const bp = enrichedEnv.businessProfile;
  if (bp) {
    log.info(
      `businessProfile: { vatRegistered: ${bp.vatRegistered}, vatPercentage: ${bp.vatPercentage}${
        bp.businessName ? `, businessName: "${bp.businessName}"` : ''
      } }`
    );
  } else {
    log.info('businessProfile: not configured — vatPercentage must be supplied per line item');
  }

  log.info('Initialising QuickFile MCP server v2.0 — registering all 15 domains');

  const server = new McpServer({
    name: 'quickfile-mcp',
    version: '2.0.0',
  });

  // ── Domain tools ────────────────────────────────────────────
  registerOverviewTool(server, enrichedEnv);        // cross-domain fan-out
  registerSystemTools(server, enrichedEnv);         // system / account info
  registerInvoiceTools(server, enrichedEnv);        // invoices
  registerEstimateTools(server, enrichedEnv);       // estimates
  registerContactTools(server, enrichedEnv);        // clients
  registerSupplierTools(server, enrichedEnv);       // suppliers
  registerBankTools(server, enrichedEnv);           // bank accounts + transactions
  registerPurchaseTools(server, enrichedEnv);       // purchase invoices
  registerPurchaseOrderTools(server, enrichedEnv);  // purchase orders
  registerPaymentTools(server, enrichedEnv);        // payments
  registerReportTools(server, enrichedEnv);         // P&L, BS, aged, VAT
  registerLedgerTools(server, enrichedEnv);         // nominal ledger
  registerJournalTools(server, enrichedEnv);        // journals
  registerItemTools(server, enrichedEnv);           // inventory items
  registerProjectTools(server, enrichedEnv);        // project tags
  registerDocumentTools(server, enrichedEnv);       // document/receipt hub

  log.info('All tools registered — server ready');
  return server;
}

// ── Cloudflare Workers export ────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const bp = env.businessProfile ?? buildBusinessProfile(env);
      return new Response(
        JSON.stringify({
          status: 'ok',
          server: 'quickfile-mcp',
          version: '2.0.0',
          domains: 15,
          vatRegistered: bp?.vatRegistered ?? false,
          businessName: bp?.businessName ?? null,
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
    RATE_LIMIT_OVERRIDE: process.env['RATE_LIMIT_OVERRIDE'] ?? undefined,
    LOG_LEVEL:           process.env['LOG_LEVEL'] ?? undefined,
    QF_VAT_REGISTERED:   process.env['QF_VAT_REGISTERED'] ?? undefined,
    QF_BUSINESS_NAME:    process.env['QF_BUSINESS_NAME'] ?? undefined,
  };
  const server    = createServer(env);
  const transport = new StdioServerTransport();
  server.connect(transport).catch(err => {
    console.error('[quickfile-mcp] Fatal stdio error:', err);
    process.exit(1);
  });
}
