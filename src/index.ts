// ─────────────────────────────────────────────────────────────
// QuickFile MCP Server — Main Entry Point v2.0
//
// Dual runtime:
//   1. Cloudflare Workers — HTTP/SSE MCP transport (primary)
//      Any MCP client connects to: https://<worker>.workers.dev
//      /health   → JSON health check (no auth required)
//      /sse      → MCP SSE transport (GET, EventSource)
//      /messages → MCP SSE message endpoint (POST)
//      /mcp      → MCP streamable HTTP transport (POST)
//
//   2. Node.js stdio — Claude Desktop / local MCP clients
//      Activated when QF_ACCOUNT_NUMBER is set in process.env.
//
// All 15 QuickFile domains + overview fan-out registered here.
// ─────────────────────────────────────────────────────────────

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

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

// ── In-memory SSE session store (CF Workers isolate-scoped) ──
// Each SSE connection gets a unique sessionId. The transport is
// stored here so POST /messages can route to the right session.
const sseSessions = new Map<string, SSEServerTransport>();

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

// ── Cloudflare Workers export ────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url    = new URL(request.url);
    const method = request.method.toUpperCase();
    const log    = createLogger('worker', env.LOG_LEVEL);

    // ── Health check (unauthenticated) ───────────────────────
    if (url.pathname === '/health') {
      const bp = env.businessProfile ?? buildBusinessProfile(env);
      return new Response(
        JSON.stringify({
          status:       'ok',
          server:       'quickfile-mcp',
          version:      '2.0.0',
          domains:      15,
          vatRegistered: bp?.vatRegistered ?? false,
          businessName: bp?.businessName ?? null,
          timestamp:    new Date().toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── MCP SSE transport ─────────────────────────────────────
    // GET /sse  — client opens EventSource connection here.
    //             Server sends sessionId and begins SSE stream.
    if (url.pathname === '/sse' && method === 'GET') {
      log.info('SSE client connected');
      const server    = createServer(env);
      const transport = new SSEServerTransport('/messages', {} as unknown as Response);
      const sessionId = crypto.randomUUID();
      sseSessions.set(sessionId, transport);

      // Clean up on disconnect
      const cleanup = () => {
        sseSessions.delete(sessionId);
        log.info('SSE client disconnected', { sessionId });
      };

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Wire the MCP server to the SSE stream
      const sseTransport = new SSEServerTransport(
        '/messages',
        // CF Workers SSE: write directly to the transform stream
        {
          write: (chunk: string) => {
            writer.write(encoder.encode(chunk)).catch(cleanup);
          },
          end: cleanup,
        } as unknown as Response
      );

      sseSessions.set(sessionId, sseTransport);
      await server.connect(sseTransport);

      return new Response(readable, {
        headers: {
          'Content-Type':  'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection':    'keep-alive',
          'X-Session-Id':  sessionId,
        },
      });
    }

    // ── MCP SSE messages (POST /messages) ────────────────────
    // MCP client POSTs tool calls here after opening /sse.
    if (url.pathname === '/messages' && method === 'POST') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) {
        return new Response('Missing sessionId query param', { status: 400 });
      }
      const transport = sseSessions.get(sessionId);
      if (!transport) {
        return new Response('Session not found or expired', { status: 404 });
      }
      const body = await request.text();
      await transport.handlePostMessage(
        { body, headers: Object.fromEntries(request.headers) } as never,
        {} as never
      );
      return new Response('', { status: 202 });
    }

    // ── MCP Streamable HTTP transport (POST /mcp) ─────────────
    // Modern MCP clients (Claude.ai, etc.) use this single endpoint.
    // Each POST is a complete JSON-RPC request/response round-trip.
    if (url.pathname === '/mcp' && method === 'POST') {
      const body   = await request.json() as Record<string, unknown>;
      const server = createServer(env);

      return new Promise<Response>((resolve) => {
        let responseBody = '';

        const mockTransport = {
          onmessage: null as ((msg: unknown) => void) | null,
          async start() {},
          async send(msg: unknown) {
            responseBody = JSON.stringify(msg);
            resolve(new Response(responseBody, {
              headers: { 'Content-Type': 'application/json' },
            }));
          },
          async close() {},
        };

        server.connect(mockTransport as never).then(() => {
          if (mockTransport.onmessage) {
            mockTransport.onmessage(body);
          }
        }).catch(err => {
          log.error('MCP /mcp handler error', { err: String(err) });
          resolve(new Response(JSON.stringify({ error: 'Internal error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }));
        });
      });
    }

    // ── Root — usage hint ─────────────────────────────────────
    return new Response(
      JSON.stringify({
        server:    'quickfile-mcp v2.0',
        endpoints: {
          health:   'GET  /health  — server status',
          sse:      'GET  /sse     — MCP SSE transport (EventSource)',
          messages: 'POST /messages?sessionId=<id> — MCP SSE messages',
          mcp:      'POST /mcp     — MCP streamable HTTP (modern clients)',
        },
        docs: 'https://github.com/Time-Plixer-Production/quickfile-mcp',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  },
};

// ── Node.js stdio entry (Claude Desktop / local use) ─────────
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
