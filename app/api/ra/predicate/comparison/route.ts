// @MX:ANCHOR [AUTO] POST|GET /api/ra/predicate/comparison — predicate comparison
//   session create + history list.
// @MX:REASON fan_in >= 3: shares the department-RBAC gate, comparison builder, and
//   workflow_runs persistence consumed by the approve sub-route and the history UI.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-011, REQ-PRE-017, REQ-PRE-018,
//   REQ-PRE-019, REQ-PRE-020, REQ-PRE-024, REQ-PRE-029)

// REQ-PRE-029: nodejs runtime required — department lookup uses the pg driver,
// which is not edge-runtime compatible.
export const runtime = 'nodejs';

import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { sharedAnthropicClient } from '@/lib/ai/anthropic-client';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { users, workflowRuns } from '@/lib/db/schema';
import { createComparisonBuilder } from '@/lib/predicate/comparison-builder';
import type { ComparisonDimension, PredicateCandidate } from '@/lib/predicate/types';

/** REQ-PRE-029: departments permitted to create a comparison. */
const WRITE_DEPARTMENTS = new Set(['RA', 'Dev']);
/** REQ-PRE-029: departments permitted to read comparison history (exec read-only). */
const READ_DEPARTMENTS = new Set(['RA', 'Dev', 'Exec']);

/** REQ-PRE-018: at most 3 predicates may be compared at once. */
const MAX_PREDICATES = 3;

const ComparisonDimensionSchema = z.enum([
  'intended_use',
  'indications',
  'tech_characteristics',
  'materials',
  'performance',
]);

const CreateComparisonSchema = z.object({
  subject_device_name: z.string().min(1).max(500),
  subject_inputs: z.record(ComparisonDimensionSchema, z.string()),
  selected_predicate_knumbers: z.array(z.string().min(1)).min(1).max(MAX_PREDICATES),
  session_id: z.string().optional(),
});

/** Fetch the caller's department; null when unset or the user row is missing. */
async function getDepartment(userId: string): Promise<string | null> {
  const rows = await db
    .select({ department: users.department })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.department ?? null;
}

/**
 * Build minimal predicate candidates from K-numbers. The route receives only
 * K-numbers (REQ-PRE-024); the descriptive fields are placeholders since the
 * comparison structure is keyed on the subject inputs and K-number identity.
 */
function candidatesFromKNumbers(kNumbers: string[]): PredicateCandidate[] {
  return kNumbers.map((k) => ({
    k_number: k,
    applicant_name: '',
    device_name: '',
    decision_date: '',
    decision: '',
    product_code: '',
    statement_or_summary: '',
    device_description: '',
  }));
}

// @MX:NOTE [AUTO] POST create — REQ-PRE-018 max-3 enforced here in addition to
//   the builder, so an over-limit request is rejected before any LLM call.
export const POST = withPermission('workflow.execute', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateComparisonSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { subject_device_name, subject_inputs, selected_predicate_knumbers } = parsed.data;

  // Department RBAC (REQ-PRE-029): only RA/Dev may create comparisons.
  const department = await getDepartment(session.user.id);
  if (!department || !WRITE_DEPARTMENTS.has(department)) {
    return Response.json({ error: 'permission_denied', reason: 'department' }, { status: 403 });
  }

  const predicates = candidatesFromKNumbers(selected_predicate_knumbers);
  const builder = createComparisonBuilder(sharedAnthropicClient);
  const comparison = await builder.buildComparison({
    subject_device_name,
    subject_inputs: subject_inputs as Record<ComparisonDimension, string>,
    selected_predicates: predicates,
  });

  // REQ-PRE-019 / REQ-PRE-024: persist the full comparison plus the selected
  // K-numbers in workflow_runs.resultJson so the session can be resumed.
  const orgId = session.user.organizationId ?? '';
  const [created] = await db
    .insert(workflowRuns)
    .values({
      userId: session.user.id,
      organizationId: orgId,
      workflowType: 'predicate_comparison',
      // Comparison generation completes synchronously and needs no async review.
      status: 'approved',
      inputJson: {
        subject_device_name,
        subject_inputs,
        selected_predicate_knumbers,
      },
      resultJson: {
        ...comparison,
        selected_predicate_knumbers,
      },
      reviewRequired: false,
    })
    .returning();

  // REQ-PRE-017: audit every comparison generation.
  await writeAudit({
    action: 'predicate_comparison_generated',
    actor_id: session.user.id,
    resource_type: 'predicate_comparison',
    resource_id: created?.id ?? 'unknown',
    meta_json: {
      predicate_k_numbers: selected_predicate_knumbers,
      subject_device_name,
    },
  });

  return Response.json({ workflow_run_id: created?.id, comparison });
});

const SORT_VALUES = new Set(['asc', 'desc']);

// @MX:NOTE [AUTO] GET history — REQ-PRE-020. Exec users (read-only) may list
//   their OWN saved comparisons; the user_id filter applies identically to all.
export const GET = withPermission('workflow.execute', async (req, _ctx, session) => {
  // Department RBAC (REQ-PRE-029): RA/Dev/Exec may list; External may not.
  const department = await getDepartment(session.user.id);
  if (!department || !READ_DEPARTMENTS.has(department)) {
    return Response.json({ error: 'permission_denied', reason: 'department' }, { status: 403 });
  }

  const url = new URL(req.url);
  const sortParam = url.searchParams.get('sort');
  const sort = sortParam && SORT_VALUES.has(sortParam) ? sortParam : 'desc';
  const orderBy = sort === 'asc' ? asc(workflowRuns.createdAt) : desc(workflowRuns.createdAt);

  const comparisons = await db
    .select({
      id: workflowRuns.id,
      resultJson: workflowRuns.resultJson,
      createdAt: workflowRuns.createdAt,
    })
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.userId, session.user.id),
        eq(workflowRuns.workflowType, 'predicate_comparison'),
      ),
    )
    .orderBy(orderBy);

  return Response.json({ comparisons });
});
