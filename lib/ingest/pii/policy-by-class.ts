// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-8B-5)

import { DocClass } from '@/lib/ingest/doc-class';

export interface PiiPolicy {
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Detection layers applied in order: regex → workers_ai → presidio */
  layers: ('regex' | 'workers_ai' | 'presidio')[];
  customPatterns: RegExp[];
}

/**
 * Maps each DocClass to its PII detection policy.
 * - low (Layer 1 only): checklist_template — template content, minimal PII risk
 * - medium (Layer 1+2): issued_certificate, internal_sop — may contain patient IDs
 * - high (Layer 1+2): submission_*, surveillance_report, audit_response — regulatory docs
 * - critical (Layer 1+2+3): clinical_report — may contain PHI (Protected Health Information)
 */
export const PII_POLICY_BY_CLASS: Record<DocClass, PiiPolicy> = {
  [DocClass.issued_certificate]: {
    sensitivityLevel: 'medium',
    layers: ['regex', 'workers_ai'],
    customPatterns: [],
  },
  [DocClass.submission_success]: {
    sensitivityLevel: 'high',
    layers: ['regex', 'workers_ai'],
    customPatterns: [],
  },
  [DocClass.submission_inprogress]: {
    sensitivityLevel: 'high',
    layers: ['regex', 'workers_ai'],
    customPatterns: [],
  },
  [DocClass.clinical_report]: {
    sensitivityLevel: 'critical',
    layers: ['regex', 'workers_ai', 'presidio'],
    customPatterns: [],
  },
  [DocClass.checklist_template]: {
    sensitivityLevel: 'low',
    layers: ['regex'],
    customPatterns: [],
  },
  [DocClass.surveillance_report]: {
    sensitivityLevel: 'high',
    layers: ['regex', 'workers_ai'],
    customPatterns: [],
  },
  [DocClass.internal_sop]: {
    sensitivityLevel: 'medium',
    layers: ['regex', 'workers_ai'],
    customPatterns: [],
  },
  [DocClass.audit_response]: {
    sensitivityLevel: 'high',
    layers: ['regex', 'workers_ai'],
    customPatterns: [],
  },
};
