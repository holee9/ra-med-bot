import { describe, expect, it } from 'vitest';
import { chunkFda483Response } from '../../../../lib/ingest/chunkers/fda-483-response';
import { DocClass } from '../../../../lib/ingest/doc-class';

const SAMPLE_483 = `
FDA 483 Response — Inspection Date: 2024-02-01

Observation 1
Failure to establish and maintain procedures for validating the device design.
Root Cause: Inadequate design control procedures were in place.
Corrective Action: We have updated our design control SOP QM-003.

Observation 2
Lack of documented evidence of training for quality system personnel.
Root Cause: Training records were not consistently maintained.
Corrective Action: All personnel have been retrained and records are now centralized.

Observation 3
Failure to establish and maintain procedures for receiving inspection activities.
Root Cause: Receiving inspection SOP was outdated.
Corrective Action: SOP has been revised and approved.
`;

describe('chunkFda483Response', () => {
  it('creates one chunk per observation', () => {
    const chunks = chunkFda483Response(SAMPLE_483, {});
    // Should find 3 observations
    const observationChunks = chunks.filter((c) =>
      c.metadata.sectionPath.toLowerCase().includes('observation'),
    );
    expect(observationChunks.length).toBeGreaterThanOrEqual(3);
  });

  it('each chunk has docClass audit_response', () => {
    const chunks = chunkFda483Response(SAMPLE_483, {});
    for (const chunk of chunks) {
      expect(chunk.metadata.docClass).toBe(DocClass.audit_response);
    }
  });

  it('chunk text contains observation content', () => {
    const chunks = chunkFda483Response(SAMPLE_483, {});
    const allText = chunks.map((c) => c.text).join(' ');
    expect(allText).toContain('Failure to establish');
    expect(allText).toContain('Corrective Action');
  });

  it('handles text without observation markers', () => {
    const plainText = 'This is a general audit response without numbered observations.';
    const chunks = chunkFda483Response(plainText, {});
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('chunk metadata includes sectionPath', () => {
    const chunks = chunkFda483Response(SAMPLE_483, {});
    for (const chunk of chunks) {
      expect(typeof chunk.metadata.sectionPath).toBe('string');
    }
  });
});
