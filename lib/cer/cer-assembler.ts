// @MX:ANCHOR Assembles the full CER document model consumed by both exporters.
// @MX:REASON CerDocument is the shared contract between assembly and the
// docx/pdf exporters; changing its shape ripples into both export paths.
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-026, REQ-CER-030, REQ-CER-031)

import type { EquivalenceAssessment } from './equivalence-builder';
import { CER_STAGES, type CerStageId } from './meddev-stages';
import type { PubMedArticle } from './pubmed-client';

export interface CerDocument {
  cerRunId: string;
  deviceName: string;
  manufacturer: string;
  createdAt: Date;
  stages: Array<{
    stageId: CerStageId;
    title: string;
    content: string;
    completed: boolean;
  }>;
  literatureReferences: PubMedArticle[];
  equivalenceAssessment?: EquivalenceAssessment;
}

/**
 * Assemble a complete CerDocument from per-stage content and supporting data.
 *
 * All 10 MEDDEV stages are emitted in canonical order regardless of how much
 * content is present — a stage with no authored content is included with empty
 * content and `completed: false` so the export reflects the true completion
 * state of the report (REQ-CER-031).
 */
export function assembleCer(params: {
  cerRunId: string;
  deviceName: string;
  manufacturer: string;
  stageContent: Map<CerStageId, string>;
  literature: PubMedArticle[];
  equivalenceAssessment?: EquivalenceAssessment;
}): CerDocument {
  const stages = CER_STAGES.map((stage) => {
    const content = (params.stageContent.get(stage.id) ?? '').trim();
    return {
      stageId: stage.id,
      title: stage.title,
      content,
      completed: content.length > 0,
    };
  });

  return {
    cerRunId: params.cerRunId,
    deviceName: params.deviceName,
    manufacturer: params.manufacturer,
    createdAt: new Date(),
    stages,
    literatureReferences: params.literature,
    equivalenceAssessment: params.equivalenceAssessment,
  };
}
