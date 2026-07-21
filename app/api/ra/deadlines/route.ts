// @MX:NOTE [AUTO] GET/POST /api/ra/deadlines — regulatory deadline list + create.
// @MX:SPEC SPEC-REGULA-CALENDAR-001 (REQ-CAL-001..005, Issue #44)
//
// Project membership is enforced inside handlers via isProjectMember() because
// projectId arrives via query string (GET) or body (POST), not route params.

import { writeAudit } from '@/lib/kernel/audit';
import { isProjectMember } from '@/lib/kernel/auth/acl';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { regulatoryDeadlines } from '@/lib/kernel/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const DEADLINE_TYPES = [
  'fda_510k_clock',
  'eu_mdr_cert_expiry',
  'iso13485_surveillance',
  'pmda_reexam',
  'custom',
] as const;
const JURISDICTIONS = ['FDA', 'EU_MDR', 'MFDS', 'PMDA', 'NMPA', 'GLOBAL'] as const;
const STATUSES = ['upcoming', 'due_soon', 'overdue', 'completed', 'cancelled'] as const;

const CreateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(300),
  deadlineType: z.enum(DEADLINE_TYPES),
  jurisdiction: z.enum(JURISDICTIONS),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(STATUSES).default('upcoming'),
  reference: z.string().max(300).optional(),
  notes: z.string().max(5000).optional(),
});

// GET /api/ra/deadlines?projectId=&jurisdiction=&type=&status=
export const GET = withPermission('deadline.view', async (req, _ctx, session) => {
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId') ?? '';
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  // REQ-CAL-002: project membership enforced.
  const member = await isProjectMember(session.user.id, projectId);
  if (!member) {
    return NextResponse.json({ error: 'not_a_member', resource_type: 'project' }, { status: 403 });
  }

  const conditions = [eq(regulatoryDeadlines.projectId, projectId)];
  const jurisdiction = url.searchParams.get('jurisdiction');
  if (jurisdiction) conditions.push(eq(regulatoryDeadlines.jurisdiction, jurisdiction));
  const type = url.searchParams.get('type');
  if (type) conditions.push(eq(regulatoryDeadlines.deadlineType, type));
  const status = url.searchParams.get('status');
  if (status) conditions.push(eq(regulatoryDeadlines.status, status));

  const rows = await db
    .select()
    .from(regulatoryDeadlines)
    .where(and(...conditions))
    .orderBy(asc(regulatoryDeadlines.dueDate));

  return NextResponse.json({ deadlines: rows, count: rows.length });
});

// POST /api/ra/deadlines
export const POST = withPermission('deadline.manage', async (req, _ctx, session) => {
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // REQ-CAL-002: project membership enforced.
  const member = await isProjectMember(session.user.id, parsed.data.projectId);
  if (!member) {
    return NextResponse.json({ error: 'not_a_member', resource_type: 'project' }, { status: 403 });
  }

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(regulatoryDeadlines)
      .values({
        projectId: parsed.data.projectId,
        title: parsed.data.title,
        deadlineType: parsed.data.deadlineType,
        jurisdiction: parsed.data.jurisdiction,
        dueDate: new Date(parsed.data.dueDate),
        status: parsed.data.status,
        reference: parsed.data.reference ?? null,
        notes: parsed.data.notes ?? '',
        createdBy: session.user.id,
      })
      .returning({ id: regulatoryDeadlines.id, createdAt: regulatoryDeadlines.createdAt });

    if (!inserted) return null;

    await writeAudit(
      {
        action: 'deadline.created',
        actor_id: session.user.id,
        resource_type: 'deadline',
        resource_id: inserted.id,
        meta_json: {
          projectId: parsed.data.projectId,
          deadlineType: parsed.data.deadlineType,
          jurisdiction: parsed.data.jurisdiction,
        },
      },
      tx,
    );

    return inserted;
  });

  if (!created) {
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ deadline: created }, { status: 201 });
});
