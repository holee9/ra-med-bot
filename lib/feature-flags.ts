// @MX:ANCHOR: [AUTO] Feature flag entry point — all external integration gates pass through here
// @MX:REASON: fan_in >= 3 (eu-ectd.ts, fda-estar.ts, future integrations); must remain stable

// Feature flags for corpus availability.
// Controlled via environment variables — no UI toggle needed for RC1.
// Default: all flags disabled in production.

export const FEATURE_FLAGS = {
  // --- Corpus availability (RC1) ---
  // Default: all flags disabled in production.
  EU_ECTD_CORPUS: process.env.NEXT_PUBLIC_FEATURE_EU_ECTD === 'true',
  FDA_ESTAR_CORPUS: process.env.NEXT_PUBLIC_FEATURE_FDA_ESTAR === 'true',

  // --- Scope rationalization (2026-06-28) ---
  // @MX:NOTE [AUTO] FREEZE/RETIRE sidebar domains — gated OFF by default.
  // @MX:SPEC docs/proposals/scope-rationalization-2026-06-28.md
  // These nav links belong to Charter out-of-scope (QMS per 지양-3) or
  // enterprise-infra domains over-provisioned for a 6-8 person internal team.
  // Re-enable per-domain via env (NEXT_PUBLIC_FEATURE_<NAME>=true) to restore
  // the nav link WITHOUT code changes — this is the "detach" mechanism:
  // code preserved, UI hidden, env-toggled. Role gating in app/(app)/layout.tsx
  // is AND-composed with these flags (role gate AND feature gate).
  CHANGE_CONTROL: process.env.NEXT_PUBLIC_FEATURE_CHANGE_CONTROL === 'true',
  LABELING: process.env.NEXT_PUBLIC_FEATURE_LABELING === 'true',
  CLINICAL_INVESTIGATION: process.env.NEXT_PUBLIC_FEATURE_CLINICAL_INVESTIGATION === 'true',
  SOURCE_GOVERNANCE: process.env.NEXT_PUBLIC_FEATURE_SOURCE_GOVERNANCE === 'true',
  QUALITY_HEATMAP: process.env.NEXT_PUBLIC_FEATURE_QUALITY_HEATMAP === 'true',
  TEAM_KNOWLEDGE: process.env.NEXT_PUBLIC_FEATURE_TEAM_KNOWLEDGE === 'true',
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

// @MX:ANCHOR: [AUTO] isFeatureEnabled — primary gate for all feature-flagged integrations
// @MX:REASON: Called by eu-ectd.ts, fda-estar.ts, and any future gated integration

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * Typed error thrown when a feature-flagged integration is invoked while disabled.
 * REQ-HARDEN-019: SHALL NOT return mock data implicitly.
 */
export class FeatureNotAvailableError extends Error {
  constructor(flag: FeatureFlag) {
    super(
      `Feature '${flag}' is not available in this environment. ` +
        `Set NEXT_PUBLIC_FEATURE_${flag} = 'true' to enable.`,
    );
    this.name = 'FeatureNotAvailableError';
  }
}
