import { describe, expect, it } from 'vitest';
import { WORKFLOW_REGISTRY } from '../../../lib/workflows/registry';

describe('WORKFLOW_REGISTRY', () => {
  // SPEC-REGULA-V3-RESTRUCTURE-001 (A1 archive): dhf, samd, esubmit removed (was 8 → 5).
  // SPEC-REGULA-PHI-REMOVAL-001 (Issue #319): 3 PMS/PMCF entries removed (was 11 → 8).
  // audit-response archived (CAPA = QMS, Charter [지양-3], #520): 5 → 4.
  it('has 4 entries', () => {
    expect(WORKFLOW_REGISTRY).toHaveLength(4);
  });

  it('each entry has required fields', () => {
    for (const workflow of WORKFLOW_REGISTRY) {
      expect(workflow).toHaveProperty('id');
      expect(workflow).toHaveProperty('title');
      expect(workflow).toHaveProperty('description');
      expect(workflow).toHaveProperty('stepCount');
      expect(workflow).toHaveProperty('href');
      expect(typeof workflow.id).toBe('string');
      expect(typeof workflow.title).toBe('string');
      expect(typeof workflow.description).toBe('string');
      expect(typeof workflow.stepCount).toBe('number');
      expect(typeof workflow.href).toBe('string');
    }
  });

  it('submission-drafter has 6 steps', () => {
    const workflow = WORKFLOW_REGISTRY.find((w) => w.id === 'submission-drafter');
    expect(workflow).toBeDefined();
    expect(workflow?.stepCount).toBe(6);
  });

  // audit-response archived (CAPA = QMS, Charter [지양-3], #520) — no registry entry.
  it('audit-response is not in the registry', () => {
    expect(WORKFLOW_REGISTRY.find((w) => w.id === 'audit-response')).toBeUndefined();
  });

  it('indication-impact has 6 steps', () => {
    const workflow = WORKFLOW_REGISTRY.find((w) => w.id === 'indication-impact');
    expect(workflow).toBeDefined();
    expect(workflow?.stepCount).toBe(6);
  });

  it('cer has 10 steps', () => {
    const workflow = WORKFLOW_REGISTRY.find((w) => w.id === 'cer');
    expect(workflow).toBeDefined();
    expect(workflow?.stepCount).toBe(10);
  });

  it('pccp has 4 steps', () => {
    const workflow = WORKFLOW_REGISTRY.find((w) => w.id === 'pccp');
    expect(workflow).toBeDefined();
    expect(workflow?.stepCount).toBe(4);
  });

  // SPEC-REGULA-V3-RESTRUCTURE-001 (A1 archive): dhf, samd, esubmit tests removed.
});
