// @MX:ANCHOR [AUTO] Chunker registry — maps all 8 DocClass values to their chunker functions.
// @MX:REASON fan_in >= 3: ingest pipeline, upload handler, and Phase 8E retriever all call chunk().
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-054)
import { DocClass } from '../doc-class';
import type { Chunk, ChunkerFn } from './base';
import { chunkCerMeddev } from './cer-meddev';
import { chunkCertificate } from './certificate';
import { chunkChecklistTemplate } from './checklist-template';
import { chunkFda483Response } from './fda-483-response';
import { makeGenericChunker } from './generic';
import { chunkPmsPsur } from './pms-psur';
import { chunkSopIso13485 } from './sop-iso13485';
import { chunk510k } from './submission-510k';
import { chunkSubmissionEuMdr } from './submission-eu-mdr';
import { chunkSubmissionInprogress } from './submission-mfds';

/** Registry mapping each DocClass to its specialized chunker function. */
export const chunkerRegistry: Record<DocClass, ChunkerFn> = {
  [DocClass.issued_certificate]: chunkCertificate,
  [DocClass.submission_success]: chunk510k,
  [DocClass.submission_inprogress]: chunkSubmissionInprogress,
  [DocClass.clinical_report]: chunkCerMeddev,
  [DocClass.checklist_template]: chunkChecklistTemplate,
  [DocClass.surveillance_report]: chunkPmsPsur,
  [DocClass.internal_sop]: chunkSopIso13485,
  [DocClass.audit_response]: chunkFda483Response,
};

/**
 * Chunk a document using the appropriate chunker for the given DocClass.
 */
export function chunk(
  docClass: DocClass,
  text: string,
  metadata: Record<string, unknown>,
): Chunk[] {
  const chunker = chunkerRegistry[docClass];
  return chunker(text, metadata);
}
