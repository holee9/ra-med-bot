import { describe, expect, it } from 'vitest';
import { WORKFLOW_REGISTRY } from '../../../lib/workflows/registry';

describe('WORKFLOW_REGISTRY', () => {
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

  it('audit-response has 6 steps', () => {
    const workflow = WORKFLOW_REGISTRY.find((w) => w.id === 'audit-response');
    expect(workflow).toBeDefined();
    expect(workflow?.stepCount).toBe(6);
  });

  it('indication-impact has 6 steps', () => {
    const workflow = WORKFLOW_REGISTRY.find((w) => w.id === 'indication-impact');
    expect(workflow).toBeDefined();
    expect(workflow?.stepCount).toBe(6);
  });

  it('pccp has 4 steps', () => {
    const workflow = WORKFLOW_REGISTRY.find((w) => w.id === 'pccp');
    expect(workflow).toBeDefined();
    expect(workflow?.stepCount).toBe(4);
  });
});
