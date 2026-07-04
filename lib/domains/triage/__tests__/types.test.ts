/**
 * @MX:TODO [AUTO] T-001 — TRIAGE types test (RED phase)
 *
 * RED: This test fails because AutoAnswer/TriageResult interfaces do not exist yet.
 * GREEN: Will pass after creating types.ts with minimal type definitions.
 */

import { describe, it, expect } from 'vitest'

// RED: These imports should fail - types don't exist yet
import type { AutoAnswer, TriageResult, RagPipelineInput } from '../types'

describe('TRIAGE Types (T-001)', () => {
  describe('AutoAnswer', () => {
    it('should define answer field as string', () => {
      // RED: Type doesn't exist, this will fail compilation
      const autoAnswer: AutoAnswer = {
        answer: '<p>Test answer</p>',
        citations: [{ source: 'src-uuid-1', quote: 'test quote' }],
      }

      expect(typeof autoAnswer.answer).toBe('string')
    })

    it('should define citations as array of {source, quote?}', () => {
      const autoAnswer: AutoAnswer = {
        answer: 'Test',
        citations: [
          { source: 'src-uuid-1', quote: 'quote 1' },
          { source: 'src-uuid-2', quote: undefined }, // quote optional
        ],
      }

      expect(Array.isArray(autoAnswer.citations)).toBe(true)
      expect(autoAnswer.citations).toHaveLength(2)
      expect(autoAnswer.citations[0]!.source).toBe('src-uuid-1')
      expect(autoAnswer.citations[0]!.quote).toBe('quote 1')
      expect(autoAnswer.citations[1]!.source).toBe('src-uuid-2')
      expect(autoAnswer.citations[1]!.quote).toBeUndefined()
    })
  })

  describe('TriageResult', () => {
    it('should define success case with autoAnswer and autoConfidence', () => {
      const result: TriageResult = {
        autoAnswer: {
          answer: '<p>Test</p>',
          citations: [{ source: 'src-1' }],
        },
        autoConfidence: 0.85,
      }

      expect(result.autoAnswer).toBeDefined()
      expect(result.autoConfidence).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()
    })

    it('should define error case for no_citations', () => {
      const result: TriageResult = {
        autoAnswer: null,
        autoConfidence: null,
        error: 'no_citations',
      }

      expect(result.autoAnswer).toBeNull()
      expect(result.autoConfidence).toBeNull()
      expect(result.error).toBe('no_citations')
    })

    it('should define error case for timeout', () => {
      const result: TriageResult = {
        autoAnswer: null,
        autoConfidence: null,
        error: 'timeout',
      }

      expect(result.error).toBe('timeout')
    })

    it('should define error case for runtime_error', () => {
      const result: TriageResult = {
        autoAnswer: null,
        autoConfidence: null,
        error: 'runtime_error',
      }

      expect(result.error).toBe('runtime_error')
    })
  })

  describe('RagPipelineInput', () => {
    it('should define question and orgId fields', () => {
      const input: RagPipelineInput = {
        question: 'Test question?',
        orgId: 'org-uuid-123',
        signal: undefined,
      }

      expect(typeof input.question).toBe('string')
      expect(typeof input.orgId).toBe('string')
    })
  })
})
