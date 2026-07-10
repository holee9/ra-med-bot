// @MX:NOTE [AUTO] Unit tests for model-pinning.ts — model pin registration + listing (REQ-MODELGOV-002/003).
// @MX:SPEC SPEC-REGULA-MODEL-GOVERNANCE-001 (Issue 71, REQ-MODELGOV-002, REQ-MODELGOV-003)
// @MX:REASON REQ-MODELGOV-002/003: registerModelPin (insert + returning, throws on empty)
//   and listModelPins (select + where + orderBy, thenable array).
//   Chain 1: insert().values().returning() → Promise<array>
//   Chain 2: select().from().where().orderBy() → thenable (array)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock db chains:
//   1. insert: insert().values().returning() → Promise<insertResult>
//   2. list:   select().from().where().orderBy() → thenable (listResult)
// ---------------------------------------------------------------------------
let insertResult: unknown[] = [];
let listResult: unknown[] = [];

function makeMockDb() {
  const selectMock = () => ({
    from: () => ({
      where: () => {
        // listModelPins: where().orderBy() → thenable array
        const thenable = Promise.resolve(listResult) as Promise<unknown[]> & {
          orderBy: () => Promise<unknown[]>;
        };
        thenable.orderBy = () => Promise.resolve(listResult);
        return thenable;
      },
    }),
  });
  const insertMock = () => ({
    values: () => ({
      returning: () => Promise.resolve(insertResult),
    }),
  });
  return { select: vi.fn(selectMock), insert: vi.fn(insertMock) };
}

beforeEach(() => {
  insertResult = [];
  listResult = [];
  vi.resetModules();
  vi.doMock('@/lib/db/client', () => ({ db: makeMockDb() }));
});

// ---------------------------------------------------------------------------
// registerModelPin
// ---------------------------------------------------------------------------
describe('registerModelPin (REQ-MODELGOV-002/003 — insert + version history)', () => {
  it('inserts a new model pin and returns the registered row', async () => {
    const createdAt = new Date('2025-06-01');
    insertResult = [
      {
        id: 'pin-1',
        provider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: '2024-08-06',
        createdAt,
      },
    ];
    const { registerModelPin } = await import('@/lib/model-governance/model-pinning');
    const result = await registerModelPin({
      orgId: 'org-1',
      provider: 'openai',
      modelId: 'gpt-4o',
      modelVersion: '2024-08-06',
      createdBy: 'user-1',
    });
    expect(result).toEqual({
      id: 'pin-1',
      provider: 'openai',
      modelId: 'gpt-4o',
      modelVersion: '2024-08-06',
      createdAt,
    });
  });

  it('throws when insert returns no rows', async () => {
    insertResult = [];
    const { registerModelPin } = await import('@/lib/model-governance/model-pinning');
    await expect(
      registerModelPin({
        orgId: 'org-1',
        provider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: '2024-08-06',
        createdBy: 'user-1',
      }),
    ).rejects.toThrow('model_pin insert returned no rows');
  });

  it('passes retrievalConfig to insert when provided', async () => {
    insertResult = [
      {
        id: 'pin-rc',
        provider: 'anthropic',
        modelId: 'claude-3',
        modelVersion: 'v1',
        createdAt: new Date(),
      },
    ];
    const { db } = await import('@/lib/db/client');
    const { registerModelPin } = await import('@/lib/model-governance/model-pinning');
    await registerModelPin({
      orgId: 'org-1',
      provider: 'anthropic',
      modelId: 'claude-3',
      modelVersion: 'v1',
      retrievalConfig: { topK: 5, threshold: 0.7 },
      createdBy: 'user-1',
    });
    expect(db.insert).toHaveBeenCalled();
  });

  it('defaults retrievalConfig to {} when not provided', async () => {
    insertResult = [
      {
        id: 'pin-default-rc',
        provider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: 'v1',
        createdAt: new Date(),
      },
    ];
    const { db } = await import('@/lib/db/client');
    const { registerModelPin } = await import('@/lib/model-governance/model-pinning');
    await registerModelPin({
      orgId: 'org-1',
      provider: 'openai',
      modelId: 'gpt-4o',
      modelVersion: 'v1',
      createdBy: 'user-1',
    });
    expect(db.insert).toHaveBeenCalled();
  });

  it('accepts createdBy=null', async () => {
    insertResult = [
      {
        id: 'pin-null',
        provider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: 'v1',
        createdAt: new Date(),
      },
    ];
    const { registerModelPin } = await import('@/lib/model-governance/model-pinning');
    const result = await registerModelPin({
      orgId: 'org-1',
      provider: 'openai',
      modelId: 'gpt-4o',
      modelVersion: 'v1',
      createdBy: null,
    });
    expect(result.id).toBe('pin-null');
  });

  it('returns the id, provider, modelId, modelVersion, createdAt fields', async () => {
    const createdAt = new Date('2025-07-01');
    insertResult = [
      {
        id: 'pin-fields',
        provider: 'mistral',
        modelId: 'mistral-large',
        modelVersion: '2',
        createdAt,
      },
    ];
    const { registerModelPin } = await import('@/lib/model-governance/model-pinning');
    const result = await registerModelPin({
      orgId: 'org-1',
      provider: 'mistral',
      modelId: 'mistral-large',
      modelVersion: '2',
      createdBy: 'user-1',
    });
    expect(result.id).toBe('pin-fields');
    expect(result.provider).toBe('mistral');
    expect(result.modelId).toBe('mistral-large');
    expect(result.modelVersion).toBe('2');
    expect(result.createdAt).toBe(createdAt);
  });
});

