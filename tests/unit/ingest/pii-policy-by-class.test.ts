// RED Phase: Tests for lib/ingest/pii/policy-by-class.ts
// SPEC-REGULA-DOCINGEST-001 REQ-DOC-8B-5

import { describe, expect, it } from 'vitest';
import { DocClass } from '@/lib/ingest/doc-class';
import { PII_POLICY_BY_CLASS } from '@/lib/ingest/pii/policy-by-class';

describe('PII_POLICY_BY_CLASS', () => {
  it('should have a policy for every DocClass', () => {
    for (const cls of Object.values(DocClass)) {
      expect(PII_POLICY_BY_CLASS[cls]).toBeDefined();
    }
  });

  it('should have valid sensitivityLevel for each class', () => {
    const validLevels = ['low', 'medium', 'high', 'critical'];
    for (const cls of Object.values(DocClass)) {
      expect(validLevels).toContain(PII_POLICY_BY_CLASS[cls].sensitivityLevel);
    }
  });

  it('should have at least one layer for each class', () => {
    const validLayers = ['regex', 'workers_ai', 'presidio'];
    for (const cls of Object.values(DocClass)) {
      const { layers } = PII_POLICY_BY_CLASS[cls];
      expect(layers.length).toBeGreaterThan(0);
      for (const layer of layers) {
        expect(validLayers).toContain(layer);
      }
    }
  });

  it('clinical_report should be critical with all three layers', () => {
    const policy = PII_POLICY_BY_CLASS[DocClass.clinical_report];
    expect(policy.sensitivityLevel).toBe('critical');
    expect(policy.layers).toContain('regex');
    expect(policy.layers).toContain('workers_ai');
    expect(policy.layers).toContain('presidio');
  });

  it('checklist_template should be low with only regex layer', () => {
    const policy = PII_POLICY_BY_CLASS[DocClass.checklist_template];
    expect(policy.sensitivityLevel).toBe('low');
    expect(policy.layers).toContain('regex');
    expect(policy.layers).not.toContain('presidio');
  });

  it('issued_certificate should be medium', () => {
    const policy = PII_POLICY_BY_CLASS[DocClass.issued_certificate];
    expect(policy.sensitivityLevel).toBe('medium');
  });

  it('submission_success should be high', () => {
    const policy = PII_POLICY_BY_CLASS[DocClass.submission_success];
    expect(policy.sensitivityLevel).toBe('high');
  });

  it('audit_response should be high', () => {
    const policy = PII_POLICY_BY_CLASS[DocClass.audit_response];
    expect(policy.sensitivityLevel).toBe('high');
  });

  it('customPatterns should be an array', () => {
    for (const cls of Object.values(DocClass)) {
      expect(Array.isArray(PII_POLICY_BY_CLASS[cls].customPatterns)).toBe(true);
    }
  });
});
