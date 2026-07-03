/**
 * SLA calculation tests for inbox tickets.
 * SPEC-V3-INBOX-001 (REQ-V3-INBOX-013, AC-13, Issue #320)
 */

import { computeSlaDeadline, getSlaStatus, isOverdue } from '@/lib/domains/inbox/sla';
import { describe, expect, it } from 'vitest';

describe('sla', () => {
  describe('computeSlaDeadline', () => {
    describe('AC-13: Default 3 business days', () => {
      it('should calculate 3 business days from Monday', () => {
        const monday = new Date('2026-01-05'); // Monday
        const deadline = computeSlaDeadline(monday);

        // Monday + 3 business days = Thursday (skip Sat, Sun)
        expect(deadline.getDay()).toBe(4); // Thursday
        expect(deadline.toISOString().split('T')[0]).toBe('2026-01-08');
      });

      it('should calculate 3 business days from Wednesday', () => {
        const wednesday = new Date('2026-01-07'); // Wednesday
        const deadline = computeSlaDeadline(wednesday);

        // Wed + 3 business days = Mon (skip Sat, Sun)
        expect(deadline.getDay()).toBe(1); // Monday
        expect(deadline.toISOString().split('T')[0]).toBe('2026-01-12');
      });

      it('should calculate 3 business days from Friday', () => {
        const friday = new Date('2026-01-10'); // Friday
        const deadline = computeSlaDeadline(friday);

        // Fri + 1 business day = Mon (skip Sat, Sun)
        // Mon + 2 business days = Wed
        expect(deadline.getDay()).toBe(3); // Wednesday
        expect(deadline.toISOString().split('T')[0]).toBe('2026-01-14');
      });

      it('should skip Saturday when counting business days', () => {
        const friday = new Date('2026-01-10'); // Friday
        const deadline = computeSlaDeadline(friday);

        // Should not include Saturday
        expect(deadline.getDay()).not.toBe(6); // Not Saturday
      });

      it('should skip Sunday when counting business days', () => {
        const saturday = new Date('2026-01-11'); // Saturday
        const deadline = computeSlaDeadline(saturday);

        // Sat + 1 business day = Mon (skip Sun)
        expect(deadline.getDay()).not.toBe(0); // Not Sunday
      });
    });

    describe('Custom SLA configuration', () => {
      it('should use custom business days when provided', () => {
        const monday = new Date('2026-01-05');
        const deadline = computeSlaDeadline(monday, { businessDays: 5 });

        // Monday + 5 business days = Monday next week
        expect(deadline.getDay()).toBe(1); // Monday
        expect(deadline.toISOString().split('T')[0]).toBe('2026-01-12');
      });

      it('should use 1 business day when configured', () => {
        const wednesday = new Date('2026-01-07');
        const deadline = computeSlaDeadline(wednesday, { businessDays: 1 });

        // Wed + 1 business day = Thu
        expect(deadline.getDay()).toBe(4); // Thursday
        expect(deadline.toISOString().split('T')[0]).toBe('2026-01-08');
      });

      it('should use 2 business days when configured', () => {
        const tuesday = new Date('2026-01-06');
        const deadline = computeSlaDeadline(tuesday, { businessDays: 2 });

        // Tue + 2 business days = Thu
        expect(deadline.getDay()).toBe(4); // Thursday
        expect(deadline.toISOString().split('T')[0]).toBe('2026-01-08');
      });
    });

    describe('Weekend handling', () => {
      it('should correctly count business days across weekend', () => {
        const friday = new Date('2026-01-10');
        const deadline = computeSlaDeadline(friday);

        // Fri → Sat (skip) → Sun (skip) → Mon (count 1) → Tue (count 2) → Wed (count 3)
        const daysDiff = Math.floor(
          (deadline.getTime() - friday.getTime()) / (1000 * 60 * 60 * 24),
        );
        expect(daysDiff).toBe(4); // 4 calendar days for 3 business days
      });

      it('should handle starting on Saturday', () => {
        const saturday = new Date('2026-01-11'); // Saturday
        const deadline = computeSlaDeadline(saturday);

        // Sat → Sun (skip) → Mon (count 1) → Tue (count 2) → Wed (count 3)
        expect(deadline.getDay()).toBe(3); // Wednesday
        expect(deadline.toISOString().split('T')[0]).toBe('2026-01-14');
      });

      it('should handle starting on Sunday', () => {
        const sunday = new Date('2026-01-12'); // Sunday
        const deadline = computeSlaDeadline(sunday);

        // Sun → Mon (count 1) → Tue (count 2) → Wed (count 3)
        expect(deadline.getDay()).toBe(4); // Thursday (Mon+3 business days = Thu)
        expect(deadline.toISOString().split('T')[0]).toBe('2026-01-15');
      });
    });
  });

  describe('getSlaStatus', () => {
    it('should return ok when current time is before deadline', () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);

      const result = getSlaStatus(future);
      expect(result).toBe('ok');
    });

    it('should return overdue when current time is after deadline', () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);

      const result = getSlaStatus(past);
      expect(result).toBe('overdue');
    });

    it('should return warning when current time equals deadline', () => {
      const now = new Date();

      const result = getSlaStatus(now);
      expect(result).toBe('warning');
    });
  });

  describe('isOverdue', () => {
    it('should return false when deadline is in future', () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);

      expect(isOverdue(future)).toBe(false);
    });

    it('should return true when deadline is in past', () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);

      expect(isOverdue(past)).toBe(true);
    });

    it('should return false when deadline equals now', () => {
      const now = new Date();

      expect(isOverdue(now)).toBe(false);
    });
  });
});
