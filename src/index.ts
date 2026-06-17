// ─────────────────────────────────────────────────────────────
// QuickFile MCP Server — Main Entry Point v2.1
//
// Universal MCP server — works with ALL MCP clients:
//   • Perplexity AI    → POST /mcp  (Streamable HTTP)
//   • Claude.ai        → POST /mcp  (Streamable HTTP)
//   • Cursor / Continue→ GET+POST /sse (SSE transport alias)
//   • Claude Desktop   → stdio (Node.js)
//   • MCP Inspector    → GET /health
//   • Any HTTP client  → OPTIONS preflight (CORS open)
//
// Transport: WebStandardStreamableHTTPServerTransport (SDK 1.12.x)
// Stateless mode: new server + transport per request (no session IDs).
// All 15 QuickFile domains + overview fan-out registered here.
// ─────────────────────────────────────────────────────────────

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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

// ── CORS headers — allow all MCP clients ──────────────────────
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Accept',
  'Access-Control-Max-Age':       '86400',
};

function addCors(headers: Headers): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
}

function corsResponse(body: string | null, init: ResponseInit): Response {
  const res = new Response(body, init);
  addCors(res.headers);
  return res;
}

/**
 * Builds a BusinessProfile from raw env vars.
 */
function buildBusinessProfile(env: Env): BusinessProfile | undefined {
  const vatRegistered = env.QF_VAT_REGISTERED?.toLowerCase() === 'true';
  if (!vatRegistered && !env.QF_BUSINESS_NAME) return undefined;
  return {
    vatRegistered,
    vatPercentage: 20,
    businessName:  env.QF_BUSINESS_NAME,
  };
}

/**
 * Creates and fully registers the MCP server with all 15 domains.
 * Must be called fresh per request (stateless mode).
 */
export function createServer(env: Env): McpServer {
  const log = createLogger('server', env.LOG_LEVEL);

  const enrichedEnv: Env = {
    ...env,
    businessProfile: env.businessProfile ?? buildBusinessProfile(env),
  };

  const bp = enrichedEnv.businessProfile;
  if (bp) {
    log.info(
      `businessProfile: { vatRegistered: ${bp.vatRegistered}, vatPercentage: ${bp.vatPercentage}${
        bp.businessName ? `, businessName: "${bp.businessName}"` : ''
      } }`,
    );
  } else {
    log.info('businessProfile: not configured — vatPercentage must be supplied per line item');
  }

  log.info('Initialising QuickFile MCP server v2.1 — registering all 15 domains');

  const server = new McpServer({
    name:    'quickfile-mcp',
    version: '2.1.0',
  });

  registerOverviewTool(server, enrichedEnv);
  registerSystemTools(server, enrichedEnv);
  registerInvoiceTools(server, enrichedEnv);
  registerEstimateTools(server, enrichedEnv);
  registerContactTools(server, enrichedEnv);
  registerSupplierTools(server, enrichedEnv);
  registerBankTools(server, enrichedEnv);
  registerPurchaseTools(server, enrichedEnv);
  registerPurchaseOrderTools(server, enrichedEnv);
  registerPaymentTools(server, enrichedEnv);
  registerReportTools(server, enrichedEnv);
  registerLedgerTools(server, enrichedEnv);
  registerJournalTools(server, enrichedEnv);
  registerItemTools(server, enrichedEnv);
  registerProjectTools(server, enrichedEnv);
  registerDocumentTools(server, enrichedEnv);

  log.info('All 15 domain tool sets registered — server ready');
  return server;
}

/**
 * Handles a single MCP POST request using WebStandardStreamableHTTPServerTransport.
 * Creates fresh server + transport per request (stateless, no session leak).
 */
async function handleMcpPost(
  request: Request,
  env: Env,
  log: ReturnType<typeof createLogger>,
): Promise<Response> {
  try {
    // New transport + server per request — required for stateless CF Workers mode
    const transport = new WebStandardStreamableHTTPServerTransport({
      corsOptions: {
        allowedOrigins: ['*'],
      },
    });

    const server = createServer(env);
    await server.connect(transport);

    const response = await transport.handleRequest(request);

    // Ensure CORS headers are present (transport may not add them for all responses)
    addCors(response.headers);
    return response;
  } catch (err) {
    log.error('MCP handler error', { err: String(err) });
    return corsResponse(
      JSON.stringify({
        jsonrpc: '2.0',
        error:   { code: -32603, message: 'Internal server error', data: String(err) },
        id:      null,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

// ── Cloudflare Workers export ────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url    = new URL(request.url);
    const method = request.method.toUpperCase();
    const log    = createLogger('worker', env.LOG_LEVEL);

    log.info(`${method} ${request.url}`);

    // ── CORS preflight — all routes ──────────────────────────
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── Health check (unauthenticated) ───────────────────────
    if (url.pathname === '/health') {
      const bp = env.businessProfile ?? buildBusinessProfile(env);
      return corsResponse(
        JSON.stringify({
          status:        'ok',
          server:        'quickfile-mcp',
          version:       '2.1.0',
          transport:     ['streamable-http', 'sse-alias'],
          domains:       15,
          vatRegistered: bp?.vatRegistered ?? false,
          businessName:  bp?.businessName  ?? null,
          timestamp:     new Date().toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── MCP Streamable HTTP — POST /mcp ─────────────────────
    // Primary endpoint: Perplexity, Claude.ai, Cursor, any modern MCP client.
    if (url.pathname === '/mcp' && method === 'POST') {
      return handleMcpPost(request, env, log);
    }

    // ── SSE transport alias — /sse ───────────────────────────
    // Legacy/SSE clients (Cursor SSE mode, Continue.dev, older integrations).
    // GET /sse  → SSE discovery ping (200, text/event-stream)
    // POST /sse → same MCP handler
    if (url.pathname === '/sse') {
      if (method === 'GET') {
        return new Response(
          'data: {"type":"ping","server":"quickfile-mcp","version":"2.1.0"}\n\n',
          {
            status:  200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type':  'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection':    'keep-alive',
            },
          },
        );
      }
      if (method === 'POST') {
        return handleMcpPost(request, env, log);
      }
    }

    // ── robots.txt ─────────────────────────────────────────
    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // ── Root — usage hint ────────────────────────────────────
    return corsResponse(
      JSON.stringify({
        server:    'quickfile-mcp v2.1',
        endpoints: {
          health: 'GET  /health — server status (no auth)',
          mcp:    'POST /mcp    — MCP streamable HTTP (Perplexity, Claude.ai, Cursor, any MCP client)',
          sse:    'GET|POST /sse — SSE transport alias (Cursor SSE mode, Continue.dev)',
        },
        docs: 'https://github.com/Time-Plixer-Production/quickfile-mcp',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  },
};

// ── Node.js stdio entry (Claude Desktop / local use) ────────────
// Activated automatically when env vars are present in process.env.
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
    LOG_LEVEL:           process.env['LOG_LEVEL']           ?? undefined,
    QF_VAT_REGISTERED:   process.env['QF_VAT_REGISTERED']   ?? undefined,
    QF_BUSINESS_NAME:    process.env['QF_BUSINESS_NAME']    ?? undefined,
  };
  const server    = createServer(env);
  const transport = new StdioServerTransport();
  server.connect(transport).catch(err => {
    console.error('[quickfile-mcp] Fatal stdio error:', err);
    process.exit(1);
  });
}
