// @vitest-environment jsdom
// @MX:NOTE [SPEC-V3-PERSONA-001 M1] Unit tests for persona tier derivation.
// Covers: verified role→tier mapping, escalation rejection, cookie read/write,
// and the resolveTier canonical path (REQ-V3-PER-004 / REQ-V3-PER-NFR-002).

import {
  PERSONA_COOKIE,
  type Tier,
  isValidTierForRole,
  personaTier,
  readPersonaCookie,
  resolveTier,
  writePersonaCookie,
} from '@/lib/kernel/auth/persona';
import type { Role } from '@/lib/kernel/auth/rbac';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('personaTier — verified role→tier mapping (research.md §2.3)', () => {
  const cases: Array<[Role, Tier]> = [
    ['viewer', 'employee'],
    ['auditor', 'employee'],
    ['ra-member', 'ra'],
    ['qa-lead', 'ra'],
    ['ra-lead', 'ra'],
    ['admin', 'admin'],
  ];
  it.each(cases)('maps role %s → tier %s', (role, expected) => {
    expect(personaTier(role)).toBe(expected);
  });
});

describe('isValidTierForRole — escalation rejection (REQ-V3-PER-001/004)', () => {
  it('viewer can only switch to employee', () => {
    expect(isValidTierForRole('viewer', 'employee')).toBe(true);
    expect(isValidTierForRole('viewer', 'ra')).toBe(false);
    expect(isValidTierForRole('viewer', 'admin')).toBe(false);
  });

  it('auditor can only switch to employee (write-block preserved separately via rbac)', () => {
    expect(isValidTierForRole('auditor', 'employee')).toBe(true);
    expect(isValidTierForRole('auditor', 'ra')).toBe(false);
    expect(isValidTierForRole('auditor', 'admin')).toBe(false);
  });

  it('ra-member can switch to employee/ra, not admin', () => {
    expect(isValidTierForRole('ra-member', 'employee')).toBe(true);
    expect(isValidTierForRole('ra-member', 'ra')).toBe(true);
    expect(isValidTierForRole('ra-member', 'admin')).toBe(false);
  });

  it('qa-lead maps to RA tier range (rbac.ts member-level work)', () => {
    expect(isValidTierForRole('qa-lead', 'employee')).toBe(true);
    expect(isValidTierForRole('qa-lead', 'ra')).toBe(true);
    expect(isValidTierForRole('qa-lead', 'admin')).toBe(false);
  });

  it('ra-lead can switch to employee/ra, not admin', () => {
    expect(isValidTierForRole('ra-lead', 'employee')).toBe(true);
    expect(isValidTierForRole('ra-lead', 'ra')).toBe(true);
    expect(isValidTierForRole('ra-lead', 'admin')).toBe(false);
  });

  it('admin can switch to all three tiers (full range)', () => {
    expect(isValidTierForRole('admin', 'employee')).toBe(true);
    expect(isValidTierForRole('admin', 'ra')).toBe(true);
    expect(isValidTierForRole('admin', 'admin')).toBe(true);
  });
});

describe('readPersonaCookie', () => {
  const makeStore = (
    value: string | undefined,
  ): { get: (n: string) => { value?: string } | undefined } => ({
    get: (name: string) => (name === PERSONA_COOKIE ? { value } : undefined),
  });

  it('returns the tier when the cookie value is a valid tier literal', () => {
    expect(readPersonaCookie(makeStore('employee'))).toBe('employee');
    expect(readPersonaCookie(makeStore('ra'))).toBe('ra');
    expect(readPersonaCookie(makeStore('admin'))).toBe('admin');
  });

  it('returns null when the cookie is absent', () => {
    expect(readPersonaCookie(makeStore(undefined))).toBeNull();
  });

  it('returns null when the cookie value is tampered (not a tier literal)', () => {
    expect(readPersonaCookie(makeStore('superuser'))).toBeNull();
    expect(readPersonaCookie(makeStore(''))).toBeNull();
    expect(readPersonaCookie(makeStore('Admin'))).toBeNull(); // case-sensitive
  });
});

describe('resolveTier — server-side canonical path (REQ-V3-PER-004/NFR-002)', () => {
  const makeStore = (value: string | undefined) => ({
    get: (name: string) => (name === PERSONA_COOKIE ? { value } : undefined),
  });

  it('uses cookie tier when valid for the role', () => {
    // admin role with cookie=employee → employee (down-tier allowed)
    expect(resolveTier('admin', makeStore('employee'))).toBe('employee');
    // ra-member role with cookie=employee → employee
    expect(resolveTier('ra-member', makeStore('employee'))).toBe('employee');
  });

  it('falls back to role natural tier when cookie is absent', () => {
    expect(resolveTier('viewer', makeStore(undefined))).toBe('employee');
    expect(resolveTier('ra-lead', makeStore(undefined))).toBe('ra');
    expect(resolveTier('admin', makeStore(undefined))).toBe('admin');
  });

  it('rejects cookie escalation and falls back to role natural tier', () => {
    // viewer + cookie=admin → escalation blocked → employee (natural)
    expect(resolveTier('viewer', makeStore('admin'))).toBe('employee');
    // ra-member + cookie=admin → escalation blocked → ra (natural)
    expect(resolveTier('ra-member', makeStore('admin'))).toBe('ra');
    // auditor + cookie=ra → escalation blocked → employee (natural)
    expect(resolveTier('auditor', makeStore('ra'))).toBe('employee');
  });

  it('rejects tampered cookie and falls back to role natural tier', () => {
    expect(resolveTier('ra-lead', makeStore('hacker'))).toBe('ra');
    expect(resolveTier('admin', makeStore('superuser'))).toBe('admin');
  });
});

describe('writePersonaCookie — client-side cookie write', () => {
  afterEach(() => {
    // Clear the cookie between tests (jsdom persists document.cookie).
    document.cookie = `${PERSONA_COOKIE}=; path=/; max-age=0`;
  });

  it('writes the tier value to document.cookie with correct name', () => {
    writePersonaCookie('ra');
    expect(document.cookie).toContain(`${PERSONA_COOKIE}=ra`);
  });

  it('overwrites previous tier value on subsequent writes', () => {
    writePersonaCookie('ra');
    writePersonaCookie('admin');
    expect(document.cookie).toContain(`${PERSONA_COOKIE}=admin`);
    expect(document.cookie).not.toContain(`${PERSONA_COOKIE}=ra`);
  });

  it('is a no-op when document is undefined (SSR guard)', () => {
    const original = globalThis.document;
    document.cookie = `${PERSONA_COOKIE}=; path=/; max-age=0`;
    // @ts-expect-error — intentionally undefined to simulate SSR
    globalThis.document = undefined;
    expect(() => writePersonaCookie('ra')).not.toThrow();
    globalThis.document = original;
    expect(document.cookie).not.toContain(`${PERSONA_COOKIE}=ra`);
  });
});
