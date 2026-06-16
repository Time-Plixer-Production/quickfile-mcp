// ─────────────────────────────────────────────────────────────
// Global type definitions for the QuickFile MCP server
// ─────────────────────────────────────────────────────────────

export interface Env {
  QF_ACCOUNT_NUMBER: string;
  QF_API_KEY: string;
  QF_APP_ID: string;
  RATE_LIMIT_OVERRIDE?: string | undefined;
  LOG_LEVEL?: string | undefined;
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
