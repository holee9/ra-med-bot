// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-001, REQ-PCCP-002)
// Verifies PCCP migration artifacts: table shape from schema + step definitions.

import { pccpComponents, pccpVersions } from '@/lib/kernel/db/schema';
import { PCCP_STEPS, getNextStep, getStepIndex, isValidStep } from '@/lib/workflows/pccp/steps';
import { describe, expect, it } from 'vitest';

describe('PCCP schema table shapes', () => {
  it('pccpVersions has required columns', () => {
    const cols = Object.keys(pccpVersions);
    expect(cols).toContain('id');
    expect(cols).toContain('deviceId');
    expect(cols).toContain('version');
    expect(cols).toContain('status');
    expect(cols).toContain('active');
    expect(cols).toContain('createdBy');
    expect(cols).toContain('baselineSnapshotJsonb');
  });

  it('pccpComponents has required columns', () => {
    const cols = Object.keys(pccpComponents);
    expect(cols).toContain('id');
    expect(cols).toContain('pccpVersionId');
    expect(cols).toContain('componentType');
    expect(cols).toContain('contentJsonb');
    expect(cols).toContain('completedAt');
  });
});

describe('PCCP step definitions', () => {
  it('has exactly 4 steps', () => {
    expect(PCCP_STEPS).toHaveLength(4);
  });

  it('step order matches FDA guidance component sequence', () => {
    expect(PCCP_STEPS[0]).toBe('modification_description');
    expect(PCCP_STEPS[1]).toBe('sps_acp');
    expect(PCCP_STEPS[2]).toBe('impact_assessment');
    expect(PCCP_STEPS[3]).toBe('performance_testing');
  });

  it('getStepIndex returns correct indices', () => {
    expect(getStepIndex('modification_description')).toBe(0);
    expect(getStepIndex('performance_testing')).toBe(3);
  });

  it('isValidStep rejects unknown steps', () => {
    expect(isValidStep('unknown_step')).toBe(false);
    expect(isValidStep('modification_description')).toBe(true);
  });

  it('getNextStep returns null at last step', () => {
    expect(getNextStep('performance_testing')).toBeNull();
    expect(getNextStep('modification_description')).toBe('sps_acp');
  });
});
