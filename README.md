# quickfile-mcp

> Production-grade [Model Context Protocol](https://modelcontextprotocol.io) server for the [QuickFile](https://quickfile.co.uk) UK accounting API.  
> Covers all 15 QuickFile domains · 28 tools · Cross-domain fan-out · Reasoning guard · Anti-hallucination · Works with Claude, ChatGPT, Cursor, and any MCP-compatible client.

---

## Architecture

```
src/
├── index.ts              ← MCP server entry (Workers + stdio)
├── types/index.ts        ← All types + 15 QFDomain literals
├── lib/
│   ├── auth.ts           ← MD5 auth header builder
│   ├── submission.ts     ← Unique submission number per API call
│   ├── quickfile.ts      ← Single authenticated HTTP call
│   ├── fanout.ts         ← Parallel multi-domain fan-out engine
│   ├── reasoning.ts      ← Truth guard — provenance + anti-hallucination
│   ├── router.ts         ← Keyword → domain routing
│   ├── cache.ts          ← In-memory TTL cache
│   ├── rateLimit.ts      ← Per-invocation rate limiter
│   └── logger.ts         ← Structured JSON logger (stderr)
└── tools/
    ├── overview.ts       ← get_full_account_overview (9-domain fan-out)
    ├── invoices.ts       ← search_sales_documents, get_invoice
    ├── estimates.ts      ← search_estimates, get_estimate, convert_estimate
    ├── contacts.ts       ← search_contacts, get_client, create_client
    ├── suppliers.ts      ← search_suppliers, get_supplier, create_supplier
    ├── bank.ts           ← get_cash_position, get_bank_activity
    ├── purchases.ts      ← search_purchases
    ├── purchaseorders.ts ← search_purchase_orders, get_purchase_order
    ├── payments.ts       ← search_payments
    ├── reports.ts        ← get_financial_report (P&L, BS, aged, VAT)
    ├── ledger.ts         ← query_ledger
    ├── journals.ts       ← search_journals, get_journal
    ├── items.ts          ← search_inventory_items, get_item
    ├── projects.ts       ← search_projects, get_project
    ├── documents.ts      ← list_documents
    └── system.ts         ← get_account_info, add_note, search_event_log
```

---

## Quick Start

See [docs/setup.md](docs/setup.md) for full instructions.  
See [docs/tools.md](docs/tools.md) for all 28 available tools.

```bash
git clone https://github.com/Time-Plixer-Production/quickfile-mcp.git
cd quickfile-mcp
npm install
npm run build
```

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "quickfile": {
      "command": "node",
      "args": ["/path/to/quickfile-mcp/dist/index.js"],
      "env": {
        "QF_ACCOUNT_NUMBER": "your_account_number",
        "QF_API_KEY": "your_api_key",
        "QF_APP_ID": "your_app_id"
      }
    }
  }
}
```

---

## How the Reasoning Guard Works

Every tool response is wrapped in a **truth envelope** before being returned to the LLM:

```json
{
  "__provenance": {
    "source": "QuickFile Live API",
    "liveData": true,
    "fetchedAt": "2026-06-16T18:30:00.000Z",
    "submissionNumbers": ["abc-123", "def-456"],
    "domainsQueried": ["invoice", "client"],
    "methodsQueried": ["Invoice_Search", "Client_Search"],
    "partialFailures": [],
    "guardVersion": "1.0"
  },
  "__instructions": "IMPORTANT: You are an AI. The data in results comes from the live QuickFile accounting API. Do NOT add, invent, or interpolate...",
  "summary": "✅ All 2 QuickFile API domain(s) queried successfully.",
  "results": { ... }
}
```

This forces any LLM to **cite live data only** and explicitly state when domains failed rather than filling gaps with training knowledge.

---

## Running Tests

```bash
npm test
```

---

## Deploying to Cloudflare Workers

```bash
npm install -g wrangler
wrangler secret put QF_ACCOUNT_NUMBER
wrangler secret put QF_API_KEY
wrangler secret put QF_APP_ID
npm run deploy
```

---

## Domain Coverage

| Domain | Methods covered |
|---|---|
| invoice | search, get |
| estimate | search, get, convert→invoice |
| client | search, get, create |
| supplier | search, get, create |
| bank | get accounts, search transactions |
| purchase | search |
| purchaseorder | search, get |
| payment | search |
| report | P&L, balance sheet, aged debtors, aged creditors, chart of accounts, VAT |
| ledger | search |
| journal | search, get |
| item | search, get |
| project | search, get |
| document | list |
| system | get account details, add note, search event log |

---

## License

MIT — © Time Plixer Production
