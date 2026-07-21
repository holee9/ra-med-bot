// SPEC-REGULA-IMPACT-001 — persist impact action items from scan results.

import type { AuditDbHandle } from '@/lib/kernel/audit';
import { impactActionItems } from '@/lib/kernel/db/schema';
import type { AffectedSection, ImpactLevel } from './types';

interface ActionItemInput {
  assessment_id: string;
  project_id: string;
  priority: ImpactLevel;
  sections: AffectedSection[];
  summary: string;
}

/**
 * Persists action items for a completed impact assessment.
 * One action item is created per affected section; a fallback generic item
 * is created when no sections were identified.
 */
export async function enqueueActionItems(
  input: ActionItemInput,
  db: AuditDbHandle,
  // 21 CFR Part 11 §11.10(e) — Issue #378 PR-E: optional caller tx so the
  // action-item INSERTs ride the same transaction as auditActionItemCreated.
  // Omit to keep the historical autocommit behavior (backward compatible).
  tx?: AuditDbHandle,
): Promise<void> {
  const q = tx ?? db;
  if (input.sections.length === 0) {
    await q.insert(impactActionItems).values({
      assessmentId: input.assessment_id,
      projectId: input.project_id,
      priority: input.priority,
      documentType: null,
      sectionReference: null,
      description: input.summary || 'Review regulatory update for potential impact.',
      status: 'open',
    });
    return;
  }

  const rows = input.sections.map((s) => ({
    assessmentId: input.assessment_id,
    projectId: input.project_id,
    priority: input.priority,
    documentType: s.document_type,
    sectionReference: s.section_reference,
    description: s.rationale,
    status: 'open' as const,
  }));

  await q.insert(impactActionItems).values(rows);
}
