// ─────────────────────────────────────────────────────────────
// Fan-out engine: executes multiple QuickFile domain calls in
// parallel and merges results. This is what gives the MCP server
// its "automatically query all relevant domains" behaviour.
// Each call gets its own unique submission number.
// ─────────────────────────────────────────────────────────────

import type { Env, FanOutCall, FanOutResult, MCPResult, QFDomain } from '../types/index.js';
import { callQF } from './quickfile.js';
import { RateLimiter } from './rateLimit.js';

/**
 * Executes a set of fan-out calls in parallel.
 * Each call gets an independent auth header + submission number.
 * Failed calls are caught individually and returned with ok:false
 * so that partial results from other domains are not lost.
 */
export async function fanOut(
  env: Env,
  calls: FanOutCall[],
  rateLimiter: RateLimiter
): Promise<FanOutResult[]> {
  rateLimiter.assertCanCall(calls.length);
  rateLimiter.consume(calls.length);

  const results = await Promise.allSettled(
    calls.map(async (call): Promise<FanOutResult> => {
      const { response, submissionNumber } = await callQF(
        env,
        call.domain,
        call.method,
        call.body
      );
      return {
        label: call.label,
        domain: call.domain,
        method: call.method,
        submissionNumber,
        ok: true,
        data: response.Body,
      };
    })
  );

  return results.map((r, i): FanOutResult => {
    const call = calls[i]!;
    if (r.status === 'fulfilled') return r.value;
    return {
      label: call.label,
      domain: call.domain,
      method: call.method,
      submissionNumber: 'n/a',
      ok: false,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}

/**
 * Wraps fan-out results into the standard MCPResult envelope
 * used by every MCP tool response.
 */
export function toMCPResult(
  fanOutResults: FanOutResult[],
  opts?: { metadata?: Record<string, unknown> }
): MCPResult {
  const successDomains = [...new Set(
    fanOutResults.filter(r => r.ok).map(r => r.domain)
  )] as QFDomain[];

  const successMethods = fanOutResults
    .filter(r => r.ok)
    .map(r => r.method);

  const submissionNumbers = fanOutResults.map(r => r.submissionNumber);

  // Build data map: { label -> data } for successful calls
  const dataMap: Record<string, unknown> = {};
  for (const r of fanOutResults) {
    dataMap[r.label] = r.ok
      ? r.data
      : { __error: r.error, __domain: r.domain, __method: r.method };
  }

  const anySuccess = fanOutResults.some(r => r.ok);

  return {
    domain: successDomains.length === 1 ? successDomains[0]! : successDomains,
    method: successMethods.length === 1 ? successMethods[0]! : successMethods,
    submissionNumbers,
    liveData: anySuccess,
    fetchedAt: new Date().toISOString(),
    data: dataMap,
    metadata: opts?.metadata,
  };
}
