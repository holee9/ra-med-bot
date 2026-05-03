// @MX:ANCHOR [AUTO] getAuditTrail — read-only audit log query.
// @MX:REASON REQ-ENTERPRISE-037: read-only audit trail access for compliance reporting.
// fan_in will reach 3+ when admin dashboard, compliance export, and audit search endpoints land.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-037)
//
// IMPORTANT: This file MUST NOT contain db.insert / db.update / db.delete calls.
// Audit logs are immutable electronic records (21 CFR Part 11). Only read operations
// are permitted here. Writes go exclusively through lib/audit.ts#writeAudit().

import { and, asc, between, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../client';
import { auditLogs } from '../schema';

export interface AuditTrailParams {
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Query the audit log with optional filters. Results are ordered by
 * created_at DESC (newest first) to support compliance review workflows.
 *
 * Read-only: no insert/update/delete operations are performed here.
 */
export async function getAuditTrail(params: AuditTrailParams) {
  const conditions = [];

  if (params.resourceType) {
    conditions.push(eq(auditLogs.resourceType, params.resourceType));
  }
  if (params.resourceId) {
    conditions.push(eq(auditLogs.resourceId, params.resourceId));
  }
  if (params.actorId) {
    conditions.push(eq(auditLogs.actorId, params.actorId));
  }
  if (params.from && params.to) {
    conditions.push(between(auditLogs.createdAt, params.from, params.to));
  } else if (params.from) {
    conditions.push(gte(auditLogs.createdAt, params.from));
  } else if (params.to) {
    conditions.push(lte(auditLogs.createdAt, params.to));
  }

  const query = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));

  const withWhere = conditions.length > 0 ? query.where(and(...conditions)) : query;

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  return withWhere.limit(limit).offset(offset);
}
