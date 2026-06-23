// @MX:NOTE [AUTO] StaleReason type alias — mirrors the stale_reason pgEnum.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-009)
import type { staleReasonEnum } from '@/lib/db/schema';

export type StaleReason = (typeof staleReasonEnum.enumValues)[number];
