// @MX:NOTE [AUTO] POST /api/pms/inputs — complaint/vigilance data ingestion.
// @MX:SPEC SPEC-REGULA-PMS-001 (REQ-PMS-006, REQ-PMS-010, REQ-PMS-012, AC-05)
// Mutation + audit_log ride the same db.transaction (H2 atomicity pattern from
// traceability). IDOR: org ownership enforced via withPermission + org scope.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { withTenantScope } from '@/lib/db/client';
import { pmsInputs } from '@/lib/db/schema';
import { normalizePmsInput, validatePmsInput } from '@/lib/pms/inputs';
import { assertPmsProjectAccess } from '@/lib/pms/project-ownership';
import { z } from 'zod';

const PmsInputSchema = z.object({
  projectId: z.string().uuid(),
  source: z.string().min(1).max(64),
  severity: z.string().max(32).optional(),
  susar_flag: z.boolean().default(false),
  trend_category: z.string().max(64).optional(),
  payload: z.record(z.unknown()).optional(),
});

async function postInputs(
  request: Request,
  session: { user: { id: string; organizationId?: string } },
): Promise<Response> {
  const organizationId = session.user.organizationId;
  if (!organizationId) {
    return Response.json({ error: 'Organization context required' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid input', details: {} }, { status: 400 });
  }

  const parsed = PmsInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const accessDenied = await assertPmsProjectAccess(parsed.data.projectId, organizationId);
  if (accessDenied) return accessDenied;

  // Normalize + validate (REQ-PMS-012).
  const normalized = normalizePmsInput(parsed.data);
  const validation = validatePmsInput(normalized);
  if (!validation.ok) {
    return Response.json(
      { error: 'Validation failed', details: validation.errors },
      { status: 400 },
    );
  }

  // Mutation + audit in one transaction (H2 atomicity, 21 CFR Part 11).
  // #239 Phase 2: withTenantScope sets app.current_org_id GUC for RLS enforce.
  let insertedId: string;
  try {
    const result = await withTenantScope(organizationId, async (tx) => {
      const inserted = await tx
        .insert(pmsInputs)
        .values({
          orgId: organizationId,
          projectId: parsed.data.projectId,
          source: normalized.source,
          severity: normalized.severity ?? null,
          susarFlag: normalized.susarFlag,
          trendCategory: normalized.trendCategory ?? null,
          payload: normalized.payload,
          uploadedBy: session.user.id,
        })
        .returning({ id: pmsInputs.id });
      const inputId = inserted[0]?.id;
      if (!inputId) throw new Error('pms_inputs insert returned no rows');
      // Audit rides the same tx — if either fails, both roll back.
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'pms.input_uploaded',
          resource_type: 'pms_input',
          resource_id: inputId,
          meta_json: {
            projectId: parsed.data.projectId,
            source: normalized.source,
            susarFlag: normalized.susarFlag,
          },
        },
        tx,
      );
      return inputId;
    });
    insertedId = result;
  } catch (err) {
    // Audit write failure must fail the request (21 CFR Part 11).
    console.error('pms.input_uploaded failed (transaction rolled back)', err);
    return Response.json({ error: 'Failed to record input' }, { status: 500 });
  }

  return Response.json({ id: insertedId, status: 'stored' }, { status: 201 });
}

export const POST = withPermission('workflow.execute', async (req, _ctx, session) =>
  postInputs(req, session),
);
