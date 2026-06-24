// @MX:NOTE [AUTO] Model Governance Zod schemas + result types.
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-001~014)

import { z } from 'zod';

// ---- Input schemas (Route Handler validation) ----

export const registerPromptInputSchema = z.object({
  kind: z.enum(['prompt', 'template']),
  content: z.string().min(1, 'content must not be empty'),
  version: z.number().int().positive().optional(),
});
export type RegisterPromptInput = z.infer<typeof registerPromptInputSchema>;

export const registerModelPinInputSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  modelVersion: z.string().min(1),
  retrievalConfig: z.record(z.unknown()).optional(),
});
export type RegisterModelPinInput = z.infer<typeof registerModelPinInputSchema>;

export const createChangeRequestInputSchema = z.object({
  promptId: z.string().uuid(),
  modelPinId: z.string().uuid(),
  evalRunId: z.string().optional(),
});
export type CreateChangeRequestInput = z.infer<typeof createChangeRequestInputSchema>;

export const approveChangeRequestInputSchema = z.object({
  changeRequestId: z.string().uuid(),
  evalResultRef: z.string().optional(),
});
export type ApproveChangeRequestInput = z.infer<typeof approveChangeRequestInputSchema>;

export const rollbackInputSchema = z.object({
  toCombinationId: z.string().uuid().optional(),
});
export type RollbackInput = z.infer<typeof rollbackInputSchema>;

// ---- Result types ----

export interface RegisteredPrompt {
  id: string;
  kind: 'prompt' | 'template';
  contentHash: string;
  version: number;
  createdAt: Date;
}

export interface RegisteredModelPin {
  id: string;
  provider: string;
  modelId: string;
  modelVersion: string;
  createdAt: Date;
}

export interface ActiveCombination {
  id: string;
  promptId: string;
  modelPinId: string;
  promptVersion: number;
  promptContentHash: string;
  modelProvider: string;
  modelId: string;
  modelVersion: string;
  approvedAt: Date;
}

export interface AnswerVersionMetadata {
  approvedCombinationId: string;
  promptVersion: number;
  promptContentHash: string;
  modelProvider: string;
  modelId: string;
  modelVersion: string;
}

export interface EvalGateResult {
  passed: boolean;
  threshold: number;
  score: number;
  evalRunId: string | null;
  evalResultRef: string | null;
  reason: string;
}

// REQ-MODELGOV-009: RLHF proposals are stored as pending_review only.
export const rlhfProposalInputSchema = z.object({
  promptId: z.string().uuid().optional(),
  proposalText: z.string().min(1),
  source: z.literal('rlhf').default('rlhf'),
});
export type RlhfProposalInput = z.infer<typeof rlhfProposalInputSchema>;
