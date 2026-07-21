// @MX:NOTE [AUTO] GET /api/standards/check — FDA recognition real-time check (Issue #62).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-015/016, AC-06)
// @MX:REASON Charter [지양-3]: FDA endpoint is optional. When env unset, returns
//   degraded=true with the catalog row's status. AC-06: withdrawn → warn + alt.
//   21 CFR Part 11: 'standards.recognition.checked' audit row per call.

import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { withTenantScope } from '@/lib/kernel/db/client';
import { checkRecognition } from '@/lib/standards/recognition-check';
import { z } from 'zod';

const QuerySchema = z.object({
  standard: z.string().uuid(),
  jurisdiction: z.enum(['fda', 'eu']).optional().default('fda'),
});

// GET /api/standards/check?standard=...&jurisdiction=fda — recognition status.
export const GET = withPermission('standards.read', async (req, _ctx, session) => {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    standard: url.searchParams.get('standard') ?? undefined,
    jurisdiction: url.searchParams.get('jurisdiction') ?? 'fda',
  });
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const orgId = session.user.organizationId ?? '';
  if (!orgId) return Response.json({ error: 'no_org_context' }, { status: 403 });

  // EU jurisdiction is metadata-only today (REQ-016 structural; live EU OJ
  // crawler deferred to #62-C). Return catalog status with degraded flag.
  if (parsed.data.jurisdiction === 'eu') {
    await withTenantScope(orgId, async (tx) => {
      await writeAudit(
        {
          actor_id: session.user.id,
          action: 'standards.recognition.checked',
          resource_type: 'standards_catalog',
          resource_id: parsed.data.standard,
          meta_json: { jurisdiction: 'eu', degraded: true },
        },
        tx,
      );
    });
    return Response.json({
      standardId: parsed.data.standard,
      jurisdiction: 'eu',
      degraded: true,
      note: 'EU OJ live crawler not yet implemented (#62-C); use catalog eu_harmonized flag.',
    });
  }

  const result = await checkRecognition(parsed.data.standard, orgId);

  await withTenantScope(orgId, async (tx) => {
    await writeAudit(
      {
        actor_id: session.user.id,
        action: 'standards.recognition.checked',
        resource_type: 'standards_catalog',
        resource_id: parsed.data.standard,
        meta_json: {
          jurisdiction: 'fda',
          status: result.status,
          degraded: result.degraded,
          alternativeSuggested: Boolean(result.alternativeStandardId),
        },
      },
      tx,
    );
  });

  return Response.json(result);
});
