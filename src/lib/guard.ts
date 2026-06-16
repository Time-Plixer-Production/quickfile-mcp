// ─────────────────────────────────────────────────────────────
// Risk Guard — Operation-level authorization
// Classifies every QuickFile API operation by risk level:
//   READ   — safe, no confirmation needed
//   WRITE  — creates/modifies data, logs intent
//   DELETE — destructive, hard-blocked unless explicitly allowed
//
// This prevents prompt-injection attacks from silently triggering
// destructive or mutating QuickFile operations through the MCP.
// ─────────────────────────────────────────────────────────────

export type RiskLevel = 'READ' | 'WRITE' | 'DELETE';

interface OperationRisk {
  domain: string;
  method: string;
  risk: RiskLevel;
  description: string;
}

// Complete risk classification for all QuickFile API methods
const OPERATION_RISK_MAP: OperationRisk[] = [
  // ── READ operations (safe) ────────────────────────────────
  { domain: 'invoice',       method: 'Invoice_Search',           risk: 'READ',   description: 'Search invoices' },
  { domain: 'invoice',       method: 'Invoice_Get',              risk: 'READ',   description: 'Get invoice detail' },
  { domain: 'estimate',      method: 'Estimate_Search',          risk: 'READ',   description: 'Search estimates' },
  { domain: 'estimate',      method: 'Estimate_Get',             risk: 'READ',   description: 'Get estimate detail' },
  { domain: 'client',        method: 'Client_Search',            risk: 'READ',   description: 'Search clients' },
  { domain: 'client',        method: 'Client_Get',               risk: 'READ',   description: 'Get client detail' },
  { domain: 'supplier',      method: 'Supplier_Search',          risk: 'READ',   description: 'Search suppliers' },
  { domain: 'supplier',      method: 'Supplier_Get',             risk: 'READ',   description: 'Get supplier detail' },
  { domain: 'bank',          method: 'BankAccount_Search',       risk: 'READ',   description: 'Search bank accounts' },
  { domain: 'bank',          method: 'BankAccount_Get',          risk: 'READ',   description: 'Get bank account' },
  { domain: 'bank',          method: 'Transaction_Search',       risk: 'READ',   description: 'Search transactions' },
  { domain: 'purchase',      method: 'Purchase_Search',          risk: 'READ',   description: 'Search purchases' },
  { domain: 'purchase',      method: 'Purchase_Get',             risk: 'READ',   description: 'Get purchase detail' },
  { domain: 'purchaseorder', method: 'PurchaseOrder_Search',     risk: 'READ',   description: 'Search purchase orders' },
  { domain: 'purchaseorder', method: 'PurchaseOrder_Get',        risk: 'READ',   description: 'Get purchase order' },
  { domain: 'payment',       method: 'Payment_Search',           risk: 'READ',   description: 'Search payments' },
  { domain: 'payment',       method: 'Payment_Get',              risk: 'READ',   description: 'Get payment detail' },
  { domain: 'report',        method: 'ProfitAndLoss',            risk: 'READ',   description: 'P&L report' },
  { domain: 'report',        method: 'BalanceSheet',             risk: 'READ',   description: 'Balance sheet' },
  { domain: 'report',        method: 'AgedDebtors',              risk: 'READ',   description: 'Aged debtors report' },
  { domain: 'report',        method: 'AgedCreditors',            risk: 'READ',   description: 'Aged creditors report' },
  { domain: 'report',        method: 'VATReturn',                risk: 'READ',   description: 'VAT return' },
  { domain: 'ledger',        method: 'Nominal_Search',           risk: 'READ',   description: 'Search nominal codes' },
  { domain: 'ledger',        method: 'Nominal_Get',              risk: 'READ',   description: 'Get nominal code' },
  { domain: 'journal',       method: 'Journal_Search',           risk: 'READ',   description: 'Search journals' },
  { domain: 'journal',       method: 'Journal_Get',              risk: 'READ',   description: 'Get journal entry' },
  { domain: 'item',          method: 'Item_Search',              risk: 'READ',   description: 'Search inventory items' },
  { domain: 'item',          method: 'Item_Get',                 risk: 'READ',   description: 'Get item detail' },
  { domain: 'project',       method: 'Project_Search',           risk: 'READ',   description: 'Search projects' },
  { domain: 'project',       method: 'Project_Get',              risk: 'READ',   description: 'Get project detail' },
  { domain: 'document',      method: 'Document_Search',          risk: 'READ',   description: 'Search documents' },
  { domain: 'document',      method: 'Document_Get',             risk: 'READ',   description: 'Get document detail' },
  { domain: 'system',        method: 'Account_Get',              risk: 'READ',   description: 'Get account details' },
  // ── WRITE operations (mutating, logged) ──────────────────
  { domain: 'invoice',       method: 'Invoice_Create',           risk: 'WRITE',  description: 'Create new invoice' },
  { domain: 'invoice',       method: 'Invoice_Update',           risk: 'WRITE',  description: 'Update invoice' },
  { domain: 'invoice',       method: 'Invoice_SendEmail',        risk: 'WRITE',  description: 'Send invoice by email' },
  { domain: 'estimate',      method: 'Estimate_Create',          risk: 'WRITE',  description: 'Create estimate' },
  { domain: 'estimate',      method: 'Estimate_Update',          risk: 'WRITE',  description: 'Update estimate' },
  { domain: 'client',        method: 'Client_Create',            risk: 'WRITE',  description: 'Create client' },
  { domain: 'client',        method: 'Client_Update',            risk: 'WRITE',  description: 'Update client' },
  { domain: 'supplier',      method: 'Supplier_Create',          risk: 'WRITE',  description: 'Create supplier' },
  { domain: 'supplier',      method: 'Supplier_Update',          risk: 'WRITE',  description: 'Update supplier' },
  { domain: 'purchase',      method: 'Purchase_Create',          risk: 'WRITE',  description: 'Create purchase' },
  { domain: 'purchase',      method: 'Purchase_Update',          risk: 'WRITE',  description: 'Update purchase' },
  { domain: 'purchaseorder', method: 'PurchaseOrder_Create',     risk: 'WRITE',  description: 'Create purchase order' },
  { domain: 'payment',       method: 'Payment_Create',           risk: 'WRITE',  description: 'Record payment' },
  { domain: 'journal',       method: 'Journal_Create',           risk: 'WRITE',  description: 'Create journal entry' },
  { domain: 'item',          method: 'Item_Create',              risk: 'WRITE',  description: 'Create inventory item' },
  { domain: 'item',          method: 'Item_Update',              risk: 'WRITE',  description: 'Update inventory item' },
  { domain: 'project',       method: 'Project_Create',           risk: 'WRITE',  description: 'Create project tag' },
  { domain: 'document',      method: 'Document_Upload',          risk: 'WRITE',  description: 'Upload document/receipt' },
  // ── DELETE operations (destructive, blocked by default) ──
  { domain: 'invoice',       method: 'Invoice_Delete',           risk: 'DELETE', description: 'Delete invoice' },
  { domain: 'estimate',      method: 'Estimate_Delete',          risk: 'DELETE', description: 'Delete estimate' },
  { domain: 'client',        method: 'Client_Delete',            risk: 'DELETE', description: 'Delete client' },
  { domain: 'supplier',      method: 'Supplier_Delete',          risk: 'DELETE', description: 'Delete supplier' },
  { domain: 'purchase',      method: 'Purchase_Delete',          risk: 'DELETE', description: 'Delete purchase' },
  { domain: 'journal',       method: 'Journal_Delete',           risk: 'DELETE', description: 'Delete journal entry' },
  { domain: 'document',      method: 'Document_Delete',          risk: 'DELETE', description: 'Delete document' },
];

