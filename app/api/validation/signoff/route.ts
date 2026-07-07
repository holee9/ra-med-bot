// @MX:ANCHOR [AUTO] POST /api/validation/signoff — final release validation sign-off.
// @MX:REASON SPEC-REGULA-VALIDATION-001 M5 (REQ-VAL-012, REQ-VAL-013, AC-7, AC-8,
//   Issue #49). fan_in = 1 (single sign-off entry point) but this route is the
//   release gate — it must write exactly one audit_logs row whose hash chain
//   proves sign-off integrity. The route's behavior is the SPEC's central
//   invariant: checklist gate (AC-8) + rerun gate (AC-5) + writeAudit (AC-7).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M5, REQ-VAL-012, REQ-VAL-013, AC-5, AC-7, AC-8)

import { spawn } from 'node:child_process';
import { writeAuditReturningId } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { validationEvidence, validationSignoff } from '@/lib/db/schema';
import { checklistItemSchema } from '@/lib/schemas/validation';
import { buildChecklist, isChecklistSatisfied, unmetItems } from '@/lib/validation/checklist';
import { evaluateRerunGate } from '@/lib/validation/rerun-gate';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const signoffRequestSchema = z.object({
  releaseId: z.string().min(1).max(128),
  // Client-supplied checklist snapshot (id/title/met). Server re-evaluates from
  // DB state and ignores client met values — the client snapshot is recorded
  // in validation_signoff.checklist_state for audit, not for gate decisions.
  checklistState: z.object({ items: z.array(checklistItemSchema) }),
});

interface BuildReportResult {
  stdout: string;
  exitCode: number;
}

function runBuildReport(releaseId: string): Promise<BuildReportResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['--experimental-strip-types', 'scripts/validation/build-report.ts', releaseId],
      { cwd: process.cwd(), env: process.env },
    );
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ stdout, exitCode: exitCode ?? 1 }));
  });
}

/**
 * REQ-VAL-013 / AC-8 — final sign-off. Steps (in order):
 *   1. Validate input shape (Zod).
 *   2. Fetch evidence + rerun gate state from DB.
 *   3. Auto-generate the report (idempotent — re-writes the file). This makes
 *      the report:exported checklist item trivially met at sign-off time and
 *      ensures the report artifact path is fresh.
 *   4. Build canonical checklist from DB state. Reject with HTTP 409 + failed
 *      items if any unmet (AC-8). The rerun gate (AC-5) is embedded in the
 *      checklist as the `changes:resolved` item.
 *   5. writeAuditReturningId one row with action='validation.signoff'
 *      (AC-7, REQ-VAL-012). The audit_logs hash chain IS the tamper-evidence
 *      for sign-off.
 *   6. INSERT validation_signoff row with audit_log_ref.
 *   7. Return 200 with the signoff record.
 */
export const POST = withPermission('validation.approve', async (req, _ctx, session) => {
  const body = await req.json().catch(() => null);
  const parsed = signoffRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { releaseId, checklistState } = parsed.data;

  // Step 1: fetch evidence + rerun gate state from DB.
  const evidenceRows = await db
    .select({
      qualificationType: validationEvidence.qualificationType,
      result: validationEvidence.result,
    })
    .from(validationEvidence)
    .where(eq(validationEvidence.releaseId, releaseId));

  const rerunGate = await evaluateRerunGate(releaseId);

  // Step 2: auto-generate the report (idempotent — re-writes the file).
  let reportArtifactPath: string;
  try {
    const { stdout, exitCode } = await runBuildReport(releaseId);
    if (exitCode !== 0) {
      return Response.json(
        { error: 'Report generation failed during sign-off', releaseId },
        { status: 500 },
      );
    }
    reportArtifactPath = stdout.trim();
  } catch (err) {
    return Response.json(
      {
        error: 'Report builder invocation error',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }

  // Step 3: compute canonical checklist from DB state.
  const checklist = buildChecklist({
    hasIqPass: evidenceRows.some((r) => r.qualificationType === 'iq' && r.result === 'pass'),
    hasOqPass: evidenceRows.some((r) => r.qualificationType === 'oq' && r.result === 'pass'),
    hasPqPass: evidenceRows.some((r) => r.qualificationType === 'pq' && r.result === 'pass'),
    rerunGatePassed: rerunGate.passed,
    reportExported: true,
  });

  if (!isChecklistSatisfied(checklist)) {
    // AC-8: HTTP 409 with failed items.
    return Response.json(
      {
        error: 'signoff_checklist_unmet',
        releaseId,
        failed: unmetItems(checklist).map((i) => i.id),
      },
      { status: 409 },
    );
  }

  // Step 4: write one audit_logs row (AC-7). Hash chain is populated internally.
  let auditLogId: string;
  try {
    auditLogId = await writeAuditReturningId({
      actor_id: session.user.id,
      action: 'validation.signoff',
      resource_type: 'validationSignoff',
      resource_id: releaseId,
      meta_json: {
        releaseId,
        reportArtifactPath,
        signedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Audit failure must fail closed (21 CFR Part 11).
    return Response.json(
      {
        error: 'audit_write_failed',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }

  // Step 5: INSERT validation_signoff row.
  try {
    const [row] = await db
      .insert(validationSignoff)
      .values({
        releaseId,
        checklistState: { items: checklistState.items },
        approverId: session.user.id,
        reportArtifactPath,
        auditLogRef: auditLogId,
      })
      .returning({ id: validationSignoff.id, signedAt: validationSignoff.signedAt });

    if (!row) {
      return Response.json({ error: 'signoff_insert_failed' }, { status: 500 });
    }

    return Response.json(
      {
        signoffId: row.id,
        releaseId,
        approverId: session.user.id,
        signedAt: row.signedAt,
        reportArtifactPath,
        auditLogRef: auditLogId,
      },
      { status: 200 },
    );
  } catch (err) {
    // Likely UNIQUE constraint (second sign-off attempt on same release_id).
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('validation_signoff_release_id_key')) {
      return Response.json({ error: 'release_already_signed_off', releaseId }, { status: 409 });
    }
    return Response.json(
      {
        error: 'signoff_insert_failed',
        detail: message,
      },
      { status: 500 },
    );
  }
});
