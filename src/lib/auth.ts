// ─────────────────────────────────────────────────────────────
// QuickFile Authentication Helper
// Computes the MD5-based auth header required by every QuickFile API call.
// MD5(AccountNumber + APIKey + SubmissionNumber) — lowercase hex.
// ─────────────────────────────────────────────────────────────

import type { Env, QFAuthHeader, QFRequestHeader } from '../types/index.js';
import { generateSubmissionNumber } from './submission.js';

/**
 * Computes the MD5 hash of a UTF-8 string using the Web Crypto SubtleCrypto API.
 * Returns lowercase hex string as required by QuickFile.
 */
async function md5(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  // Note: MD5 is NOT available in SubtleCrypto (only SHA family is).
  // We implement a pure-JS MD5 that runs in the Workers runtime.
  return md5PureJS(data);
}

// Pure-JS MD5 (RFC 1321) — no external dependency, runs in any runtime
function md5PureJS(input: Uint8Array): string {
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ] as const;
  const K: number[] = Array.from({ length: 64 }, (_, i) =>
    Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32)
  );
  const msg = Array.from(input);
  const origLen = msg.length * 8;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (let i = 0; i < 8; i++) msg.push((origLen >>> (i * 8)) & 0xff);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let i = 0; i < msg.length; i += 64) {
    const M: number[] = [];
    for (let j = 0; j < 16; j++) {
      M[j] =
        (msg[i + j * 4]!) |
        ((msg[i + j * 4 + 1]!) << 8) |
        ((msg[i + j * 4 + 2]!) << 16) |
        ((msg[i + j * 4 + 3]!) << 24);
    }
    let [A, B, C, D] = [a0, b0, c0, d0];
    for (let j = 0; j < 64; j++) {
      let F: number, g: number;
      if (j < 16) { F = (B & C) | (~B & D); g = j; }
      else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * j) % 16; }
      const temp = D;
      D = C; C = B;
      const sum = (A + F + (K[j] ?? 0) + (M[g] ?? 0)) >>> 0;
      const rot = s[j] ?? 7;
      B = ((B + ((sum << rot) | (sum >>> (32 - rot)))) >>> 0);
      A = temp;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }
  return [a0, b0, c0, d0]
    .map(n =>
      Array.from({ length: 4 }, (_, i) => ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')).join('')
    )
    .join('');
}

/**
 * Builds the complete QF request header including auth block.
 * Call this once per QuickFile API call; each call gets its own unique submission number.
 */
export async function buildAuthHeader(env: Env): Promise<{ header: QFRequestHeader; submissionNumber: string }> {
  const submissionNumber = generateSubmissionNumber();
  const hashInput = `${env.QF_ACCOUNT_NUMBER}${env.QF_API_KEY}${submissionNumber}`;
  const md5Value = await md5(hashInput);

  const auth: QFAuthHeader = {
    AccNumber: env.QF_ACCOUNT_NUMBER,
    MD5Value: md5Value,
    ApplicationID: env.QF_APP_ID,
    SubmissionNumber: submissionNumber,
  };

  const header: QFRequestHeader = {
    MessageType: 'Request',
    SubmissionNumber: submissionNumber,
    Authentication: auth,
  };

  return { header, submissionNumber };
}
