// SPEC-V3-IMPACT-001 M9: Audit logging for impact wizard operations.
// TDD RED Phase: Write failing test first.

import type { Database } from '@/lib/kernel/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logCriticalDetected, logImpactCheck, logTicketCreate } from '../audit-logger';

// Mock writeAudit
vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// Mock DB for transaction
vi.mock('@/lib/kernel/db/client', () => ({
  db: {},
}));

describe('M9: Audit Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logImpactCheck', () => {
    it('should log impact check with correct action', async () => {
      const { writeAudit } = await import('@/lib/kernel/audit');
      const mockDb = {};

      await logImpactCheck(mockDb as unknown as Database, {
        actorId: 'user-123',
        orgId: 'org-456',
        productId: 'prod-789',
        changeType: 'bom',
        markets: ['us', 'eu'],
        signal: 'red',
      });

      expect(writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'user-123',
          action: 'impact.check',
          resource_type: 'impact_assessment',
          resource_id: 'prod-789',
          meta_json: expect.objectContaining({
            change_type: 'bom',
            markets: 'us,eu',
            signal: 'red',
          }),
        }),
        mockDb,
      );
    });

    it('should include all context in meta_json', async () => {
      const { writeAudit } = await import('@/lib/kernel/audit');
      const mockDb = {};

      await logImpactCheck(mockDb as unknown as Database, {
        actorId: 'user-123',
        orgId: 'org-456',
        productId: 'prod-789',
        changeType: 'sw',
        markets: ['kr'],
        signal: 'green',
      });

      expect(writeAudit).toHaveBeenCalled();
      const callArgs = vi.mocked(writeAudit).mock.calls[0]?.[0];
      expect(callArgs?.meta_json?.org_id).toBe('org-456');
      expect(callArgs?.meta_json?.signal).toBe('green');
    });
  });

  describe('logTicketCreate', () => {
    it('should log ticket creation with correct action', async () => {
      const { writeAudit } = await import('@/lib/kernel/audit');
      const mockTx = {};

      await logTicketCreate(mockTx as unknown as Database, {
        actorId: 'user-123',
        ticketId: 'ticket-abc',
        orgId: 'org-456',
        signal: 'yellow',
      });

      expect(writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'user-123',
          action: 'impact.ticket.create',
          resource_type: 'inbox_ticket',
          resource_id: 'ticket-abc',
          meta_json: expect.objectContaining({
            signal: 'yellow',
          }),
        }),
        mockTx,
      );
    });
  });

  describe('logCriticalDetected', () => {
    it('should log critical detection with correct action', async () => {
      const { writeAudit } = await import('@/lib/kernel/audit');
      const mockTx = {};

      await logCriticalDetected(mockTx as unknown as Database, {
        actorId: 'user-123',
        assessmentId: 'assessment-xyz',
        projectId: 'proj-123',
        signal: 'red',
      });

      expect(writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'user-123',
          action: 'impact.critical_detected',
          resource_type: 'impact_assessment',
          resource_id: 'assessment-xyz',
          meta_json: expect.objectContaining({
            project_id: 'proj-123',
            signal: 'red',
          }),
        }),
        mockTx,
      );
    });
  });
});
