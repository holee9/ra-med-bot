// @MX:NOTE [AUTO] Zod input schemas + result types for corpus-license lib.
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-001~014)
import { z } from 'zod';

// REQ-CORPUSLIC-001 — permitted_use boolean map. Each gate reads its key.
export const permittedUseSchema = z
  .object({
    ingest: z.boolean().default(true),
    embed: z.boolean().default(true),
    search: z.boolean().default(true),
    summarize: z.boolean().default(true),
    export: z.boolean().default(true),
  })
  .default({});

export const licenseTypeSchema = z.enum(['standard_paid', 'journal', 'internal_sop', 'open']);
export const confidentialityLevelSchema = z.enum(['public', 'internal', 'trade_secret']);
export const entitlementStatusSchema = z.enum(['active', 'revoked', 'expired']);

// REQ-CORPUSLIC-001 — POST/PUT /api/corpus-license/source-license payload.
export const sourceLicenseInputSchema = z.object({
  sourceId: z.string().uuid(),
  licenseType: licenseTypeSchema,
  entitlementRef: z.string().max(256).optional().nullable(),
  permittedUse: permittedUseSchema,
  fullTextAllowed: z.boolean().default(true),
  abstractOnly: z.boolean().default(false),
  confidentialityLevel: confidentialityLevelSchema.default('internal'),
  expiryDate: z.string().date().optional().nullable(),
});

// REQ-CORPUSLIC-002/003/004 — POST /api/corpus-license/ingestion-gate payload.
export const ingestionGateInputSchema = z.object({
  sourceId: z.string().uuid(),
  wantsFullText: z.boolean().default(true),
});

// REQ-CORPUSLIC-008 — POST /api/corpus-license/entitlement payload.
export const entitlementInputSchema = z.object({
  sourceLicenseId: z.string().uuid(),
  action: z.enum(['grant', 'revoke']),
});

export type SourceLicenseInput = z.infer<typeof sourceLicenseInputSchema>;
export type IngestionGateInput = z.infer<typeof ingestionGateInputSchema>;
export type EntitlementInput = z.infer<typeof entitlementInputSchema>;

// Result of a license-gate evaluation. `allowed=false` ⇒ `reason` is set.
export interface GateResult {
  allowed: boolean;
  reason?: string;
  licenseType?: string;
}

// REQ-CORPUSLIC-007/011 — per-source usage restriction text for answers/exports.
export interface SourceUsageNotice {
  sourceId: string;
  notice: string;
}
