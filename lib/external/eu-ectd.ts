// @MX:TODO [AUTO] EU eCTD mTLS integration — feature-flagged placeholder. Implementation deferred.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-073), SPEC-REGULA-RELEASE-HARDENING-001 (REQ-HARDEN-018)
//
// mTLS rail preparation only. No implementation in Phase 7.
// Full implementation target: Phase 8 (document ingestion pipeline).

import { FeatureNotAvailableError, isFeatureEnabled } from '@/lib/feature-flags';

/**
 * EU eCTD submission endpoint base URL.
 * EMA common technical document submission gateway.
 */
export const EU_ECTD_ENDPOINT = 'https://eudralink.ema.europa.eu/api/v1';

/**
 * Configuration shape for EU eCTD mTLS connection.
 */
export interface EuEctdMtlsConfig {
  /** Cloudflare mTLS certificate binding name */
  certBinding: string;
  /** Target host for SNI */
  targetHost: string;
  /** EU region constraint — must match data_region = 'eu' */
  euRegionOnly: true;
  /** Optional timeout in ms */
  timeoutMs?: number;
}

/**
 * EU eCTD API client interface.
 * Phase 8 will implement this interface.
 */
export interface IEuEctdClient {
  /** Submit an eCTD dossier (Phase 8) */
  submitDossier(dossierData: unknown): Promise<{ applicationId: string }>;
  /** Retrieve submission receipt (Phase 8) */
  getReceipt(applicationId: string): Promise<{ status: string; receiptUrl?: string }>;
}

/**
 * Guards all EU eCTD integration entry points.
 * Throws FeatureNotAvailableError when EU_ECTD_CORPUS flag is disabled.
 * REQ-HARDEN-018: gated by feature flag; REQ-HARDEN-019: no mock data returned.
 */
export function assertEuEctdEnabled(): void {
  if (!isFeatureEnabled('EU_ECTD_CORPUS')) {
    throw new FeatureNotAvailableError('EU_ECTD_CORPUS');
  }
}

// No implementation — mTLS rail only. TypeScript must compile. (REQ-CF-073)
