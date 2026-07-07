// POST /api/ra/esubmit/[id]/validate — run structural validation on the submission package.
// Returns validation issues. Does NOT call external FDA/EUDAMED APIs.

// @MX:LEGACY archived from app
// @MX:SPEC SPEC-REGULA-ESUBMIT-001

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { submissionPackages } from '@/lib/db/schema';
import { validateSubmissionPackage } from '@/lib/esubmit/validators';
import { and, eq } from 'drizzle-orm';

export const POST = withPermission('dashboard.view', async (_req, ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;
  if (!id) {
    return Response.json({ error: 'Missing package ID' }, { status: 400 });
  }

  const [pkg] = await db
    .select()
    .from(submissionPackages)
    .where(and(eq(submissionPackages.id, id), eq(submissionPackages.orgId, orgId)))
    .limit(1);

  if (!pkg) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Set status to 'validating' while running
  await db
    .update(submissionPackages)
    .set({ status: 'validating', updatedAt: new Date() })
    .where(eq(submissionPackages.id, id));

  const manifest = (pkg.packageManifest ?? {}) as Record<string, unknown>;
  const issues = validateSubmissionPackage(pkg.submissionType, manifest);

  const hasErrors = issues.some((i) => i.severity === 'error');
  const newStatus = hasErrors ? 'draft' : 'validated';

  await db
    .update(submissionPackages)
    .set({
      status: newStatus,
      validationResults: issues,
      updatedAt: new Date(),
    })
    .where(eq(submissionPackages.id, id));

  await writeAudit({
    actor_id: session.user.id,
    action: 'submission_validation_completed',
    resource_type: 'submission_package',
    resource_id: id,
    meta_json: {
      issue_count: issues.length,
      error_count: issues.filter((i) => i.severity === 'error').length,
      result: newStatus,
    },
  });

  return Response.json({ issues, status: newStatus });
});
