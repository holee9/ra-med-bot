// REQ-ENTERPRISE-018: ACL membership queries — org and project membership checks.
// Uses Drizzle ORM to query the org_members and project_members tables.

import { db } from '@/lib/db/client';
import { orgMembers, projectMembers } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Returns true when a membership row exists for the given userId + orgId pair.
 * Used by withPermission to enforce org-scoped action authorization.
 */
export async function isOrgMember(userId: string, orgId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Returns true when a membership row exists for the given userId + projectId pair.
 * Used by withPermission to enforce project-scoped action authorization.
 */
export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);
  return rows.length > 0;
}
