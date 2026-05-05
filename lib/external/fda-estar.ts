// @MX:TODO [AUTO] FDA eSTAR mTLS integration — feature-flagged placeholder. Implementation deferred.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-073), SPEC-REGULA-RELEASE-HARDENING-001 (REQ-HARDEN-018)
//
// mTLS rail preparation only. No implementation in Phase 7.
// Full implementation target: Phase 8 (document ingestion pipeline).
//
// mTLS config shape (for Cloudflare Workers mTLS binding):
//   [mtls_certificates]
//   binding = "FDA_ESTAR_MTLS"
//   certificate_id = "<certificate-id-from-wrangler-cli>"
//
// Usage:
//   const response = await fetch(FDA_ESTAR_ENDPOINT, {
//     cf: { mtlsClientCert: { ... } },
//   });

import { FeatureNotAvailableError, isFeatureEnabled } from '@/lib/feature-flags';

/**
 * FDA eSTAR submission endpoint base URL.
 * Populated from environment variable in production.
 */
export const FDA_ESTAR_ENDPOINT = 'https://estar.fda.gov/api/v1';

/**
 * Configuration shape for FDA eSTAR mTLS connection.
 * Filled in when mTLS certificate is provisioned via Cloudflare dashboard.
 */
export interface FdaEstarMtlsConfig {
  /** Cloudflare mTLS certificate binding name */
  certBinding: string;
  /** Target host for SNI */
  targetHost: string;
  /** Optional timeout in ms */
  timeoutMs?: number;
}

/**
 * FDA eSTAR API client interface.
 * Phase 8 will implement this interface.
 */
export interface IFdaEstarClient {
  /** Submit an eSTAR package (Phase 8) */
  submitPackage(packageData: unknown): Promise<{ submissionId: string }>;
  /** Check submission status (Phase 8) */
  getStatus(submissionId: string): Promise<{ status: string }>;
}

/**
 * Guards all FDA eSTAR integration entry points.
 * Throws FeatureNotAvailableError when FDA_ESTAR_CORPUS flag is disabled.
 * REQ-HARDEN-018: gated by feature flag; REQ-HARDEN-019: no mock data returned.
 */
export function assertFdaEstarEnabled(): void {
  if (!isFeatureEnabled('FDA_ESTAR_CORPUS')) {
    throw new FeatureNotAvailableError('FDA_ESTAR_CORPUS');
  }
}

// No implementation — mTLS rail only. TypeScript must compile. (REQ-CF-073)
