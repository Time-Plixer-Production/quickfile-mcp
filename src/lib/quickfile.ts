// ─────────────────────────────────────────────────────────────
// QuickFile API HTTP client
// Single responsibility: make one authenticated call to any
// QuickFile endpoint and return the parsed response.
// All retries, fallbacks, and fan-out logic live in fanout.ts.
// ─────────────────────────────────────────────────────────────

import type { Env, QFRequest, QFResponse, QFDomain } from '../types/index.js';
import { buildAuthHeader } from './auth.js';

const QF_BASE = 'https://api.quickfile.co.uk/1_2';
const TIMEOUT_MS = 15_000;

/**
 * Makes a single authenticated QuickFile API call.
 * @param env      - Worker env bindings (secrets)
 * @param domain   - API domain e.g. 'invoice'
 * @param method   - Method name e.g. 'Invoice_Search'
 * @param body     - Request body (domain-specific payload)
 * @returns        - Parsed QFResponse with Header + Body
 */
export async function callQF<TBody = Record<string, unknown>, TResp = unknown>(
  env: Env,
  domain: QFDomain | string,
  method: string,
  body: TBody
): Promise<{ response: QFResponse<TResp>; submissionNumber: string }> {
  const { header, submissionNumber } = await buildAuthHeader(env);

  const payload: QFRequest<TBody> = {
    Header: header,
    Body: body,
  };

  const url = `${QF_BASE}/${domain}/${method}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let httpResponse: Response;
  try {
    httpResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!httpResponse.ok) {
    const text = await httpResponse.text().catch(() => '(no body)');
    throw new Error(
      `QuickFile HTTP ${httpResponse.status} for ${domain}/${method}: ${text}`
    );
  }

  const json = await httpResponse.json() as QFResponse<TResp>;

  // QuickFile returns StatusCode in the header; non-zero = API-level error
  if (json.Header.StatusCode !== 0) {
    throw new Error(
      `QuickFile API error [${json.Header.StatusCode}] on ${domain}/${method}: ${json.Header.StatusDescription}`
    );
  }

  return { response: json, submissionNumber };
}
