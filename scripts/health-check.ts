#!/usr/bin/env -S node --experimental-strip-types

/**
 * Health check endpoint for public verification.
 * Validates that required environment variables are available and properly formatted.
 *
 * Exit codes:
 * - 0: All checks pass (system healthy)
 * - 1: One or more checks fail (system unhealthy)
 *
 * Usage:
 *   node scripts/health-check.ts
 *
 * @MX:ANCHOR Public health check — Issue #165 requirement
 * @MX:REASON Public URL validation requires guaranteed env availability before DB connection
 */

import { parseEnv } from '../lib/env.js';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks: {
    database_url: { available: boolean; error?: string };
    auth_secret: { available: boolean; error?: string };
    nextauth_url: { available: boolean; error?: string };
  };
  timestamp: string;
}

function checkEnvHealth(): HealthCheckResult {
  const result: HealthCheckResult = {
    status: 'healthy',
    checks: {
      database_url: { available: true },
      auth_secret: { available: true },
      nextauth_url: { available: true },
    },
    timestamp: new Date().toISOString(),
  };

  try {
    // Parse and validate environment
    const env = parseEnv();

    // Check DATABASE_URL
    if (!env.DATABASE_URL) {
      result.checks.database_url = {
        available: false,
        error: 'DATABASE_URL is missing or empty',
      };
      result.status = 'unhealthy';
    } else {
      try {
        new URL(env.DATABASE_URL);
      } catch {
        result.checks.database_url = {
          available: false,
          error: 'DATABASE_URL is not a valid URL',
        };
        result.status = 'unhealthy';
      }
    }

    // Check AUTH_SECRET
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
      result.checks.auth_secret = {
        available: false,
        error: 'AUTH_SECRET is missing or too short (min 32 characters)',
      };
      result.status = 'unhealthy';
    }

    // Check NEXTAUTH_URL
    if (!env.NEXTAUTH_URL) {
      result.checks.nextauth_url = {
        available: false,
        error: 'NEXTAUTH_URL is missing or empty',
      };
      result.status = 'unhealthy';
    } else {
      try {
        new URL(env.NEXTAUTH_URL);
      } catch {
        result.checks.nextauth_url = {
          available: false,
          error: 'NEXTAUTH_URL is not a valid URL',
        };
        result.status = 'unhealthy';
      }
    }
  } catch (error) {
    // If parseEnv throws, mark all checks as failed with the error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';

    result.checks.database_url = {
      available: false,
      error: errorMessage,
    };
    result.checks.auth_secret = {
      available: false,
      error: errorMessage,
    };
    result.checks.nextauth_url = {
      available: false,
      error: errorMessage,
    };
    result.status = 'unhealthy';
  }

  return result;
}

// Main execution
const healthResult = checkEnvHealth();

console.log(JSON.stringify(healthResult, null, 2));

// Exit with appropriate code
process.exit(healthResult.status === 'healthy' ? 0 : 1);
