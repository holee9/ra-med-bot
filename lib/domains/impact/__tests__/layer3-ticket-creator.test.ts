// SPEC-V3-IMPACT-001 M5: Layer 3 ticket creation via inbox domain.
// TDD RED Phase: Write failing test first.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createImpactTicket } from '../layer3-ticket-creator';

// Mock the inbox domain
vi.mock('@/lib/domains/inbox', () => ({
  createTicket: vi.fn(),
}));

describe('Layer 3: Ticket Creator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AC-IMP-07: createImpactTicket', () => {
    it('should create ticket via inbox domain', async () => {
      const mockCreateTicket = vi.fn().mockResolvedValue('ticket-123');
      const { createTicket } = await import('@/lib/domains/inbox');
      vi.mocked(createTicket).mockImplementation(mockCreateTicket);

      const ticketId = await createImpactTicket({
        title: 'Impact ticket',
        description: 'Test description',
        priority: 'high',
        assigneeId: 'user-123',
      });

      expect(ticketId).toBe('ticket-123');
      expect(createTicket).toHaveBeenCalledWith({
        title: 'Impact ticket',
        description: 'Test description',
        priority: 'high',
        assigneeId: 'user-123',
        source: 'impact-wizard',
      });
    });

    it('should propagate errors from inbox domain', async () => {
      const mockCreateTicket = vi.fn().mockRejectedValue(new Error('Inbox error'));
      const { createTicket } = await import('@/lib/domains/inbox');
      vi.mocked(createTicket).mockImplementation(mockCreateTicket);

      await expect(
        createImpactTicket({
          title: 'Test',
          description: 'Test',
          priority: 'medium',
          assigneeId: 'user-123',
        }),
      ).rejects.toThrow('Inbox error');
    });

    it('should add impact-specific metadata to ticket', async () => {
      const mockCreateTicket = vi.fn().mockResolvedValue('ticket-456');
      const { createTicket } = await import('@/lib/domains/inbox');
      vi.mocked(createTicket).mockImplementation(mockCreateTicket);

      const ticketId = await createImpactTicket({
        title: 'Critical impact detected',
        description: 'Change requires immediate attention',
        priority: 'critical',
        assigneeId: 'user-456',
        impactAssessmentId: 'assessment-789',
        regulatoryUpdateId: 'update-999',
      });

      expect(createTicket).toHaveBeenCalledWith({
        title: 'Critical impact detected',
        description: 'Change requires immediate attention',
        priority: 'critical',
        assigneeId: 'user-456',
        source: 'impact-wizard',
        metadata: {
          impactAssessmentId: 'assessment-789',
          regulatoryUpdateId: 'update-999',
        },
      });
      expect(ticketId).toBe('ticket-456');
    });

    it('should return ticket ID on successful creation', async () => {
      const mockCreateTicket = vi.fn().mockResolvedValue('ticket-789');
      const { createTicket } = await import('@/lib/domains/inbox');
      vi.mocked(createTicket).mockImplementation(mockCreateTicket);

      const ticketId = await createImpactTicket({
        title: 'Test',
        description: 'Test',
        priority: 'low',
        assigneeId: 'user-789',
      });

      expect(typeof ticketId).toBe('string');
      expect(ticketId).toMatch(/^ticket-/);
    });
  });
});
