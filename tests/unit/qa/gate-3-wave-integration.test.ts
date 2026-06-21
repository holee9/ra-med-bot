// @MX:NOTE [AUTO] Gate 3 Wave Integration — unit tests for stub module.
// @MX:SPEC SPEC-REGULA-QA-WAVE-INTEGRATION-001

import { describe, expect, it } from 'vitest';

import {
  generateWaveIntegrationReport,
  getPersonaJourneys,
  type PersonaJourney,
} from '../../../scripts/qa/gate-3-wave-integration';

describe('getPersonaJourneys (SPEC-REGULA-QA-WAVE-INTEGRATION-001)', () => {
  it('returns exactly 4 canonical journeys', () => {
    const journeys = getPersonaJourneys();
    expect(journeys).toHaveLength(4);
  });

  it('each journey has id, persona, and steps fields', () => {
    const journeys = getPersonaJourneys();
    journeys.forEach((j: PersonaJourney) => {
      expect(j).toHaveProperty('id');
      expect(typeof j.id).toBe('string');
      expect(j.id.length).toBeGreaterThan(0);

      expect(j).toHaveProperty('persona');
      expect(typeof j.persona).toBe('string');
      expect(j.persona.length).toBeGreaterThan(0);

      expect(j).toHaveProperty('steps');
      expect(Array.isArray(j.steps)).toBe(true);
      expect(j.steps.length).toBeGreaterThan(0);
    });
  });

  it('journey ids are unique', () => {
    const journeys = getPersonaJourneys();
    const ids = journeys.map((j) => j.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('covers the expected personas', () => {
    const journeys = getPersonaJourneys();
    const personas = journeys.map((j) => j.persona);
    expect(personas).toContain('RA Lead');
    expect(personas).toContain('Expert Reviewer');
    expect(personas).toContain('New Team Member (limited RBAC)');
    expect(personas).toContain('CER Author');
  });
});

describe('generateWaveIntegrationReport (SPEC-REGULA-QA-WAVE-INTEGRATION-001)', () => {
  it('returns a non-empty markdown string', () => {
    const report = generateWaveIntegrationReport({
      wave: 'Wave-3',
      passedScenarios: ['GJ-001', 'GJ-002'],
      failedScenarios: [],
      skippedScenarios: ['GJ-003'],
    });
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });

  it('includes the wave name in the report', () => {
    const report = generateWaveIntegrationReport({
      wave: 'Wave-3',
      passedScenarios: [],
      failedScenarios: [],
      skippedScenarios: [],
    });
    expect(report).toContain('Wave-3');
  });

  it('shows PASS status when no failures', () => {
    const report = generateWaveIntegrationReport({
      wave: 'Wave-1',
      passedScenarios: ['GJ-001'],
      failedScenarios: [],
      skippedScenarios: [],
    });
    expect(report).toContain('PASS');
  });

  it('shows FAIL status when failures exist', () => {
    const report = generateWaveIntegrationReport({
      wave: 'Wave-2',
      passedScenarios: [],
      failedScenarios: ['GJ-002'],
      skippedScenarios: [],
    });
    expect(report).toContain('FAIL');
  });

  it('lists passed, failed, and skipped scenarios in separate sections', () => {
    const report = generateWaveIntegrationReport({
      wave: 'Wave-3',
      passedScenarios: ['GJ-001'],
      failedScenarios: ['GJ-002'],
      skippedScenarios: ['GJ-003'],
    });
    expect(report).toContain('### Passed');
    expect(report).toContain('### Failed');
    expect(report).toContain('### Skipped');
    expect(report).toContain('GJ-001');
    expect(report).toContain('GJ-002');
    expect(report).toContain('GJ-003');
  });

  it('includes SPEC reference footer', () => {
    const report = generateWaveIntegrationReport({
      wave: 'Wave-1',
      passedScenarios: [],
      failedScenarios: [],
      skippedScenarios: [],
    });
    expect(report).toContain('SPEC-REGULA-QA-WAVE-INTEGRATION-001');
  });
});
