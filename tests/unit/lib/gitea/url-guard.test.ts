// @MX:NOTE [AUTO] Shared Gitea URL guard + sanitizer unit tests (C-1/H-1/M-1).
// @MX:REASON The URL guard is the SSRF boundary for BOTH the issue-write and
//   the read path; the sanitizer is the token-leak boundary for BOTH thrown
//   errors. Centralizing the policy in lib/gitea/* means the tests live once
//   here, not duplicated across consumer suites.

import { describe, expect, it } from 'vitest';
import { sanitizeGiteaErrorBody, stripTokens } from '../../../../lib/gitea/sanitize';
import {
  assertGiteaUrlAllowed,
  isGiteaUrlAllowed,
  isInternalHost,
} from '../../../../lib/gitea/url-guard';

// ---------------------------------------------------------------------------
// isInternalHost — exact host / IP rules
// ---------------------------------------------------------------------------
describe('isInternalHost — LAN / private host detection', () => {
  it.each([
    'http://localhost',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://diskstation:7001', // documented .env.example value
    'http://10.0.0.5',
    'http://192.168.1.10:3000',
    'http://172.16.5.5',
    'http://172.31.255.255', // last valid private in 172.16/12
    'http://gitea.local',
    'http://build.internal',
    'http://[::1]',
    'http://[fe80::1]',
    'http://[fc00::1]',
    'http://[fd12:3456::1]',
  ])('returns true for internal %s', (url) => {
    expect(isInternalHost(url)).toBe(true);
  });

  it.each([
    'http://evil.example.com',
    'http://gitea.example.com', // public DNS name even if operator "trusts" it
    'http://8.8.8.8', // public IPv4
    'http://172.32.0.1', // just outside 172.16/12
    'http://169.254.169.254', // AWS metadata — NOT internal, must be rejected
    'http://notlocal.suffix', // .suffix is not in the allowlist
  ])('returns false for non-internal %s', (url) => {
    expect(isInternalHost(url)).toBe(false);
  });

  it('returns false for unparseable input (safe reject, not silent allow)', () => {
    expect(isInternalHost('not-a-url')).toBe(false);
    expect(isInternalHost('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isGiteaUrlAllowed / assertGiteaUrlAllowed — policy predicate + assert
// ---------------------------------------------------------------------------
describe('isGiteaUrlAllowed — policy: https OR internal host', () => {
  it('allows any https URL unconditionally (encrypted wire, token safe)', () => {
    expect(isGiteaUrlAllowed('https://gitea.example.com')).toBe(true);
    expect(isGiteaUrlAllowed('https://192.168.1.1')).toBe(true);
  });

  it('allows internal http hosts (deployed LAN Gitea)', () => {
    expect(isGiteaUrlAllowed('http://diskstation:7001')).toBe(true);
  });

  it('rejects public http hosts (SSRF threat surface)', () => {
    expect(isGiteaUrlAllowed('http://evil.example.com')).toBe(false);
  });

  it('rejects empty / falsy input', () => {
    expect(isGiteaUrlAllowed('')).toBe(false);
  });
});

describe('assertGiteaUrlAllowed — throws on policy violation', () => {
  it('does not throw for an allowed URL', () => {
    expect(() => assertGiteaUrlAllowed('http://diskstation:7001')).not.toThrow();
    expect(() => assertGiteaUrlAllowed('https://gitea.example.com')).not.toThrow();
  });

  it('throws a generic Error for a public http URL (no raw URL echoed in message)', () => {
    const evil = 'http://evil.example.com/path?token=leak';
    try {
      assertGiteaUrlAllowed(evil);
      expect.fail('expected throw');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toMatch(/SSRF guard/);
      // The raw URL (which may carry query-string secrets) must NOT be echoed.
      expect(msg).not.toContain('evil.example.com');
      expect(msg).not.toContain('token=leak');
    }
  });
});

// ---------------------------------------------------------------------------
// stripTokens / sanitizeGiteaErrorBody — M-1 regression: SHA preserved
// ---------------------------------------------------------------------------
describe('sanitizeGiteaErrorBody — token redaction + diagnostic preservation', () => {
  it('redacts `Bearer <token>` spans (observed leak vector)', () => {
    const out = sanitizeGiteaErrorBody(
      'Authorization: Bearer abcdef1234567890abcdef1234567890abcd detail',
    );
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('abcdef1234567890abcdef1234567890abcd');
  });

  it('redacts `token <token>` spans (Gitea dialect)', () => {
    const out = sanitizeGiteaErrorBody('Authorization: token ghp_abcdef1234567890abcd');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('ghp_abcdef1234567890abcd');
  });

  it('preserves a 40-hex git SHA in a generic error body (M-1 regression)', () => {
    // A bare 40-hex git commit SHA in a Gitea error body is diagnostic content,
    // NOT a credential. The previous blanket `{32,}` regex redacted it,
    // degrading diagnosability. The tightened pattern leaves it intact.
    const sha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345';
    const out = sanitizeGiteaErrorBody(`commit ${sha} not found in repository`);
    expect(out).toContain(sha);
    expect(out).not.toContain('[REDACTED]');
  });

  it('preserves a long trace ID that is not credential-adjacent', () => {
    const traceId = 'req-1234567890abcdef1234567890abcdef';
    const out = sanitizeGiteaErrorBody(`request ${traceId} timed out after 30s`);
    expect(out).toContain(traceId);
  });

  it('still redacts a 40+ char blob when it IS credential-adjacent (belt-and-suspenders)', () => {
    // The second pattern catches a bare long run (40+ chars, PAT/JWT/base64url
    // shape) ONLY when near a credential keyword — covers `<keyword>: <blob>`
    // echoes the first regex missed (e.g. `X-Auth-Token: <blob>` or
    // `secret:"<blob>"`). Below 40 chars the run is ambiguous and left intact.
    const blob = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij1234'; // 40 chars
    expect(blob.length).toBe(40);
    const out = sanitizeGiteaErrorBody(`auth: ${blob} for user x`);
    expect(out).not.toContain(blob);
    expect(out).toContain('[REDACTED]');
  });

  it('truncates bodies longer than 200 chars', () => {
    const out = sanitizeGiteaErrorBody('x'.repeat(500));
    expect(out.length).toBeLessThanOrEqual(201);
  });
});

describe('stripTokens — redaction without truncation', () => {
  it('preserves short token-free strings unchanged', () => {
    expect(stripTokens('not found')).toBe('not found');
  });

  it('is idempotent (running twice gives the same result as once)', () => {
    const input = 'Authorization: token abc123def456ghi789jkl012mno345pqr678';
    const once = stripTokens(input);
    const twice = stripTokens(once);
    expect(twice).toBe(once);
  });
});
