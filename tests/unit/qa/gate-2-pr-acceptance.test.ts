// @MX:NOTE [AUTO] Gate 2 PR acceptance unit tests.
// @MX:SPEC SPEC-REGULA-QA-PR-ACCEPTANCE-001 (REQ-G2-001 through REQ-G2-008)

import { describe, expect, it } from 'vitest';
import {
  generateQaEvidenceSection,
  generateQaSignoffComment,
  parseAxeViolations,
  parseGitleaksFindings,
} from '../../../scripts/qa/gate-2-pr-acceptance';

// ---------------------------------------------------------------------------
// parseAxeViolations
// ---------------------------------------------------------------------------

describe('parseAxeViolations (REQ-G2-001, REQ-G2-002)', () => {
  it('returns empty array for empty string', () => {
    expect(parseAxeViolations('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parseAxeViolations('   \n  ')).toEqual([]);
  });

  it('returns empty array for JSON array with zero violations', () => {
    const axeJson = JSON.stringify([{ url: 'http://localhost:3000', violations: [] }]);
    expect(parseAxeViolations(axeJson)).toEqual([]);
  });

  it('returns violation ids from JSON array format', () => {
    const axeJson = JSON.stringify([
      {
        url: 'http://localhost:3000',
        violations: [
          { id: 'color-contrast', description: 'Elements must have sufficient color contrast' },
          { id: 'image-alt', description: 'Images must have alternate text' },
        ],
      },
    ]);
    const result = parseAxeViolations(axeJson);
    expect(result).toHaveLength(2);
    expect(result).toContain('color-contrast');
    expect(result).toContain('image-alt');
  });

  it('returns violation ids from single page JSON object format', () => {
    const axeJson = JSON.stringify({
      violations: [{ id: 'aria-required-attr', description: 'Required ARIA attributes' }],
    });
    const result = parseAxeViolations(axeJson);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('aria-required-attr');
  });

  it('falls back to description when id is missing', () => {
    const axeJson = JSON.stringify([
      {
        violations: [{ description: 'Missing label element' }],
      },
    ]);
    const result = parseAxeViolations(axeJson);
    expect(result[0]).toBe('Missing label element');
  });

  it('parses plain text output with "violation" keyword', () => {
    const plainText = [
      'axe-core v4.9.0',
      '  2 violation(s) found:',
      '  Rule: color-contrast -- Elements must have sufficient color contrast',
    ].join('\n');
    const result = parseAxeViolations(plainText);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((r) => r.includes('violation'))).toBe(true);
  });

  it('returns empty array for clean plain text with no violations', () => {
    const plainText = [
      'axe-core v4.9.0',
      'Testing http://localhost:3000...',
      '0 accessibility issues found.',
    ].join('\n');
    const result = parseAxeViolations(plainText);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseGitleaksFindings
// ---------------------------------------------------------------------------

describe('parseGitleaksFindings (REQ-G2-003, REQ-G2-004)', () => {
  it('returns empty array for empty string', () => {
    expect(parseGitleaksFindings('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parseGitleaksFindings('  \n  ')).toEqual([]);
  });

  it('returns empty array for empty JSON array', () => {
    expect(parseGitleaksFindings('[]')).toEqual([]);
  });

  it('returns findings from JSON array format with Description field', () => {
    const gitleaksJson = JSON.stringify([
      { Description: 'AWS Access Key', RuleID: 'aws-access-key', Secret: 'AKIAIOSFODNN7EXAMPLE' },
      { Description: 'Generic API Key', RuleID: 'generic-api-key', Secret: 'secret-value-here' },
    ]);
    const result = parseGitleaksFindings(gitleaksJson);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('AWS Access Key');
    expect(result[1]).toBe('Generic API Key');
  });

  it('falls back to RuleID when Description is missing', () => {
    const gitleaksJson = JSON.stringify([{ RuleID: 'github-pat', Secret: 'ghp_xxxxxxxxxxxx' }]);
    const result = parseGitleaksFindings(gitleaksJson);
    expect(result[0]).toBe('github-pat');
  });

  it('parses plain text output with "Finding:" keyword', () => {
    const plainText = [
      'gitleaks v8.18.0',
      '',
      '    Finding:     AKIAIOSFODNN7EXAMPLE',
      '    Secret:      AKIAIOSFODNN7EXAMPLE',
      '    RuleID:      aws-access-key-id',
    ].join('\n');
    const result = parseGitleaksFindings(plainText);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array for clean gitleaks plain text output', () => {
    const plainText = [
      'gitleaks v8.18.0',
      '',
      'No leaks found.',
      '',
      'Summary:',
      '  leaks found: 0',
    ].join('\n');
    const result = parseGitleaksFindings(plainText);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateQaEvidenceSection
// ---------------------------------------------------------------------------

describe('generateQaEvidenceSection (REQ-G2-005, REQ-G2-006)', () => {
  const baseOpts = {
    prNumber: 42,
    commitSha: 'abc1234def5678',
    commands: ['pnpm test', 'pnpm typecheck'],
    results: ['All tests pass', 'No type errors'],
    hasArtifacts: false,
  };

  it('includes "## QA evidence" heading', () => {
    const output = generateQaEvidenceSection(baseOpts);
    expect(output).toContain('## QA evidence');
  });

  it('includes PR number', () => {
    const output = generateQaEvidenceSection(baseOpts);
    expect(output).toContain('#42');
  });

  it('includes commit SHA', () => {
    const output = generateQaEvidenceSection(baseOpts);
    expect(output).toContain('abc1234def5678');
  });

  it('includes all commands in code formatting', () => {
    const output = generateQaEvidenceSection(baseOpts);
    expect(output).toContain('`pnpm test`');
    expect(output).toContain('`pnpm typecheck`');
  });

  it('includes all result lines', () => {
    const output = generateQaEvidenceSection(baseOpts);
    expect(output).toContain('All tests pass');
    expect(output).toContain('No type errors');
  });

  it('shows "No artifacts attached" when hasArtifacts is false', () => {
    const output = generateQaEvidenceSection(baseOpts);
    expect(output).toContain('No artifacts attached');
  });

  it('shows artifacts note when hasArtifacts is true', () => {
    const output = generateQaEvidenceSection({ ...baseOpts, hasArtifacts: true });
    expect(output).toContain('Artifacts attached');
  });

  it('handles empty commands array gracefully', () => {
    const output = generateQaEvidenceSection({ ...baseOpts, commands: [] });
    expect(output).toContain('No commands recorded');
  });

  it('handles empty results array gracefully', () => {
    const output = generateQaEvidenceSection({ ...baseOpts, results: [] });
    expect(output).toContain('No results recorded');
  });
});

// ---------------------------------------------------------------------------
// generateQaSignoffComment
// ---------------------------------------------------------------------------

describe('generateQaSignoffComment (REQ-G2-007, REQ-G2-008)', () => {
  const baseOpts = {
    gateStatus: 'PASS' as const,
    approver: 'jane.doe',
    evidenceLinks: ['https://github.com/holee9/ra-med-bot/pull/42'],
    closureDecision: 'Approved for merge',
  };

  it('includes "### QA signoff" heading', () => {
    const output = generateQaSignoffComment(baseOpts);
    expect(output).toContain('### QA signoff');
  });

  it('shows PASS status', () => {
    const output = generateQaSignoffComment(baseOpts);
    expect(output).toContain('PASS');
  });

  it('shows WAIVED status', () => {
    const output = generateQaSignoffComment({ ...baseOpts, gateStatus: 'WAIVED' });
    expect(output).toContain('WAIVED');
  });

  it('shows BLOCKED status', () => {
    const output = generateQaSignoffComment({ ...baseOpts, gateStatus: 'BLOCKED' });
    expect(output).toContain('BLOCKED');
  });

  it('includes approver name', () => {
    const output = generateQaSignoffComment(baseOpts);
    expect(output).toContain('jane.doe');
  });

  it('includes all evidence links', () => {
    const output = generateQaSignoffComment(baseOpts);
    expect(output).toContain('https://github.com/holee9/ra-med-bot/pull/42');
  });

  it('includes closure decision', () => {
    const output = generateQaSignoffComment(baseOpts);
    expect(output).toContain('Approved for merge');
  });

  it('handles empty evidence links gracefully', () => {
    const output = generateQaSignoffComment({ ...baseOpts, evidenceLinks: [] });
    expect(output).toContain('No evidence links provided');
  });
});
