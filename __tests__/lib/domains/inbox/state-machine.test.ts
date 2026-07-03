/**
 * State machine tests for inbox triage states.
 * SPEC-V3-INBOX-001 (REQ-V3-INBOX-004, AC-04, Issue #320)
 */

import {
  assertValidTransition,
  canTransition,
  nextStates,
} from '@/lib/domains/inbox/state-machine';
import type { TriageState } from '@/lib/domains/inbox/types';
import { describe, expect, it } from 'vitest';

describe('state-machine', () => {
  describe('canTransition', () => {
    it('should return true for valid auto → needs-review transition', () => {
      expect(canTransition('auto', 'needs-review')).toBe(true);
    });

    it('should return true for valid needs-review → escalated transition', () => {
      expect(canTransition('needs-review', 'escalated')).toBe(true);
    });

    it('should return true for valid needs-review → waiting transition', () => {
      expect(canTransition('needs-review', 'waiting')).toBe(true);
    });

    it('should return true for valid needs-review → closed transition', () => {
      expect(canTransition('needs-review', 'closed')).toBe(true);
    });

    it('should return true for valid needs-review → rejected transition', () => {
      expect(canTransition('needs-review', 'rejected')).toBe(true);
    });

    it('should return true for valid escalated → waiting transition', () => {
      expect(canTransition('escalated', 'waiting')).toBe(true);
    });

    it('should return true for valid escalated → closed transition', () => {
      expect(canTransition('escalated', 'closed')).toBe(true);
    });

    it('should return true for valid escalated → rejected transition', () => {
      expect(canTransition('escalated', 'rejected')).toBe(true);
    });

    it('should return true for valid waiting → needs-review transition', () => {
      expect(canTransition('waiting', 'needs-review')).toBe(true);
    });

    it('should return true for valid waiting → closed transition', () => {
      expect(canTransition('waiting', 'closed')).toBe(true);
    });

    it('should return false for invalid closed → auto transition (terminal state)', () => {
      expect(canTransition('closed', 'auto')).toBe(false);
    });

    it('should return false for invalid rejected → auto transition (terminal state)', () => {
      expect(canTransition('rejected', 'auto')).toBe(false);
    });

    it('should return false for invalid auto → closed transition (skip needs-review)', () => {
      expect(canTransition('auto', 'closed')).toBe(false);
    });

    it('should return false for no-op transition (from === to)', () => {
      expect(canTransition('needs-review', 'needs-review')).toBe(false);
      expect(canTransition('closed', 'closed')).toBe(false);
      expect(canTransition('auto', 'auto')).toBe(false);
    });

    it('should return false for reverse transition (needs-review → auto)', () => {
      expect(canTransition('needs-review', 'auto')).toBe(false);
    });

    it('should return false for invalid waiting → escalated transition', () => {
      expect(canTransition('waiting', 'escalated')).toBe(false);
    });

    it('should return false for invalid escalated → needs-review transition', () => {
      expect(canTransition('escalated', 'needs-review')).toBe(false);
    });

    it('should return false for invalid auto → waiting transition (skip needs-review)', () => {
      expect(canTransition('auto', 'waiting')).toBe(false);
    });
  });

  describe('nextStates', () => {
    it('should return valid next states for auto', () => {
      expect(nextStates('auto')).toEqual(['needs-review']);
    });

    it('should return valid next states for needs-review', () => {
      expect(nextStates('needs-review')).toEqual(['escalated', 'waiting', 'closed', 'rejected']);
    });

    it('should return valid next states for escalated', () => {
      expect(nextStates('escalated')).toEqual(['waiting', 'closed', 'rejected']);
    });

    it('should return valid next states for waiting', () => {
      expect(nextStates('waiting')).toEqual(['needs-review', 'closed']);
    });

    it('should return empty array for terminal state closed', () => {
      expect(nextStates('closed')).toEqual([]);
    });

    it('should return empty array for terminal state rejected', () => {
      expect(nextStates('rejected')).toEqual([]);
    });

    it('should return all possible states for needs-review (branching point)', () => {
      const states = nextStates('needs-review');
      expect(states).toHaveLength(4);
      expect(states).toContain('escalated');
      expect(states).toContain('waiting');
      expect(states).toContain('closed');
      expect(states).toContain('rejected');
    });
  });

  describe('assertValidTransition', () => {
    it('should not throw for valid auto → needs-review transition', () => {
      expect(() => assertValidTransition('auto', 'needs-review')).not.toThrow();
    });

    it('should not throw for valid needs-review → closed transition', () => {
      expect(() => assertValidTransition('needs-review', 'closed')).not.toThrow();
    });

    it('should throw for invalid closed → auto transition', () => {
      expect(() => assertValidTransition('closed', 'auto')).toThrow(
        'Invalid triage state transition: closed → auto',
      );
    });

    it('should throw for invalid no-op transition', () => {
      expect(() => assertValidTransition('needs-review', 'needs-review')).toThrow(
        'Invalid triage state transition: needs-review → needs-review',
      );
    });

    it('should throw error message containing valid next states', () => {
      try {
        assertValidTransition('auto', 'closed');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Valid transitions from auto: needs-review');
      }
    });

    it('should throw for invalid reverse transition', () => {
      expect(() => assertValidTransition('closed', 'rejected')).toThrow(
        'Invalid triage state transition: closed → rejected',
      );
    });

    it('should throw for invalid auto → waiting transition', () => {
      expect(() => assertValidTransition('auto', 'waiting')).toThrow(
        'Invalid triage state transition: auto → waiting',
      );
    });

    it('should include all valid states in error message for branching state', () => {
      try {
        assertValidTransition('needs-review', 'auto');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain('escalated');
        expect(message).toContain('waiting');
        expect(message).toContain('closed');
        expect(message).toContain('rejected');
      }
    });
  });

  describe('AC-04: State Machine Invariants', () => {
    it('should enforce terminal state invariants (closed/rejected have no outgoing transitions)', () => {
      expect(nextStates('closed')).toEqual([]);
      expect(nextStates('rejected')).toEqual([]);
      expect(canTransition('closed', 'auto')).toBe(false);
      expect(canTransition('rejected', 'needs-review')).toBe(false);
    });

    it('should enforce single-path invariant (auto → needs-review only)', () => {
      expect(canTransition('auto', 'needs-review')).toBe(true);
      expect(canTransition('auto', 'escalated')).toBe(false);
      expect(canTransition('auto', 'waiting')).toBe(false);
      expect(canTransition('auto', 'closed')).toBe(false);
      expect(canTransition('auto', 'rejected')).toBe(false);
    });

    it('should enforce no-op transition prohibition (audit trail requirement)', () => {
      const allStates: TriageState[] = [
        'auto',
        'needs-review',
        'escalated',
        'waiting',
        'closed',
        'rejected',
      ];
      for (const state of allStates) {
        expect(canTransition(state, state)).toBe(false);
      }
    });

    it('should prevent backward transitions to auto (flow direction invariant)', () => {
      expect(canTransition('needs-review', 'auto')).toBe(false);
      expect(canTransition('escalated', 'auto')).toBe(false);
      expect(canTransition('waiting', 'auto')).toBe(false);
      expect(canTransition('closed', 'auto')).toBe(false);
      expect(canTransition('rejected', 'auto')).toBe(false);
    });

    it('should enforce citation-forced transition (auto → needs-review is mandatory)', () => {
      // Charter [지양-2]: auto_answer without citations MUST force auto→needs-review
      // This is validated at call site, but state machine must allow this transition
      expect(canTransition('auto', 'needs-review')).toBe(true);
      // And must NOT allow skipping to closed without review
      expect(canTransition('auto', 'closed')).toBe(false);
    });
  });
});
