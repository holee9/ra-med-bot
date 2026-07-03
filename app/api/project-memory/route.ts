// @MX:NOTE [AUTO] GET/POST /api/project-memory — list + create (Issue #51).
// @MX:SPEC SPEC-REGULA-PROJECT-MEMORY-001 (REQ-006, REQ-007, REQ-011, AC-01, AC-08)
// @MX:REASON Charter [지양-4]: POST requires ra-lead (projectmemory.manage).
//   21 CFR Part 11 atomicity via createMemory (tx wraps insert + writeAudit).
//   IDOR guard (assertProjectInOrg) before any write. GET is ra-member+
//   (projectmemory.view) — project context is shared across the RA team.

import { withPermission } from '@/lib/auth/with-permission';
import { assertProjectInOrg } from '@/lib/project-memory/access';
import { createMemory, getValidMemories } from '@/lib/project-memory/manager';
import { z } from 'zod';

const MemoryTypeSchema = z.enum([
  'device_classification',
  'target_markets',
  'submission_strategy',
  'predicate_device',
  'risk_class',
  'custom',
]);

const CreateMemorySchema = z.object({
  projectId: z.string().uuid(),
  memoryType: MemoryTypeSchema,
  key: z.string().min(1).max(200),
  value: z.string().min(1).max(2000),
  sourceConversationId: z.string().uuid().nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
});

const ListQuerySchema = z.object({
  projectId: z.string().uuid(),
});

// GET /api/project-memory?projectId= — list valid memories (ra-member+).
export const GET = withPermission('projectmemory.view', async (req, _ctx, session) => {
  const url = new URL(req.url);
  const parsed = ListQuerySchema.safeParse({ projectId: url.searchParams.get('projectId') });
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const orgId = session.user.organizationId ?? '';
  if (!orgId) return Response.json({ error: 'no_org_context' }, { status: 403 });

  // IDOR guard (AC-08): writes denial audit on cross-org access.
  const denied = await assertProjectInOrg(parsed.data.projectId, {
    actorId: session.user.id,
    organizationId: orgId,
    action: 'projectmemory.view',
  });
  if (denied) return denied;

  const memories = await getValidMemories(parsed.data.projectId, orgId);
  return Response.json({ memories });
});

// POST /api/project-memory — create a memory (ra-lead only).
/* audit-check-ignore: audit (memory action) is written inside createMemory()
   within the same tx (21 CFR Part 11 atomicity) — route-level writeAudit would duplicate */
export const POST = withPermission('projectmemory.manage', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = CreateMemorySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const orgId = session.user.organizationId ?? '';
  if (!orgId) return Response.json({ error: 'no_org_context' }, { status: 403 });

  // IDOR guard (AC-08).
  const denied = await assertProjectInOrg(input.projectId, {
    actorId: session.user.id,
    organizationId: orgId,
    action: 'projectmemory.manage',
  });
  if (denied) return denied;

  try {
    const result = await createMemory({
      projectId: input.projectId,
      memoryType: input.memoryType,
      key: input.key,
      value: input.value,
      sourceConversationId: input.sourceConversationId ?? null,
      userId: session.user.id,
      orgId,
      status: 'active',
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    // Unique-index violation: concurrent same-key POST hit the partial
    // UNIQUE (project_id, key) WHERE status='active' index → 409, not 500.
    // Matches the bookmarks/route.ts pattern (lib/traceability/graph.ts
    // isUniqueViolation helper).
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return Response.json({ error: 'memory_duplicate_active_key' }, { status: 409 });
    }
    // Atomicity preserved — tx rolled back, no partial write / no partial audit.
    return Response.json({ error: 'memory_create_failed' }, { status: 500 });
  }
});
