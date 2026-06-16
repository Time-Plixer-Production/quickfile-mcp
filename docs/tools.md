# Available MCP Tools

All 28 tools are registered when the server starts. Each tool returns a **reasoning guard envelope** with:
- `__provenance` — source, timestamp, submission numbers, domains queried
- `__instructions` — tells the LLM to cite live data only
- `results` — the actual live QuickFile data
- `summary` — ✅ success / ⚠️ partial / ❌ failed

---

## Cross-Domain

| Tool | Description | Domains |
|---|---|---|
| `get_full_account_overview` | Full snapshot — fans out to 9 domains at once | all major |

## System

| Tool | Description |
|---|---|
| `get_account_info` | Company name, VAT number, financial year settings |
| `add_note` | Add a note to an invoice, purchase, client, or supplier |
| `search_event_log` | Search the QuickFile system event log |

## Invoices

| Tool | Description |
|---|---|
| `search_sales_documents` | Search invoices (and optionally estimates) |
| `get_invoice` | Full detail of a single invoice |

## Estimates

| Tool | Description |
|---|---|
| `search_estimates` | Search quotes/estimates |
| `get_estimate` | Full detail of a single estimate |
| `convert_estimate_to_invoice` | Convert accepted estimate to invoice |

## Clients

| Tool | Description |
|---|---|
| `search_contacts` | Search clients + suppliers simultaneously |
| `get_client` | Full detail of a single client |
| `create_client` | Create a new client record |

## Suppliers

| Tool | Description |
|---|---|
| `search_suppliers` | Search supplier records |
| `get_supplier` | Full detail of a single supplier |
| `create_supplier` | Create a new supplier record |

## Bank

| Tool | Description |
|---|---|
| `get_cash_position` | All bank accounts + balances |
| `get_bank_activity` | Search bank transactions by date/nominal/reference |

## Purchases

| Tool | Description |
|---|---|
| `search_purchases` | Search purchase invoices (optionally + POs) |
| `search_purchase_orders` | Search purchase orders |
| `get_purchase_order` | Full detail of a single PO |

## Payments

| Tool | Description |
|---|---|
| `search_payments` | Search payment records |

## Reports

| Tool | Description |
|---|---|
| `get_financial_report` | P&L, balance sheet, aged debtors/creditors, VAT, chart of accounts |

## Ledger & Journals

| Tool | Description |
|---|---|
| `query_ledger` | Nominal ledger entries (optionally + journals) |
| `search_journals` | Search manual journal entries |
| `get_journal` | Full detail of a single journal entry |

## Inventory

| Tool | Description |
|---|---|
| `search_inventory_items` | Search products/services |
| `get_item` | Full detail of a single inventory item |

## Projects

| Tool | Description |
|---|---|
| `search_projects` | Search project tags |
| `get_project` | Full detail of a project tag with associated records |

## Documents

| Tool | Description |
|---|---|
| `list_documents` | List receipts and documents from the document hub |
