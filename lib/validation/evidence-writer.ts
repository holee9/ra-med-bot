// @MX:ANCHOR [AUTO] insertValidationEvidence — shared INSERT helper for IQ/OQ/PQ collectors.
// @MX:REASON fan_in >= 3: M1 (IQ), M2 (OQ), M3 (PQ) collectors all call this.
//   Centralises Zod validation + dedup + Drizzle insert so collectors stay thin
//   glue layers (Charter [지양-5] no new harness). M5 sign-off reads these rows.
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (REQ-VAL-006, Issue #49)

import { db } from '@/lib/kernel/db/client';
import { validationEvidence } from '@/lib/kernel/db/schema';
import {
  type EvidenceResult,
  type QualificationType,
  validationEvidenceInsertSchema,
} from '@/lib/kernel/schemas/validation';
import { and, eq } from 'drizzle-orm';

/**
 * Input shape for a single evidence record. Collectors assemble this, then
 * hand off to insertValidationEvidence for Zod validation + Drizzle insert.
 *
 * `ciRunId` is NULL for IQ evidence collected outside CI (e.g. local collector
 * runs). OQ/PQ evidence collected from GitHub Actions MUST set this.
 */
export interface EvidenceInput {
  releaseId: string;
  qualificationType: QualificationType;
  commitSha: string;
  ciRunId?: number | null;
  testCommand: string;
  artifactPath?: string | null;
  result: EvidenceResult;
  metadata?: Record<string, unknown>;
}

/**
 * REQ-VAL-006 — insert a single validation_evidence row.
 *
 * Behaviour:
 *   1. Zod-validate the payload (throws ZodError on invalid input).
 *   2. Dedup: if (release_id, qualification_type, test_command) already exists
 *      with the same commit_sha, skip the insert and return the existing id.
 *      This makes collectors idempotent — re-running IQ bundle for the same
 *      release+commit does not produce duplicate rows.
 *   3. INSERT and return the row id.
 *
 * Does NOT write audit_logs — validation_evidence rows are themselves the
 * regulated record (21 CFR Part 11 §11.10(i)). The collector scripts run
 * outside the audit envelope; RBAC at the API route gates access.
 */
export async function insertValidationEvidence(input: EvidenceInput): Promise<string> {
  const parsed = validationEvidenceInsertSchema.parse({
    releaseId: input.releaseId,
    qualificationType: input.qualificationType,
    commitSha: input.commitSha,
    ciRunId: input.ciRunId ?? null,
    testCommand: input.testCommand,
    artifactPath: input.artifactPath ?? null,
    result: input.result,
    evidenceMetadata: input.metadata ?? {},
  });

  // Dedup: same release + qualification + test command + commit → skip.
  const existing = await db
    .select({ id: validationEvidence.id })
    .from(validationEvidence)
    .where(
      and(
        eq(validationEvidence.releaseId, parsed.releaseId),
        eq(validationEvidence.qualificationType, parsed.qualificationType),
        eq(validationEvidence.testCommand, parsed.testCommand),
        eq(validationEvidence.commitSha, parsed.commitSha),
      ),
    )
    .limit(1);

  const existingRow = existing[0];
  if (existingRow) {
    return existingRow.id;
  }

  const [inserted] = await db
    .insert(validationEvidence)
    .values({
      releaseId: parsed.releaseId,
      qualificationType: parsed.qualificationType,
      commitSha: parsed.commitSha,
      ciRunId: parsed.ciRunId ?? null,
      testCommand: parsed.testCommand,
      artifactPath: parsed.artifactPath ?? null,
      result: parsed.result,
      evidenceMetadata: parsed.evidenceMetadata,
    })
    .returning({ id: validationEvidence.id });

  if (!inserted) {
    throw new Error('validation_evidence insert returned no rows');
  }
  return inserted.id;
}

/**
 * Bulk wrapper — inserts multiple evidence rows transactionally.
 * Collectors (M1/M2/M3) call this with their assembled bundle.
 * Throws on first validation failure (atomic: all-or-nothing per row, but
 * each row is a separate INSERT — no transaction wrapping the bulk since
 * validation_evidence has no cross-row invariants).
 */
export async function insertEvidenceBundle(inputs: EvidenceInput[]): Promise<string[]> {
  const ids: string[] = [];
  for (const input of inputs) {
    const id = await insertValidationEvidence(input);
    ids.push(id);
  }
  return ids;
}
