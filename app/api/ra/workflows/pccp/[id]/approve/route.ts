// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-015, REQ-PCCP-016)
import { withPermission } from '@/lib/auth/with-permission';
import type { AuthSession } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { pccpComponents, pccpVersions } from '@/lib/db/schema';
import { auditPccpExpertApproved, auditPccpStatusChanged } from '@/lib/pccp/audit-wiring';
import { validatePccpCompleteness } from '@/lib/pccp/validator';
import { transitionPccpStatus } from '@/lib/pccp/version-manager';
import { eq } from 'drizzle-orm';

async function postApprove(
  _request: Request,
  params: { id: string },
  session: AuthSession,
): Promise<Response> {
  const { id } = params;

  const [version] = await db.select().from(pccpVersions).where(eq(pccpVersions.id, id)).limit(1);

  if (!version) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  if (version.status !== 'draft') {
    return Response.json(
      { error: `Cannot approve a PCCP in status "${version.status}". Must be "draft".` },
      { status: 409 },
    );
  }

  // REQ-PCCP-016: all 5 components must be completed before approval
  const components = await db
    .select({
      componentType: pccpComponents.componentType,
      completedAt: pccpComponents.completedAt,
    })
    .from(pccpComponents)
    .where(eq(pccpComponents.pccpVersionId, id));

  const completeness = validatePccpCompleteness(
    components.map((c) => ({
      componentType: c.componentType as import('@/lib/pccp/types').PccpComponentType,
      completedAt: c.completedAt,
    })),
  );

  if (!completeness.isComplete) {
    return Response.json(
      {
        error: 'Incomplete PCCP',
        details: `Missing components: [${completeness.missingComponents.join(', ')}]. Completion: ${completeness.completionPercentage}%`,
        completionPercentage: completeness.completionPercentage,
        missingComponents: completeness.missingComponents,
      },
      { status: 422 },
    );
  }

  await transitionPccpStatus({
    pccpVersionId: id,
    toStatus: 'submitted',
    actorId: session.user.id,
  });

  await auditPccpExpertApproved({ actorId: session.user.id, pccpVersionId: id });
  await auditPccpStatusChanged({
    actorId: session.user.id,
    pccpVersionId: id,
    fromStatus: 'draft',
    toStatus: 'submitted',
  });

  return Response.json({ id, status: 'submitted' });
}

export const POST = withPermission('consult.create', async (request, ctx, session) =>
  postApprove(request, (await ctx.params) as { id: string }, session),
);
