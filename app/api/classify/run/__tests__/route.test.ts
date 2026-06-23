// @MX:NOTE [AUTO] Source-level tests for POST /api/classify/run — H1/M1 defenses.
// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-019~020)
//
// Full DB integration is covered elsewhere; these tests assert the error-handling
// STRUCTURE that the security review required:
//   H1 — try/catch around classifyDevice, failed-status transition, failure audit, 502.
//   M1 — resource_type canonicalized to 'deviceClassification' in both paths.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const routeSrc = fs.readFileSync(path.resolve(__dirname, '../route.ts'), 'utf8');

describe('H1 — classifyDevice is wrapped in try/catch', () => {
  it('wraps the engine call in try { ... } catch', () => {
    // A try block must precede the classifyDevice call.
    const tryIdx = routeSrc.indexOf('try {');
    const callIdx = routeSrc.indexOf('classifyDevice(');
    expect(tryIdx).toBeGreaterThanOrEqual(0);
    expect(callIdx).toBeGreaterThan(tryIdx);
    // And a catch must follow.
    const catchIdx = routeSrc.indexOf('} catch (err) {', tryIdx);
    expect(catchIdx).toBeGreaterThan(callIdx);
  });

  it('marks workflow_runs as failed on catch', () => {
    // The catch block must set status='failed'.
    const catchIdx = routeSrc.indexOf('} catch (err) {');
    const afterCatch = routeSrc.slice(catchIdx);
    expect(afterCatch).toMatch(/status:\s*'failed'/);
    expect(afterCatch).toMatch(/completedAt/);
  });

  it('writes a device_classified audit on catch with meta.error (no PII)', () => {
    const catchIdx = routeSrc.indexOf('} catch (err) {');
    const afterCatch = routeSrc.slice(catchIdx, catchIdx + 800);
    expect(afterCatch).toMatch(/action:\s*'device_classified'/);
    expect(afterCatch).toMatch(/meta_json:\s*\{[^}]*error:/);
    // The catch block must NOT include deviceDescription in meta_json.
    const metaBlockMatch = afterCatch.match(/meta_json:\s*\{([^}]*)\}/);
    expect(metaBlockMatch).not.toBeNull();
    expect(metaBlockMatch?.[1]).not.toMatch(/deviceDescription/);
  });

  it('returns a structured 502 on catch', () => {
    const catchIdx = routeSrc.indexOf('} catch (err) {');
    const afterCatch = routeSrc.slice(catchIdx, catchIdx + 1200);
    expect(afterCatch).toMatch(/classification_failed/);
    expect(afterCatch).toMatch(/status:\s*502/);
  });
});

describe('M1 — resource_type is canonicalized to deviceClassification', () => {
  it('uses resource_type: "deviceClassification" in the success path', () => {
    // Count occurrences — both success and failure audits must use the same value.
    const matches = routeSrc.match(/resource_type:\s*'deviceClassification'/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT use an inconsistent resource_type', () => {
    // No stray 'device_classification' / 'classify' / 'classification' resource_type.
    expect(routeSrc).not.toMatch(/resource_type:\s*'device_classification'/);
    expect(routeSrc).not.toMatch(/resource_type:\s*'classify'/);
  });

  it('keeps workflowType: "classify" for the workflow_runs row', () => {
    expect(routeSrc).toMatch(/workflowType:\s*'classify'/);
  });
});
