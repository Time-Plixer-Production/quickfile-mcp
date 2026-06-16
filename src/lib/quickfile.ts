// ─────────────────────────────────────────────────────────────
// QuickFile API HTTP client — CF Workers + Node.js compatible
//
// - Uses global fetch (CF Workers native + Node 18+)
// - AbortController timeout typed as number:
//     CF Workers setTimeout returns number (not NodeJS.Timeout).
//     Node types are excluded from tsconfig.json to prevent
//     NodeJS.Timeout vs number conflict. Explicit annotation below.
// - All errors have secrets scrubbed before propagating
// - Validates both HTTP status and QF API StatusCode
// - 15s timeout per request
// - Never logs request payloads (contain auth credentials)
// ─────────────────────────────────────────────────────────────

import type { Env, QFRequest, QFResponse, QFDomain } from '../types/index.js';
import { buildAuthHeader } from './auth.js';
import { safeError } from './scrubber.js';

const QF_BASE    = 'https://api.quickfile.co.uk/1_2';
const TIMEOUT_MS = 15_000;

/**
 * Makes a single authenticated QuickFile API call.
 * Compatible with Cloudflare Workers (global fetch + crypto.randomUUID).
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
  // Explicit number type annotation.
  // CF Workers setTimeout returns number — do NOT use NodeJS.Timeout.
  // Node types are intentionally excluded from tsconfig.json.
  const timeoutId: number = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  ) as unknown as number;

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
    throw new Error(
      `[quickfile-mcp] Network error on ${domain}/${method}: ${safeError(err, env)}`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!httpResponse.ok) {
    const rawText = await httpResponse.text().catch(() => '(no body)');
    throw new Error(
      `[quickfile-mcp] HTTP ${httpResponse.status} on ${domain}/${method}: ${safeError(rawText, env)}`
    );
  }

  const json = await httpResponse.json() as QFResponse<TResp>;

  if (json.Header.StatusCode !== 0) {
    throw new Error(
      `[quickfile-mcp] QF API error [${json.Header.StatusCode}] on ${domain}/${method}: ` +
      safeError(json.Header.StatusDescription, env)
    );
  }

  return { response: json, submissionNumber };
}
