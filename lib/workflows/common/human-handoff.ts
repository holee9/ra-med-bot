import { z } from 'zod';

// @MX:ANCHOR: [AUTO] HandoffRequest — 21 CFR Part 11 human review gate contract
// @MX:REASON: fan_in >= 3: submission_drafter, audit_response, indication_impact workflows pause here

export class HandoffValidationError extends Error {
  constructor(cause: string) {
    super(`HandoffRequest validation failed: ${cause}`);
    this.name = 'HandoffValidationError';
  }
}

export const HandoffRequestSchema = z.object({
  workflowRunId: z.string().min(1),
  stepName: z.string().min(1),
  reviewType: z.enum(['approval', 'signature', 'verification']),
  context: z.record(z.unknown()),
  requiredReviewers: z.number().int().positive().optional(),
});

export type HandoffRequest = z.infer<typeof HandoffRequestSchema>;

export interface HandoffResult {
  approved: boolean;
  reviewerId: string;
  reviewedAt: string;
  comments?: string;
  signature?: string;
}

/**
 * Creates a new pending handoff request.
 * Returns a unique handoffId (UUID v4), status 'pending', and ISO timestamp.
 */
export function createHandoffRequest(_req: HandoffRequest): {
  handoffId: string;
  status: 'pending';
  createdAt: string;
} {
  return {
    handoffId: crypto.randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

/** Serializes a HandoffRequest to JSON for persistent storage. */
export function serializeHandoffRequest(req: HandoffRequest): string {
  return JSON.stringify(req);
}

/**
 * Parses and validates a JSON string back into a HandoffRequest.
 * Throws HandoffValidationError if parsing or Zod validation fails.
 */
export function deserializeHandoffRequest(json: string): HandoffRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new HandoffValidationError('invalid JSON');
  }

  const result = HandoffRequestSchema.safeParse(parsed);
  if (!result.success) {
    throw new HandoffValidationError(result.error.message);
  }
  return result.data;
}
