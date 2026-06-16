// ─────────────────────────────────────────────────────────────
// Global type definitions for the QuickFile MCP server
// ─────────────────────────────────────────────────────────────

/**
 * Optional business profile — stored in Wrangler vars (non-secret).
 * When vatRegistered is true, invoice/estimate/purchase WRITE tools
 * automatically apply the standard UK VAT rate (20%) to line items
 * without the LLM needing to ask per request.
 */
export interface BusinessProfile {
  /** Whether this account is VAT registered (default: false) */
  vatRegistered: boolean;
  /** Standard VAT percentage to apply when vatRegistered is true (default: 20) */
  vatPercentage: number;
  /** Trading name — surfaced in tool descriptions and error messages */
  businessName?: string | undefined;
}

export interface Env {
  QF_ACCOUNT_NUMBER: string;
  QF_API_KEY: string;
  QF_APP_ID: string;
  /** Override the default 900 calls/day rate-limit budget */
  RATE_LIMIT_OVERRIDE?: string | undefined;
  /** Log level: 'debug' | 'info' | 'warn' | 'error' (default: 'info') */
  LOG_LEVEL?: string | undefined;
  /**
   * Set QF_VAT_REGISTERED=true in wrangler.toml [vars] or process.env.
   * Populated into businessProfile at startup by index.ts.
   */
  QF_VAT_REGISTERED?: string | undefined;
  /** Trading name, used in tool hints */
  QF_BUSINESS_NAME?: string | undefined;
  /**
   * Populated at startup from QF_VAT_REGISTERED + QF_BUSINESS_NAME.
   * Not a raw env var — constructed by createServer() / stdio init.
   */
  businessProfile?: BusinessProfile | undefined;
}

// QuickFile API envelope types
export interface QFAuthHeader {
  AccNumber: string;
  MD5Value: string;
  ApplicationID: string;
  SubmissionNumber: string;
}

export interface QFRequestHeader {
  MessageType: 'Request';
  SubmissionNumber: string;
  Authentication: QFAuthHeader;
}

export interface QFRequest<TBody = Record<string, unknown>> {
  Header: QFRequestHeader;
  Body: TBody;
}

export interface QFResponseHeader {
  MessageType: 'Response';
  SubmissionNumber: string;
  StatusCode: number;
  StatusDescription: string;
}

export interface QFResponse<TBody = unknown> {
  Header: QFResponseHeader;
  Body: TBody;
}

// Domain names (all QuickFile API domains)
export type QFDomain =
  | 'bank'
  | 'client'
  | 'document'
  | 'estimate'
  | 'invoice'
  | 'item'
  | 'journal'
  | 'ledger'
  | 'payment'
  | 'project'
  | 'purchase'
  | 'purchaseorder'
  | 'report'
  | 'supplier'
  | 'system';

// MCP tool result structure
export interface MCPResult {
  domain: QFDomain | QFDomain[];
  method: string | string[];
  submissionNumbers: string[];
  liveData: boolean;   // always true — confirms real API fetch, not hallucination
  fetchedAt: string;   // ISO timestamp of when data was fetched
  data: unknown;
  metadata?: Record<string, unknown> | undefined;
}

// Reasoning guard verdict
export interface ReasoningVerdict {
  confident: boolean;
  domains: QFDomain[];
  methods: string[];
  rationale: string;
  warnings: string[];
}

// Fan-out call descriptor
export interface FanOutCall {
  domain: QFDomain;
  method: string;
  body: Record<string, unknown>;
  label: string;
}

// Fan-out result
export interface FanOutResult {
  label: string;
  domain: QFDomain;
  method: string;
  submissionNumber: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}
