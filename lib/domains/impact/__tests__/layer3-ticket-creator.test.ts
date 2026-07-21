// SPEC-V3-IMPACT-001 M5: Layer 3 ticket creation via inbox domain.
// TDD RED Phase: Write failing test first.

import type { Database } from '@/lib/kernel/db/client';
import { describe, expect, it, vi } from 'vitest';
import { createImpactTicket } from '../layer3-ticket-creator';

// Mock the DB client
vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'ticket-123' }]),
      }),
    }),
  },
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('mock-uuid-123'),
}));

describe('Layer 3: Ticket Creator', () => {
  describe('AC-IMP-07: createImpactTicket', () => {
    it('should create ticket via direct DB insert', async () => {
      const { db } = await import('@/lib/kernel/db/client');

      const ticketId = await createImpactTicket(db, {
        orgId: 'org-123',
        title: 'Impact ticket',
        description: 'Test description',
        priority: 'high',
        assigneeId: 'user-123',
        productId: 'prod-456',
      });

      expect(ticketId).toBe('it_mock-uuid-123');
      expect(db.insert).toHaveBeenCalled();
    });

    it('should include signal and classification when provided', async () => {
      const { db } = await import('@/lib/kernel/db/client');

      await createImpactTicket(db, {
        orgId: 'org-123',
        title: 'Critical impact',
        description: 'Change detected',
        priority: 'critical',
        assigneeId: 'user-123',
        signal: 'red',
        classification: {
          category: 'bom',
          confidence: 0.95,
          reason: 'High confidence BOM change',
        },
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle missing productId gracefully', async () => {
      const { db } = await import('@/lib/kernel/db/client');

      const ticketId = await createImpactTicket(db, {
        orgId: 'org-123',
        title: 'No product ticket',
        description: 'Test',
        priority: 'medium',
        assigneeId: 'user-123',
      });

      expect(ticketId).toBe('it_mock-uuid-123');
    });

    it('should propagate DB errors', async () => {
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('DB connection failed')),
          }),
        }),
      };

      await expect(
        createImpactTicket(mockDb as unknown as Database, {
          orgId: 'org-123',
          title: 'Test',
          description: 'Test',
          priority: 'low',
          assigneeId: 'user-123',
        }),
      ).rejects.toThrow('DB connection failed');
    });

    it('should generate ticket ID with it_ prefix', async () => {
      const { db } = await import('@/lib/kernel/db/client');
      const { randomUUID } = await import('node:crypto');

      const ticketId = await createImpactTicket(db, {
        orgId: 'org-123',
        title: 'Test',
        description: 'Test',
        priority: 'low',
        assigneeId: 'user-123',
      });

      expect(randomUUID).toHaveBeenCalled();
      expect(ticketId).toMatch(/^it_mock-uuid-123$/);
    });
  });
});
