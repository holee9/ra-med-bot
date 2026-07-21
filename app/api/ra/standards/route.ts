// POST /api/ra/standards — deterministic standards applicability lookup.
// @MX:SPEC SPEC-REGULA-STANDARDS-001

import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { type DeviceProfile, getApplicableStandards } from '@/lib/standards/applicability-engine';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const RequestSchema = z.object({
  deviceTypeKey: z.enum([
    'general_device',
    'electrical_medical_device',
    'software_only',
    'sterile_device',
    'in_vitro_diagnostic',
    'active_implantable',
  ]),
  regulatoryPathway: z.enum([
    'fda_510k',
    'fda_pma',
    'eu_mdr_class_i',
    'eu_mdr_class_ii',
    'eu_mdr_class_iii',
    'all',
  ]),
  hasSoftware: z.boolean().default(false),
  isElectrical: z.boolean().default(false),
  isSterile: z.boolean().default(false),
  usesAnimalTissue: z.boolean().default(false),
});

export const POST = withPermission('dashboard.view', async (req, _ctx, session) => {
  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile: DeviceProfile = parsed.data;
  const standards = getApplicableStandards(profile);

  await writeAudit({
    action: 'standards_searched',
    actor_id: session.user.id,
    resource_type: 'standards_catalog',
    resource_id: profile.deviceTypeKey,
    meta_json: {
      deviceTypeKey: profile.deviceTypeKey,
      regulatoryPathway: profile.regulatoryPathway,
      count: standards.length,
    },
  });

  return NextResponse.json({ standards, totalCount: standards.length });
});
