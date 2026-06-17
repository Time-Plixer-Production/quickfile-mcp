// ─────────────────────────────────────────────────────────────
// QuickFile MCP Server — Main Entry Point v2.1
//
// Universal MCP server — works with ALL MCP clients:
//   • Perplexity AI    → POST /mcp  (Streamable HTTP)
//   • Claude.ai        → POST /mcp  (Streamable HTTP)
//   • Cursor / Continue→ GET+POST /sse (SSE transport alias)
//   • Claude Desktop   → stdio (Node.js)
//   • MCP Inspector    → GET /health
//   • Any HTTP client  → OPTIONS preflight (CORS)
//
// Transport:
//   Cloudflare Workers uses StreamableHTTPServerTransport from the
//   official MCP SDK — NOT the broken mock-transport pattern.
//   SSEServerTransport is Node.js-only; Workers uses HTTP streaming.
//
// All 15 QuickFile domains + overview fan-out registered here.
// ─────────────────────────────────────────────────────────────

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Builds a BusinessProfile from raw env vars.
 * Called once at server startup — not per-request.
 */
function buildBusinessProfile(env: Env): BusinessProfile | undefined {
  const vatRegistered = env.QF_VAT_REGISTERED?.toLowerCase() === 'true';
  if (!vatRegistered && !env.QF_BUSINESS_NAME) return undefined;
  return {
    vatRegistered,
    vatPercentage: 20, // UK standard rate
    businessName:  env.QF_BUSINESS_NAME,
  };
}

/**
 * Creates and fully registers the MCP server with all 15 domains.
 * Returns the ready-to-connect McpServer instance.
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
 * Handles a single MCP request using the official StreamableHTTPServerTransport.
 * Works for both POST /mcp and POST /sse (alias).
 */
async function handleMcpRequest(request: Request, env: Env, log: ReturnType<typeof createLogger>): Promise<Response> {
  try {
    const server    = createServer(env);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    await server.connect(transport);

    const response = await transport.handleRequest(request);
    await server.close();

    return withCors(response);
  } catch (err) {
    log.error('MCP handler error', { err: String(err) });
    return withCors(
      new Response(JSON.stringify({ error: 'Internal server error', detail: String(err) }), {
        status:  500,
        headers: { 'Content-Type': 'application/json' },
      }),
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
      return withCors(
        new Response(
          JSON.stringify({
            status:        'ok',
            server:        'quickfile-mcp',
            version:       '2.1.0',
            transport:     ['streamable-http', 'sse'],
            domains:       15,
            vatRegistered: bp?.vatRegistered ?? false,
            businessName:  bp?.businessName  ?? null,
            timestamp:     new Date().toISOString(),
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }

    // ── MCP Streamable HTTP — POST /mcp ─────────────────────
    // Primary endpoint: Perplexity, Claude.ai, Cursor (HTTP mode), any modern client.
    if (url.pathname === '/mcp' && method === 'POST') {
      return handleMcpRequest(request, env, log);
    }

    // ── SSE transport alias — GET /sse and POST /sse ─────────
    // Legacy/SSE clients (Cursor SSE mode, Continue.dev, older integrations).
    // GET /sse  → SSE discovery / keepalive (200 text/event-stream)
    // POST /sse → identical to POST /mcp via same handler
    if (url.pathname === '/sse') {
      if (method === 'GET') {
        // SSE discovery ping — clients probe this before connecting
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
        return handleMcpRequest(request, env, log);
      }
    }

    // ── robots.txt — suppress crawler noise ─────────────────
    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // ── Root — usage hint ────────────────────────────────────
    return withCors(
      new Response(
        JSON.stringify({
          server:    'quickfile-mcp v2.1',
          endpoints: {
            health: 'GET  /health — server status (no auth)',
            mcp:    'POST /mcp    — MCP streamable HTTP (Perplexity, Claude.ai, Cursor, any MCP client)',
            sse:    'GET|POST /sse — SSE transport alias (Cursor SSE mode, Continue.dev, legacy clients)',
          },
          docs: 'https://github.com/Time-Plixer-Production/quickfile-mcp',
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
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
