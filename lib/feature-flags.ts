// @MX:ANCHOR: [AUTO] Feature flag entry point — all external integration gates pass through here
// @MX:REASON: fan_in >= 3 (eu-ectd.ts, fda-estar.ts, future integrations); must remain stable

// Feature flags for corpus availability.
// Controlled via environment variables — no UI toggle needed for RC1.
// Default: all flags disabled in production.

export const FEATURE_FLAGS = {
  EU_ECTD_CORPUS: process.env.NEXT_PUBLIC_FEATURE_EU_ECTD === 'true',
  FDA_ESTAR_CORPUS: process.env.NEXT_PUBLIC_FEATURE_FDA_ESTAR === 'true',
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
