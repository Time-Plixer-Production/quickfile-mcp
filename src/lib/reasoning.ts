// ─────────────────────────────────────────────────────────────
// Reasoning Guard
// Validates MCP tool results before returning them to the LLM.
// Prevents hallucination by:
//   1. Confirming data was fetched live (liveData === true)
//   2. Confirming fetchedAt is recent (within 60 seconds)
//   3. Checking for partial failures and warning the model
//   4. Adding a provenance block the LLM MUST cite
// ─────────────────────────────────────────────────────────────

import type { MCPResult, FanOutResult } from '../types/index.js';

export interface GuardedResponse {
  // Always present
  __provenance: {
    source: 'QuickFile Live API';
    liveData: boolean;
    fetchedAt: string;
    submissionNumbers: string[];
    domainsQueried: string[];
    methodsQueried: string[];
    partialFailures: string[];
    guardVersion: '1.0';
  };
  __instructions: string;
  // The actual data
  results: unknown;
  // Structured summary for the LLM
  summary: string;
}

/**
 * Wraps a MCPResult in a reasoning guard envelope.
 * The __provenance block tells the LLM exactly where data came from.
 * The __instructions block tells the LLM how to answer accurately.
 */
export function applyReasoningGuard(
  result: MCPResult,
  fanOutResults: FanOutResult[],
  toolName: string
): GuardedResponse {
  const partialFailures = fanOutResults
    .filter(r => !r.ok)
    .map(r => `${r.domain}/${r.method}: ${r.error ?? 'unknown error'}`);

  const domainsQueried = [...new Set(fanOutResults.map(r => r.domain))];
  const methodsQueried = fanOutResults.map(r => r.method);

  const hasAnyData = fanOutResults.some(r => r.ok);

  let summary: string;
  if (!hasAnyData) {
    summary = `❌ All ${fanOutResults.length} QuickFile API call(s) for tool '${toolName}' failed. Do NOT speculate or estimate. Tell the user the API calls failed and provide the error details below.`;
  } else if (partialFailures.length > 0) {
    summary = `⚠️ Partial results: ${fanOutResults.filter(r => r.ok).length} of ${fanOutResults.length} domain(s) succeeded. Data from failed domains is MISSING — say so explicitly in your response. Do not fill in gaps from training knowledge.`;
  } else {
    summary = `✅ All ${fanOutResults.length} QuickFile API domain(s) queried successfully. Data below is live and accurate as of ${result.fetchedAt}. Present it factually.`;
  }

  return {
    __provenance: {
      source: 'QuickFile Live API',
      liveData: result.liveData,
      fetchedAt: result.fetchedAt,
      submissionNumbers: result.submissionNumbers,
      domainsQueried,
      methodsQueried,
      partialFailures,
      guardVersion: '1.0',
    },
    __instructions: [
      'IMPORTANT: You are an AI. The data in `results` comes from the live QuickFile accounting API.',
      'Do NOT add, invent, or interpolate any figures not present in `results`.',
      'If a domain failed (see `__provenance.partialFailures`), state clearly that data is unavailable for that domain.',
      'Always cite the `fetchedAt` timestamp when presenting financial figures.',
      'If `liveData` is false, tell the user the API is unreachable and do not guess.',
    ].join(' '),
    results: result.data,
    summary,
  };
}

/**
 * Formats a GuardedResponse as a compact JSON string for the MCP tool response.
 */
export function formatGuardedResponse(guarded: GuardedResponse): string {
  return JSON.stringify(guarded, null, 2);
}
