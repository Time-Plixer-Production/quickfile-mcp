# QuickFile API Reference

> Authoritative reference for cross-verifying MCP tool coverage, schemas, and auth.
> Source: [api.quickfile.co.uk](https://api.quickfile.co.uk) · Updated: 2026-06

---

## Base URLs

| Format | Endpoint |
|--------|----------|
| JSON   | `https://api.quickfile.co.uk/1_2/{Domain}/{Method}` |
| XML    | `https://api.quickfile.co.uk/xml` |

All requests are `POST`. All bodies must be **UTF-8 encoded**.

---

## Authentication

Every request carries a signed header. The signature is an **MD5 hash** of three concatenated values:

```
MD5( AccountNumber + APIKey + SubmissionNumber )
```

| Field | Type | Notes |
|-------|------|-------|
| `AccNumber` | string | Your QuickFile account number |
| `MD5Value` | string | Lowercase hex MD5 hash |
| `ApplicationID` | string | From your registered app |
| `SubmissionNumber` | string | **Unique per call** — duplicate = error |

**Example hash input:** `123456789AAA3321-12BH-A2200001`  
**Resulting MD5:** `507c9d79c192da6e86428919ee0382dc`

> The MD5 must be **lowercase hex**. Uppercase will fail.

---

## Message Structure

Every request and response follows the same envelope:

```jsonc
// REQUEST
{
  "Header": {
    "MessageType": "Request",
    "SubmissionNumber": "<unique-guid>",
    "Authentication": {
      "AccNumber": "123456789",
      "MD5Value": "<lowercase-md5>",
      "ApplicationID": "<your-app-id>",
      "SubmissionNumber": "<unique-guid>"
    }
  },
  "Body": {
    // method-specific fields
  }
}

// RESPONSE
{
  "Header": {
    "MessageType": "Response",
    "SubmissionNumber": "<echoed>",
    "StatusCode": 0,              // 0 = success; non-zero = error
    "StatusDescription": "OK"
  },
  "Body": {
    // method-specific response data
  }
}
```

**Rules:**
- `StatusCode: 0` = success. Any other value = API-level error — read `StatusDescription`.
- Dates: `YYYY-MM-DDTHH:MM` (T separates date and time)
- Booleans: `true` / `false` lowercase only
- All requests UTF-8 encoded

---

## Rate Limits

| Limit | Value |
|-------|-------|
| Default daily cap | **1,000 calls/day** |
| Reset | ~midnight each day |
| Duplicate submission | **Error** — each `SubmissionNumber` must be unique |

To increase your limit, contact QuickFile support. The MCP server budgets **900/day** (10% safety margin).

---

## Registering an Application

1. Go to **Account Settings → 3rd Party Integrations → Create a QuickFile App**
2. Name your app and describe it
3. **Select each API method** your app needs — unselected methods will fail in production
4. Copy your `ApplicationID`
5. Test in the **Sandbox** (auth headers pre-populated from your account)

> The method selection step is critical. If an MCP tool calls a method you didn't enable, it will return a permission error at runtime, not a build error.

---

## Sandbox

- URL: [api.quickfile.co.uk/sandbox](https://api.quickfile.co.uk) (accessible from within your QF account)
- Auth headers are pre-filled when accessed from your account
- Use it to validate request/response schemas before deploying
- Beginners guide: [community.quickfile.co.uk/t/testing-the-api-beginners-guide/501](https://community.quickfile.co.uk/t/testing-the-api-beginners-guide/501)

---

## API Method Coverage

Complete list of domains and their methods. Each row maps to a `risk` level in `src/lib/guard.ts`.

### Bank

| Method | Risk | Description |
|--------|------|-------------|
| `BankAccount_Search` | READ | List/search bank accounts |
| `BankAccount_Get` | READ | Get single bank account detail |
| `BankAccount_Create` | WRITE | Create new bank account |
| `BankAccount_Update` | WRITE | Update bank account |
| `Transaction_Search` | READ | Search bank transactions |
| `Transaction_Get` | READ | Get single transaction |
| `Transaction_Create` | WRITE | Create bank transaction |
| `Transaction_Tag` | WRITE | Tag/categorise a transaction |

### Client

| Method | Risk | Description |
|--------|------|-------------|
| `Client_Search` | READ | Search clients |
| `Client_Get` | READ | Get client detail |
| `Client_Create` | WRITE | Create new client |
| `Client_Update` | WRITE | Update existing client |
| `Client_Delete` | DELETE | **Delete client — irreversible** |

### Document

| Method | Risk | Description |
|--------|------|-------------|
| `Document_Search` | READ | Search uploaded documents/receipts |
| `Document_Get` | READ | Get document metadata |
| `Document_Upload` | WRITE | Upload a receipt or attachment |
| `Document_Delete` | DELETE | **Delete document — irreversible** |

### Invoice

| Method | Risk | Description |
|--------|------|-------------|
| `Invoice_Search` | READ | Search invoices (supports date range, status filters) |
| `Invoice_Get` | READ | Get full invoice detail |
| `Invoice_Create` | WRITE | Create new sales invoice |
| `Invoice_Update` | WRITE | Update draft invoice |
| `Invoice_SendEmail` | WRITE | Send invoice to client by email |
| `Invoice_MarkSent` | WRITE | Mark invoice as sent |
| `Invoice_Delete` | DELETE | **Delete invoice — irreversible** |

### Item (Inventory)

| Method | Risk | Description |
|--------|------|-------------|
| `Item_Search` | READ | Search inventory/service items |
| `Item_Get` | READ | Get item detail |
| `Item_Create` | WRITE | Create new item |
| `Item_Update` | WRITE | Update item |

### Journal

| Method | Risk | Description |
|--------|------|-------------|
| `Journal_Search` | READ | Search journal entries |
| `Journal_Get` | READ | Get journal detail |
| `Journal_Create` | WRITE | Create manual journal entry |
| `Journal_Delete` | DELETE | **Delete journal — irreversible** |

### Ledger (Nominal)

| Method | Risk | Description |
|--------|------|-------------|
| `Nominal_Search` | READ | Search nominal codes |
| `Nominal_Get` | READ | Get nominal code detail |
| `Nominal_Create` | WRITE | Create custom nominal code |

### Payment

| Method | Risk | Description |
|--------|------|-------------|
| `Payment_Search` | READ | Search payment records |
| `Payment_Get` | READ | Get payment detail |
| `Payment_Create` | WRITE | Record a payment against an invoice |
| `Payment_Delete` | DELETE | **Delete payment record — irreversible** |

### Purchase

| Method | Risk | Description |
|--------|------|-------------|
| `Purchase_Search` | READ | Search purchase records |
| `Purchase_Get` | READ | Get purchase detail |
| `Purchase_Create` | WRITE | Create purchase record |
| `Purchase_Update` | WRITE | Update purchase record |
| `Purchase_Delete` | DELETE | **Delete purchase — irreversible** |

### PurchaseOrder

| Method | Risk | Description |
|--------|------|-------------|
| `PurchaseOrder_Search` | READ | Search purchase orders |
| `PurchaseOrder_Get` | READ | Get purchase order detail |
| `PurchaseOrder_Create` | WRITE | Create purchase order |
| `PurchaseOrder_Update` | WRITE | Update purchase order |

### Project

| Method | Risk | Description |
|--------|------|-------------|
| `Project_Search` | READ | Search projects/cost centres |
| `Project_Get` | READ | Get project detail |
| `Project_Create` | WRITE | Create project/tag |

### Report

| Method | Risk | Description |
|--------|------|-------------|
| `ProfitAndLoss` | READ | P&L statement (date range required) |
| `BalanceSheet` | READ | Balance sheet as of a date |
| `AgedDebtors` | READ | Outstanding invoices by age |
| `AgedCreditors` | READ | Outstanding purchases by age |
| `VATReturn` | READ | VAT return for a period |
| `TrialBalance` | READ | Trial balance summary |

### Supplier

| Method | Risk | Description |
|--------|------|-------------|
| `Supplier_Search` | READ | Search suppliers |
| `Supplier_Get` | READ | Get supplier detail |
| `Supplier_Create` | WRITE | Create supplier |
| `Supplier_Update` | WRITE | Update supplier |
| `Supplier_Delete` | DELETE | **Delete supplier — irreversible** |

### System

| Method | Risk | Description |
|--------|------|-------------|
| `Account_Get` | READ | Get account/company details |
| `Account_Update` | WRITE | Update account settings |

---

## Common Request Body Patterns

### Date Range Filter
Used by Invoice_Search, Purchase_Search, Report methods:
```jsonc
"SearchParameters": {
  "DateFrom": "2025-04-01T00:00",
  "DateTo":   "2026-03-31T23:59",
  "ReturnCount": 50,
  "Offset": 0
}
```

### Pagination
```jsonc
"SearchParameters": {
  "ReturnCount": 50,   // max records to return
  "Offset": 0          // skip N records for paging
}
```

### Invoice Create (minimal)
```jsonc
"InvoiceDetails": {
  "InvoiceType": "AC",          // AC = sales invoice
  "Currency": "GBP",
  "InvoiceDate": "2026-06-16T00:00",
  "DueDate":     "2026-07-16T00:00",
  "ClientDetails": { "ClientID": 12345 },
  "Items": [
    {
      "Description": "Consulting",
      "UnitPrice": 500.00,
      "Quantity": 1,
      "TaxCode": "T1"             // T0=0%, T1=20% VAT, T9=exempt
    }
  ]
}
```

### Payment Record (minimal)
```jsonc
"PaymentDetails": {
  "InvoiceID": 99999,
  "PaymentDate": "2026-06-16T00:00",
  "PaymentMethod": "BACS",
  "PaymentAmount": 500.00,
  "BankAccountID": 888
}
```

---

## Status Codes

| StatusCode | Meaning |
|------------|---------|
| `0` | Success |
| `1` | Authentication failure (bad MD5, wrong account, expired key) |
| `2` | Duplicate submission number |
| `3` | Validation error (bad schema, missing field) |
| `4` | Record not found |
| `5` | Permission denied (method not enabled in app registration) |
| `6` | Rate limit exceeded (>1000 calls/day) |
| `99` | Internal QuickFile error |

---

## VAT Tax Codes

| Code | Rate | Usage |
|------|------|-------|
| `T0` | 0% | Zero-rated supplies |
| `T1` | 20% | Standard UK VAT |
| `T2` | 0% | Exempt supplies |
| `T4` | 20% | Sales to VAT-registered EU businesses (pre-Brexit) |
| `T7` | 0% | Zero-rated purchases from EU |
| `T9` | N/A | Outside scope of VAT |

---

## Webhooks

QuickFile supports webhooks for near-real-time event notifications.

- Configured in **Account Settings → Webhooks**
- Events include: invoice created, invoice paid, purchase created, payment received
- Payload mirrors the API response `Body` structure
- Secured by a shared secret in the POST header

> Webhooks are read-only push events — they do not replace API polling but complement it.

---

## Cross-Verification Checklist

Use this to verify the MCP server is correctly wired to the API:

- [ ] Every tool in `src/tools/` calls a method listed in this doc
- [ ] Every method used by the MCP is enabled in your registered QuickFile App
- [ ] `StatusCode` is checked after every API call (done in `src/lib/quickfile.ts`)
- [ ] `SubmissionNumber` is unique per call (done in `src/lib/submission.ts`)
- [ ] MD5 is lowercase hex (done in `src/lib/auth.ts`)
- [ ] DELETE methods require `confirmed: true` in the calling tool (enforced by `src/lib/guard.ts`)
- [ ] Rate limiter budget ≤ 900/day (set in `src/lib/rateLimit.ts`)
- [ ] Dates in request bodies use `YYYY-MM-DDTHH:MM` format
- [ ] Booleans are lowercase `true`/`false` strings
- [ ] All string values are UTF-8 encoded

---

## Links

| Resource | URL |
|----------|-----|
| API Docs | https://api.quickfile.co.uk |
| Sandbox | https://api.quickfile.co.uk (access from QF account) |
| Community / Support | https://community.quickfile.co.uk |
| Beginners Guide | https://community.quickfile.co.uk/t/testing-the-api-beginners-guide/501 |
| API Updates Thread | https://community.quickfile.co.uk/t/important-updates-regarding-the-api/1106 |
