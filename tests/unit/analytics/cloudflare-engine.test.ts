// Tests for lib/analytics/cloudflare-engine.ts
// RED: PII fields are rejected, basic emission

import { describe, expect, it, vi } from 'vitest';

// Cloudflare Analytics Engine binding stub
function makeAnalyticsEngineMock() {
  return {
    writeDataPoint: vi.fn(),
  } as unknown as AnalyticsEngineDataset;
}

describe('emitConsultMetric', () => {
  it('should be exported from cloudflare-engine', async () => {
    const mod = await import('../../../lib/analytics/cloudflare-engine');
    expect(typeof mod.emitConsultMetric).toBe('function');
  });

  it('should call analyticsEngine.writeDataPoint', async () => {
    const { emitConsultMetric } = await import('../../../lib/analytics/cloudflare-engine');
    const engine = makeAnalyticsEngineMock();

    await emitConsultMetric(engine, {
      latency_ms: 1200,
      cache_hit: false,
      region: 'us-east',
      status_code: 200,
    });

    expect(engine.writeDataPoint).toHaveBeenCalled();
  });

  it('should REJECT metrics with question field (PII — REQ-CF-077)', async () => {
    const { emitConsultMetric } = await import('../../../lib/analytics/cloudflare-engine');
    const engine = makeAnalyticsEngineMock();

    await expect(
      emitConsultMetric(engine, {
        latency_ms: 500,
        cache_hit: true,
        region: 'eu-west',
        status_code: 200,
        // @ts-expect-error intentional PII injection test
        question: 'patient has HIV',
      }),
    ).rejects.toThrow(/PII/i);
  });

  it('should REJECT metrics with answer field (PII)', async () => {
    const { emitConsultMetric } = await import('../../../lib/analytics/cloudflare-engine');
    const engine = makeAnalyticsEngineMock();

    await expect(
      emitConsultMetric(engine, {
        latency_ms: 500,
        cache_hit: true,
        region: 'eu-west',
        status_code: 200,
        // @ts-expect-error intentional PII injection test
        answer: 'some medical answer',
      }),
    ).rejects.toThrow(/PII/i);
  });

  it('should REJECT metrics with email field (PII)', async () => {
    const { emitConsultMetric } = await import('../../../lib/analytics/cloudflare-engine');
    const engine = makeAnalyticsEngineMock();

    await expect(
      emitConsultMetric(engine, {
        latency_ms: 500,
        cache_hit: true,
        region: 'eu-west',
        status_code: 200,
        // @ts-expect-error intentional PII injection test
        email: 'user@example.com',
      }),
    ).rejects.toThrow(/PII/i);
  });

  it('should REJECT metrics with userId field (PII)', async () => {
    const { emitConsultMetric } = await import('../../../lib/analytics/cloudflare-engine');
    const engine = makeAnalyticsEngineMock();

    await expect(
      emitConsultMetric(engine, {
        latency_ms: 500,
        cache_hit: true,
        region: 'eu-west',
        status_code: 200,
        // @ts-expect-error intentional PII injection test
        userId: 'user-123',
      }),
    ).rejects.toThrow(/PII/i);
  });

  it('should NOT include PII fields in the datapoint written', async () => {
    const { emitConsultMetric } = await import('../../../lib/analytics/cloudflare-engine');
    const engine = makeAnalyticsEngineMock();

    await emitConsultMetric(engine, {
      latency_ms: 800,
      cache_hit: true,
      region: 'apac',
      status_code: 200,
    });

    const call = vi.mocked(engine.writeDataPoint).mock.calls[0][0];
    const dataStr = JSON.stringify(call);
    expect(dataStr).not.toContain('question');
    expect(dataStr).not.toContain('answer');
    expect(dataStr).not.toContain('email');
    expect(dataStr).not.toContain('userId');
  });
});
