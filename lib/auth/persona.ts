// @MX:NOTE [SPEC-V3-PERSONA-001] Persona tier derivation — pure functions only.
// Tier is a CLIENT-SIDE, view-only derivation from the server-authoritative Role.
// PersonaBar tier switching changes ONLY the visible IA (Sidebar/landing), never
// the actual permissions. Server-side `withPermission` / `hasRole` always read
// `session.user.role` (REQ-V3-PER-004 — RBAC immutability invariant).
//
// Verified mapping (research.md §2.3):
//   viewer, auditor            → employee  (auditor remains write-blocked via rbac.ts)
//   ra-member, qa-lead, ra-lead → ra
//   admin                      → admin
//
// Cookie (`regula-persona`) is NEVER trusted — every request re-derives the tier
// from `session.user.role` and rejects cookie values that would escalate privileges
// (REQ-V3-PER-005 / REQ-V3-PER-NFR-002). httpOnly:false is required so the
// client-side PersonaBar can read/write it; SSR reads via next/headers `cookies()`
// to avoid hydration mismatch (research.md §6-A4 — regula-locale pattern).

import type { Role } from '@/lib/auth/rbac';

/**
 * Persona tier — view-only IA switch. Does NOT affect permissions.
 */
export type Tier = 'employee' | 'ra' | 'admin';

/**
 * Cookie name. Matches the `regula-locale` SSR-safe pattern (layout.tsx:118).
 */
export const PERSONA_COOKIE = 'regula-persona';

/**
 * Verified role → tier mapping (research.md §2.3).
 * qa-lead maps to RA (rbac.ts: "QA lead can perform member-level work").
 * auditor maps to Employee tier but its write-block (withPermission) is preserved
 * independently of the PersonaBar (REQ-V3-PER-004).
 */
const ROLE_TO_TIER: Record<Role, Tier> = {
  viewer: 'employee',
  auditor: 'employee',
  'ra-member': 'ra',
  'qa-lead': 'ra',
  'ra-lead': 'ra',
  admin: 'admin',
};

/**
 * Tier privilege rank. A role may switch to any tier with rank ≤ its own
 * (no escalation). employee < ra < admin.
 */
const TIER_RANK: Record<Tier, number> = { employee: 0, ra: 1, admin: 2 };

/**
 * Derive the default (maximum) tier for a role.
 * Pure function, no side effects (REQ-V3-PER-NFR-003).
 */
export function personaTier(role: Role): Tier {
  return ROLE_TO_TIER[role];
}

/**
 * Validate whether a role is permitted to switch to a given tier.
 * Rejects any attempt to escalate above the role's natural tier.
 *
 * Examples:
 *   viewer  + admin   → false  (escalation blocked)
 *   admin   + employee → true   (down-tier allowed)
 *   ra-member + ra     → true
 *   ra-member + admin  → false  (escalation blocked)
 */
export function isValidTierForRole(role: Role, tier: Tier): boolean {
  return TIER_RANK[tier] <= TIER_RANK[ROLE_TO_TIER[role]];
}

/**
 * Minimal structural shape compatible with next/headers `ReadonlyRequestCookies`.
 * Kept loose so unit tests can pass a plain stub without importing next/headers.
 */
interface CookieReader {
  get(name: string): { value?: string } | undefined;
}

/**
 * Read the persona cookie on the server side.
 * Returns the tier only if the raw value is a valid tier literal; otherwise null.
 * Null does NOT mean "employee default" — the caller must fall back to
 * `personaTier(role)` and re-validate via `isValidTierForRole` (defense in depth).
 */
export function readPersonaCookie(cookieStore: CookieReader): Tier | null {
  const raw = cookieStore.get(PERSONA_COOKIE)?.value;
  if (raw === 'employee' || raw === 'ra' || raw === 'admin') {
    return raw;
  }
  return null;
}

/**
 * Resolve the effective tier for the current request — server-side canonical path.
 *
 * 1. Re-derive the role's natural tier (never trust the cookie alone).
 * 2. If a cookie tier exists AND is valid for the role, use it.
 * 3. Otherwise fall back to the role's natural tier.
 *
 * This is the single function layout.tsx should call: it enforces the
 * REQ-V3-PER-004 / REQ-V3-PER-NFR-002 invariant in one place.
 */
export function resolveTier(role: Role, cookieStore: CookieReader): Tier {
  const natural = personaTier(role);
  const cookieTier = readPersonaCookie(cookieStore);
  if (cookieTier && isValidTierForRole(role, cookieTier)) {
    return cookieTier;
  }
  return natural;
}

/**
 * Write the persona cookie from the client side (PersonaBar onTierChange).
 * CSR-only — no-op when `document` is undefined (SSR / test guards).
 *
 * httpOnly:false (client read required for hydration), path:'/', sameSite:'lax',
 * 30-day max-age. The value is always re-validated server-side via resolveTier,
 * so a tampered cookie cannot escalate privileges.
 */
export function writePersonaCookie(tier: Tier): void {
  if (typeof document === 'undefined') return;
  const maxAgeSeconds = 60 * 60 * 24 * 30; // 30 days
  // Intentionally simple — tier is a validated literal, no encoding needed.
  document.cookie = `${PERSONA_COOKIE}=${tier}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}
