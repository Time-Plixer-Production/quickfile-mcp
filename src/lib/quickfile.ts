// ─────────────────────────────────────────────────────────────
// QuickFile API HTTP client — HARDENED
// - Scrubs secrets from all error messages before propagating
// - Validates HTTP + API-level responses
// - 15s AbortController timeout on every request
// - Never logs request payloads (which contain auth headers)
// ─────────────────────────────────────────────────────────────

import type { Env, QFRequest, QFResponse, QFDomain } from '../types/index.js';
import { buildAuthHeader } from './auth.js';
import { safeError } from './scrubber.js';

const QF_BASE    = 'https://api.quickfile.co.uk/1_2';
const TIMEOUT_MS = 15_000;

/**
 * Makes a single authenticated QuickFile API call.
 * All thrown errors have secrets scrubbed before being propagated.
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
    Body:   body,
  };

  const url = `${QF_BASE}/${domain}/${method}`;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let httpResponse: Response;
  try {
    httpResponse = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    // Scrub any secret values that could appear in fetch error messages
    throw new Error(`[quickfile-mcp] Network error on ${domain}/${method}: ${safeError(err, env)}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!httpResponse.ok) {
    const rawText = await httpResponse.text().catch(() => '(no body)');
    // Scrub response body — QuickFile errors can echo back request fields
    throw new Error(
      `[quickfile-mcp] HTTP ${httpResponse.status} on ${domain}/${method}: ${safeError(rawText, env)}`
    );
  }

  const json = await httpResponse.json() as QFResponse<TResp>;

  // QuickFile returns StatusCode in header; non-zero = API-level error
  if (json.Header.StatusCode !== 0) {
    throw new Error(
      `[quickfile-mcp] QF API error [${json.Header.StatusCode}] on ${domain}/${method}: ` +
      safeError(json.Header.StatusDescription, env)
    );
  }

  return { response: json, submissionNumber };
}