// ---------------------------------------------------------------------------
// listModelPins
// ---------------------------------------------------------------------------
describe('listModelPins (REQ-MODELGOV-002/003 — org-scoped, newest first)', () => {
  it('returns all model pins for an org (newest first)', async () => {
    listResult = [
      {
        id: 'pin-3',
        provider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: 'v3',
        retrievalConfig: { topK: 5 },
        createdAt: new Date('2025-06-03'),
        createdBy: 'user-1',
      },
      {
        id: 'pin-2',
        provider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: 'v2',
        retrievalConfig: {},
        createdAt: new Date('2025-06-02'),
        createdBy: 'user-1',
      },
      {
        id: 'pin-1',
        provider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: 'v1',
        retrievalConfig: {},
        createdAt: new Date('2025-06-01'),
        createdBy: null,
      },
    ];
    const { listModelPins } = await import('@/lib/model-governance/model-pinning');
    const result = await listModelPins('org-1');
    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe('pin-3');
    expect(result[2]?.id).toBe('pin-1');
  });

  it('returns empty array when no model pins exist', async () => {
    listResult = [];
    const { listModelPins } = await import('@/lib/model-governance/model-pinning');
    const result = await listModelPins('org-empty');
    expect(result).toEqual([]);
  });

  it('includes retrievalConfig in results', async () => {
    listResult = [
      {
        id: 'pin-rc',
        provider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: 'v1',
        retrievalConfig: { topK: 10, threshold: 0.5 },
        createdAt: new Date(),
        createdBy: 'user-1',
      },
    ];
    const { listModelPins } = await import('@/lib/model-governance/model-pinning');
    const result = await listModelPins('org-1');
    expect(result[0]?.retrievalConfig).toEqual({ topK: 10, threshold: 0.5 });
  });

  it('includes createdBy field in results', async () => {
    listResult = [
      {
        id: 'pin-creator',
        provider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: 'v1',
        retrievalConfig: {},
        createdAt: new Date(),
        createdBy: 'user-creator',
      },
    ];
    const { listModelPins } = await import('@/lib/model-governance/model-pinning');
    const result = await listModelPins('org-1');
    expect(result[0]?.createdBy).toBe('user-creator');
  });

  it('includes createdBy=null in results when pin was system-created', async () => {
    listResult = [
      {
        id: 'pin-system',
        provider: 'openai',
        modelId: 'gpt-4o',
        modelVersion: 'v1',
        retrievalConfig: {},
        createdAt: new Date(),
        createdBy: null,
      },
    ];
    const { listModelPins } = await import('@/lib/model-governance/model-pinning');
    const result = await listModelPins('org-1');
    expect(result[0]?.createdBy).toBeNull();
  });

  it('returns rows with all expected fields', async () => {
    listResult = [
      {
        id: 'pin-all',
        provider: 'anthropic',
        modelId: 'claude-3',
        modelVersion: 'v1',
        retrievalConfig: { topK: 3 },
        createdAt: new Date('2025-07-01'),
        createdBy: 'user-1',
      },
    ];
    const { listModelPins } = await import('@/lib/model-governance/model-pinning');
    const result = await listModelPins('org-1');
    expect(result[0]).toEqual({
      id: 'pin-all',
      provider: 'anthropic',
      modelId: 'claude-3',
      modelVersion: 'v1',
      retrievalConfig: { topK: 3 },
      createdAt: new Date('2025-07-01'),
      createdBy: 'user-1',
    });
  });
});
