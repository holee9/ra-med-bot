import {
  type HandoffRequest,
  HandoffValidationError,
  createHandoffRequest,
  deserializeHandoffRequest,
  serializeHandoffRequest,
} from '@/lib/workflows/common/human-handoff';
import { describe, expect, it } from 'vitest';

describe('human-handoff', () => {
  const sampleRequest: HandoffRequest = {
    workflowRunId: '550e8400-e29b-41d4-a716-446655440000',
    stepName: 'regulatory-review',
    reviewType: 'approval',
    context: { documentId: 'doc-123', jurisdiction: 'US_FDA' },
    requiredReviewers: 2,
  };

  describe('createHandoffRequest', () => {
    it('returns pending status with a UUID handoffId', () => {
      const result = createHandoffRequest(sampleRequest);

      expect(result.status).toBe('pending');
      expect(result.handoffId).toBeTruthy();
      // UUID v4 format
      expect(result.handoffId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(result.createdAt).toBeTruthy();
    });

    it('generates unique handoffId on each call', () => {
      const r1 = createHandoffRequest(sampleRequest);
      const r2 = createHandoffRequest(sampleRequest);
      expect(r1.handoffId).not.toBe(r2.handoffId);
    });
  });

  describe('serializeHandoffRequest', () => {
    it('produces valid JSON string', () => {
      const json = serializeHandoffRequest(sampleRequest);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('serialized JSON contains required fields', () => {
      const json = serializeHandoffRequest(sampleRequest);
      const parsed = JSON.parse(json);
      expect(parsed.workflowRunId).toBe(sampleRequest.workflowRunId);
      expect(parsed.stepName).toBe(sampleRequest.stepName);
      expect(parsed.reviewType).toBe(sampleRequest.reviewType);
    });
  });

  describe('deserializeHandoffRequest', () => {
    it('parses JSON back to HandoffRequest correctly', () => {
      const json = serializeHandoffRequest(sampleRequest);
      const result = deserializeHandoffRequest(json);

      expect(result.workflowRunId).toBe(sampleRequest.workflowRunId);
      expect(result.stepName).toBe(sampleRequest.stepName);
      expect(result.reviewType).toBe(sampleRequest.reviewType);
      expect(result.requiredReviewers).toBe(sampleRequest.requiredReviewers);
    });

    it('throws HandoffValidationError for invalid JSON', () => {
      expect(() => deserializeHandoffRequest('not-json')).toThrow(HandoffValidationError);
    });

    it('throws HandoffValidationError for JSON missing required fields', () => {
      const invalid = JSON.stringify({ workflowRunId: '123' }); // missing stepName etc.
      expect(() => deserializeHandoffRequest(invalid)).toThrow(HandoffValidationError);
    });
  });
});
