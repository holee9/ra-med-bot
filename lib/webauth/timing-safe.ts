// @MX:ANCHOR [AUTO] timingSafeEqual — Timing-safe string comparison
// @MX:REASON Prevents timing attacks on API key authentication. Required for inbound webhook security (OWASP A01:2021).
// @MX:SPEC Issue #188 (hybrid-ra-saas inbound webhook)

import * as crypto from 'node:crypto';

/**
 * Timing-safe string comparison using Node.js crypto module.
 * Prevents timing attacks on authentication tokens by comparing
 * in constant time regardless of input position.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns boolean - true if strings are equal, false otherwise
 *
 * @example
 * const isValid = timingSafeEqual(receivedKey, env.REGULA_API_KEY);
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBuffer = crypto.createHash('sha256').update(a, 'utf8').digest();
  const bBuffer = crypto.createHash('sha256').update(b, 'utf8').digest();

  try {
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch {
    return false;
  }
}
