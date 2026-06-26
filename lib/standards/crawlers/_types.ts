// @MX:NOTE [AUTO] Standards crawler type stubs — live crawlers deferred.
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-009 structural)
//
// Typed interface only. Live implementations land in follow-up issues:
//   @MX:TODO #62-A — ISO/IEC/CEN/ASTM crawlers on lib/radar/crawlers/_base.ts
//   @MX:TODO #62-B — FDA Recognized Consensus Standards DB (6000+ rows)
//   @MX:TODO #62-C — EU OJ Series C crawler + DoW parser
//
// These interfaces let the cron wiring be structurally complete today; the
// revision-detector returns [] until a crawler is implemented and registered.

import type { StandardsRawUpdate } from '../revision-detector';

export interface StandardsCrawlerContext {
  orgId: string;
  /** Optional since-product-number cursor (incremental crawl). */
  since?: string;
}

export type StandardsCrawler = {
  readonly name: 'iso' | 'iec' | 'cen' | 'astm' | 'fda' | 'eu_oj';
  /** Whether the crawler's env credentials are configured. */
  isConfigured(): boolean;
  /** Fetch raw updates since the cursor (or full scan if cursor absent). */
  fetch(ctx: StandardsCrawlerContext): Promise<StandardsRawUpdate[]>;
};
