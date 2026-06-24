// @MX:NOTE [AUTO] model-pinning.ts — model provider/id/version pinning (REQ-MODELGOV-002/003).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-002, REQ-MODELGOV-003)

import { db } from '@/lib/db/client';
import { modelPin } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { RegisteredModelPin } from './types';

/**
 * REQ-MODELGOV-002/003: register a pinned model + retrieval_config version.
 * Each insert is a new version history entry (no update path — mirror prompt_registry).
 */
export async function registerModelPin(params: {
  orgId: string;
  provider: string;
  modelId: string;
  modelVersion: string;
  retrievalConfig?: Record<string, unknown>;
  createdBy: string | null;
}): Promise<RegisteredModelPin> {
  const [row] = await db
    .insert(modelPin)
    .values({
      orgId: params.orgId,
      provider: params.provider,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      retrievalConfig: params.retrievalConfig ?? {},
      createdBy: params.createdBy,
    })
    .returning({
      id: modelPin.id,
      provider: modelPin.provider,
      modelId: modelPin.modelId,
      modelVersion: modelPin.modelVersion,
      createdAt: modelPin.createdAt,
    });

  if (!row) throw new Error('model_pin insert returned no rows');
  return row;
}

/**
 * List all model pins for an org (newest first).
 */
export async function listModelPins(orgId: string) {
  return db
    .select({
      id: modelPin.id,
      provider: modelPin.provider,
      modelId: modelPin.modelId,
      modelVersion: modelPin.modelVersion,
      retrievalConfig: modelPin.retrievalConfig,
      createdAt: modelPin.createdAt,
      createdBy: modelPin.createdBy,
    })
    .from(modelPin)
    .where(eq(modelPin.orgId, orgId))
    .orderBy(desc(modelPin.createdAt));
}
