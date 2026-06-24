// @MX:NOTE [AUTO] Zod input schemas + result types for cybersecurity domain.
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-001~014)
//
// All input boundaries use Zod. Results are plain typed objects (no class
// hierarchies) so they serialize cleanly to JSON for Route Handlers.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// REQ-001: threat-model generation input
// ---------------------------------------------------------------------------

export const architectureInputSchema = z.object({
  connectivity: z.array(z.string()).min(1),
  dataFlows: z.array(z.string()),
  assets: z.array(z.string()),
  trustBoundaries: z.array(z.string()),
  externalInterfaces: z.array(z.string()).default([]),
});
export type ArchitectureInput = z.infer<typeof architectureInputSchema>;

export const threatItemSchema = z.object({
  id: z.string(),
  category: z.enum([
    'spoofing',
    'tampering',
    'repudiation',
    'information_disclosure',
    'denial_of_service',
    'elevation_of_privilege',
  ]),
  title: z.string(),
  affectedAsset: z.string(),
  description: z.string(),
});
export type ThreatItem = z.infer<typeof threatItemSchema>;

export const gsprMappingEntrySchema = z.object({
  clause: z.string(),
  standard: z.enum(['GSPR_17.2', 'GSPR_17.4', 'IEC_81001_5_1']),
  requirement: z.string(),
  evidence: z.string(),
});
export type GsprMappingEntry = z.infer<typeof gsprMappingEntrySchema>;

// ---------------------------------------------------------------------------
// REQ-003/004: SBOM
// ---------------------------------------------------------------------------

export const sbomComponentSchema = z.object({
  name: z.string(),
  version: z.string(),
  supplier: z.string().optional(),
  purl: z.string().optional(),
  cpe: z.string().optional(),
});
export type SbomComponent = z.infer<typeof sbomComponentSchema>;

export const sbomImportInputSchema = z.object({
  projectId: z.string().uuid(),
  format: z.enum(['spdx', 'cyclonedx']),
  version: z.string().min(1).max(128),
  rawDocument: z.string().max(2_000_000), // 2MB cap — tier1 JSON only
});
export type SbomImportInput = z.infer<typeof sbomImportInputSchema>;

export const sbomDiffInputSchema = z.object({
  projectId: z.string().uuid(),
  versionA: z.string().min(1),
  versionB: z.string().min(1),
});
export type SbomDiffInput = z.infer<typeof sbomDiffInputSchema>;

export interface SbomDiffResult {
  added: SbomComponent[];
  removed: SbomComponent[];
  updated: { from: SbomComponent; to: SbomComponent }[];
}

// ---------------------------------------------------------------------------
// REQ-005/006: CVE analysis
// ---------------------------------------------------------------------------

export const cveRecordSchema = z.object({
  cveId: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
  kevFlag: z.boolean().default(false),
  cvssBaseScore: z.number().min(0).max(10),
});
export type CveRecord = z.infer<typeof cveRecordSchema>;

export const cveAnalysisInputSchema = z.object({
  projectId: z.string().uuid(),
  sbomId: z.string().uuid(),
  cves: z.array(cveRecordSchema),
});
export type CveAnalysisInput = z.infer<typeof cveAnalysisInputSchema>;

export type CveSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface CveImpactResult {
  cveId: string;
  kevFlag: boolean;
  severity: CveSeverity;
  affectedComponents: SbomComponent[];
  matched: boolean;
}

// ---------------------------------------------------------------------------
// REQ-007: secure update plan
// ---------------------------------------------------------------------------

export const updatePlanInputSchema = z.object({
  projectId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  endOfSupportDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  patchCadenceDays: z.number().int().min(1).max(365).default(90),
});
export type UpdatePlanInput = z.infer<typeof updatePlanInputSchema>;

export interface UpdatePlan {
  patchCadenceDays: number;
  endOfSupportDate: string | null;
  signingRequired: boolean;
  rollbackWindowDays: number;
  stages: { name: string; description: string }[];
}

// ---------------------------------------------------------------------------
// REQ-009/012/014: evidence bundle
// ---------------------------------------------------------------------------

export const evidenceBundleInputSchema = z.object({
  projectId: z.string().uuid(),
  threatModelId: z.string().uuid(),
  sbomId: z.string().uuid(),
  pentestArtifactPath: z.string().max(1024).optional(),
  updatePlan: z.record(z.unknown()).default({}),
  linkedSamdId: z.string().uuid().optional(),
  linkedDhfId: z.string().uuid().optional(),
  linkedSubmissionId: z.string().uuid().optional(),
});
export type EvidenceBundleInput = z.infer<typeof evidenceBundleInputSchema>;
