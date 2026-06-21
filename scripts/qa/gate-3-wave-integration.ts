// @MX:NOTE [AUTO] Gate 3 Wave Integration — canonical RA persona journey stubs.
// @MX:SPEC SPEC-REGULA-QA-WAVE-INTEGRATION-001
//
// Gate 3 activates AFTER the first release candidate (RC).
// It covers cross-feature E2E integration scenarios for the 4 canonical
// RA persona journeys. Until RC, this module acts as a typed stub that
// documents scenarios and generates structured reports for review.
//
// Usage at RC+:
//   import { getPersonaJourneys, generateWaveIntegrationReport } from './gate-3-wave-integration';
//   const journeys = getPersonaJourneys();
//   const report = generateWaveIntegrationReport({ wave: 'Wave-3', passedScenarios: [...], ... });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PersonaJourney = {
  id: string;
  persona: string;
  steps: string[];
};

// ---------------------------------------------------------------------------
// Canonical journeys (4 scenarios required by SPEC-REGULA-QA-WAVE-INTEGRATION-001)
// ---------------------------------------------------------------------------

const CANONICAL_JOURNEYS: PersonaJourney[] = [
  {
    id: 'GJ-001',
    persona: 'RA Lead',
    steps: [
      'Upload SOP document via /api/ra/documents',
      'Query document corpus via /api/ra/query',
      'Receive AI response with citation reference',
      'Verify audit log entry created for the query',
    ],
  },
  {
    id: 'GJ-002',
    persona: 'Expert Reviewer',
    steps: [
      'Receive AI recommendation for PCCP review',
      'Inspect recommendation details and supporting references',
      'Approve recommendation via /api/ra/recommendations/:id/approve',
      'Verify PCCP workflow triggered and audit logged',
    ],
  },
  {
    id: 'GJ-003',
    persona: 'New Team Member (limited RBAC)',
    steps: [
      'Authenticate with restricted-role credentials',
      'Attempt restricted query via /api/ra/query (role: viewer)',
      'Receive 403 Forbidden response',
      'Verify 403 audit log entry recorded for access denial',
    ],
  },
  {
    id: 'GJ-004',
    persona: 'CER Author',
    steps: [
      'Initiate CER draft via /api/cer',
      'Trigger literature search for the draft',
      'Verify literature search completes and results attached',
      'Export finalized CER draft as PDF via /api/cer/:id/export',
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the 4 canonical RA persona journey scenarios.
 * At RC+, each journey maps to an automated Playwright test suite.
 */
export function getPersonaJourneys(): PersonaJourney[] {
  return CANONICAL_JOURNEYS;
}

export type WaveIntegrationReportOptions = {
  wave: string;
  passedScenarios: string[];
  failedScenarios: string[];
  skippedScenarios: string[];
};

/**
 * Generates a markdown-formatted Wave Integration Report.
 * Suitable for posting as a GitHub issue comment or CI artifact.
 */
export function generateWaveIntegrationReport(opts: WaveIntegrationReportOptions): string {
  const { wave, passedScenarios, failedScenarios, skippedScenarios } = opts;
  const total = passedScenarios.length + failedScenarios.length + skippedScenarios.length;
  const status = failedScenarios.length === 0 ? 'PASS' : 'FAIL';

  const lines: string[] = [
    `## Gate 3 Wave Integration Report — ${wave}`,
    '',
    `**Status:** ${status}  `,
    `**Total scenarios:** ${total}  `,
    `**Passed:** ${passedScenarios.length}  `,
    `**Failed:** ${failedScenarios.length}  `,
    `**Skipped:** ${skippedScenarios.length}  `,
    '',
  ];

  if (passedScenarios.length > 0) {
    lines.push('### Passed');
    for (const s of passedScenarios) lines.push(`- [x] ${s}`);
    lines.push('');
  }

  if (failedScenarios.length > 0) {
    lines.push('### Failed');
    for (const s of failedScenarios) lines.push(`- [ ] ${s}`);
    lines.push('');
  }

  if (skippedScenarios.length > 0) {
    lines.push('### Skipped');
    for (const s of skippedScenarios) lines.push(`- [-] ${s}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('_SPEC-REGULA-QA-WAVE-INTEGRATION-001 — Gate 3 activates post-RC_');

  return lines.join('\n');
}
