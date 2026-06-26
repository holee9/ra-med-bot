// @MX:NOTE [AUTO] POST /api/standards/applicability — applicable-standards mapping (Issue #62).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-STANDARDS-001/019/021, AC-03)
// @MX:REASON Charter [지양-4]: mapping is decision-support, RA Lead reviews.
//   standards.read (viewer+) — broad read access because results inform the
//   whole RA team. Charter [지양-2]: every result carries catalogRowId + source
//   (citation provenance). 21 CFR Part 11 atomicity: 'standards.mapping.generated'
//   audit row is written in the same tx as any catalog lookup.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { withTenantScope } from '@/lib/db/client';
import type { DeviceProfile } from '@/lib/standards/applicability-engine';
import { mapApplicableStandards } from '@/lib/standards/mapping-engine';
import { z } from 'zod';

const DeviceProfileSchema = z.object({
  deviceTypeKey: z.string().min(1).max(80),
  regulatoryPathway: z.string().min(1).max(80),
  hasSoftware: z.boolean(),
  isElectrical: z.boolean(),
  isSterile: z.boolean(),
  usesAnimalTissue: z.boolean(),
}) satisfies z.ZodType<DeviceProfile>;

const BodySchema = z.object({
  deviceProfile: DeviceProfileSchema,
  projectId: z.string().uuid().optional(),
});

// POST /api/standards/applicability — map a device profile to applicable standards.
// AC-03: ≤5s response budget. The mapping engine is pure rule-based + one DB
// catalog lookup; even 0 catalog rows completes in well under 5s.
export const POST = withPermission('standards.read', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const orgId = session.user.organizationId ?? '';
  if (!orgId) return Response.json({ error: 'no_org_context' }, { status: 403 });

  // AC-03 ≤5s budget: the engine call is the hot path.
  const outcome = await mapApplicableStandards(parsed.data.deviceProfile, orgId);

  // Audit the mapping generation (21 CFR Part 11). No DB write beyond the
  // audit row — mapping is a read-side computation. The audit tx is standalone
  // because there is no business mutation to atomicize with.
  await withTenantScope(orgId, async (tx) => {
    await writeAudit(
      {
        actor_id: session.user.id,
        action: 'standards.mapping.generated',
        resource_type: 'standards_catalog',
        // No single resource for a mapping; use orgId as the anchor so the
        // audit trail can resolve "WHO in WHICH org generated WHICH list".
        resource_id: orgId,
        meta_json: {
          deviceProfileKey: outcome.deviceProfileKey,
          resultCount: outcome.results.length,
          durationMs: outcome.durationMs,
          projectId: parsed.data.projectId ?? null,
          // PII-free meta: only counts + keys, never the full profile.
        },
      },
      tx,
    );
  });

  return Response.json({
    results: outcome.results,
    deviceProfileKey: outcome.deviceProfileKey,
    durationMs: outcome.durationMs,
  });
});
