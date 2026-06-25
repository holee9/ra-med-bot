// @MX:NOTE [AUTO] Runtime type aliases for corpus-license (avoids circular import on schema).
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001
export type LicenseType = 'standard_paid' | 'journal' | 'internal_sop' | 'open';
export type ConfidentialityLevel = 'public' | 'internal' | 'trade_secret';
export type EntitlementStatus = 'active' | 'revoked' | 'expired';

export interface PermittedUse {
  ingest: boolean;
  embed: boolean;
  search: boolean;
  summarize: boolean;
  export: boolean;
}
