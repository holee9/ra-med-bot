/**
 * @MX:TODO [AUTO] T-003 — TRIAGE_TIMEOUT_MS env var test (RED phase)
 *
 * RED: This test fails because envSchema doesn't have TRIAGE_TIMEOUT_MS yet.
 * GREEN: Will pass after adding TRIAGE_TIMEOUT_MS to env.ts schema.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { __resetEnvCacheForTests, getEnv } from '../../../env'

describe('TRIAGE Environment (T-003)', () => {
  beforeEach(() => {
    // Reset cache before each test
    __resetEnvCacheForTests()

    // Set minimal required env vars for validation
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
    process.env.AUTH_SECRET = 'a'.repeat(32) // 32 chars minimum
    process.env.NEXTAUTH_URL = 'http://localhost:3000'
    process.env.AUTH_MICROSOFT_ID = 'test-id'
    process.env.AUTH_MICROSOFT_SECRET = 'test-secret'
    process.env.AUTH_GOOGLE_ID = 'test-id'
    process.env.AUTH_GOOGLE_SECRET = 'test-secret'
  })

  afterEach(() => {
    // Clean up after tests
    __resetEnvCacheForTests()
  })

  describe('TRIAGE_TIMEOUT_MS', () => {
    it('should default to 15000ms when not set', () => {
      // Remove env var if it exists
      delete process.env.TRIAGE_TIMEOUT_MS

      const env = getEnv()

      // RED: TRIAGE_TIMEOUT_MS doesn't exist in env schema yet
      expect(env).toHaveProperty('TRIAGE_TIMEOUT_MS')
      expect(env.TRIAGE_TIMEOUT_MS).toBe(15000)
    })

    it('should parse custom timeout value', () => {
      process.env.TRIAGE_TIMEOUT_MS = '25000'

      const env = getEnv()

      expect(env.TRIAGE_TIMEOUT_MS).toBe(25000)
    })

    it('should coerce string to number', () => {
      process.env.TRIAGE_TIMEOUT_MS = '30000'

      const env = getEnv()

      expect(typeof env.TRIAGE_TIMEOUT_MS).toBe('number')
      expect(env.TRIAGE_TIMEOUT_MS).toBe(30000)
    })
  })
})