/** Lookup map for fast O(1) access */
const RISK_MAP = new Map<string, OperationRisk>(
  OPERATION_RISK_MAP.map(op => [`${op.domain}::${op.method}`, op])
);

/**
 * Returns the risk classification for a given domain+method.
 * Unknown operations default to WRITE (safe-side assumption).
 */
export function getOperationRisk(domain: string, method: string): OperationRisk {
  return RISK_MAP.get(`${domain}::${method}`) ?? {
    domain,
    method,
    risk: 'WRITE',
    description: 'Unknown operation (defaulting to WRITE risk)',
  };
}

/**
 * Asserts that a DELETE operation is explicitly allowed.
 * This is a hard block against prompt-injection attacks that
 * attempt to trigger destructive QuickFile operations.
 *
 * @param domain    - QuickFile domain
 * @param method    - QuickFile method name
 * @param confirmed - Must be explicitly set to true by the calling tool
 */
export function assertDeleteAllowed(domain: string, method: string, confirmed: boolean): void {
  const op = getOperationRisk(domain, method);
  if (op.risk === 'DELETE' && !confirmed) {
    throw new Error(
      `[quickfile-mcp] BLOCKED: Operation ${domain}/${method} ("${op.description}") is classified ` +
      `as DELETE risk. This operation is blocked unless the calling tool passes confirmed=true. ` +
      `This safeguard prevents prompt-injection attacks from triggering destructive accounting operations.`
    );
  }
}

/**
 * Returns a human-readable risk summary for the MCP response envelope.
 * Included in __provenance so the LLM and user can see what risk level was executed.
 */
export function riskSummary(domain: string, method: string): string {
  const op = getOperationRisk(domain, method);
  return `${op.risk}: ${op.description}`;
}
