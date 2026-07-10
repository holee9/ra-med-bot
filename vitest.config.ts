import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vitest config for unit + integration tests.
// Unit tests run in node by default; component tests opt into jsdom via
// /** @vitest-environment jsdom */ at the top of the file.

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/integration/**/*.test.{ts,tsx}',
      'tests/regression/**/*.test.{ts,tsx}',
      '__tests__/**/*.test.{ts,tsx}',
      // Co-located library tests (e.g. lib/predicate/__tests__) — SPEC-REGULA-PREDICATE-001.
      'lib/**/__tests__/**/*.test.{ts,tsx}',
      // Co-located app route tests (e.g. app/api/ra/predicate/__tests__) — SPEC-REGULA-PREDICATE-001.
      'app/**/__tests__/**/*.test.{ts,tsx}',
      // Co-located component tests (e.g. components/risk/__tests__) — SPEC-REGULA-RISK-001.
      'components/**/__tests__/**/*.test.{ts,tsx}',
      // E2E fixture helpers and globalSetup have vitest unit tests (SPEC-REGULA-E2EFIX-001).
      'tests/e2e/fixtures/**/*.test.{ts,tsx}',
      'playwright/**/*.test.{ts,tsx}',
    ],
    exclude: ['tests/e2e/*.spec.ts', 'node_modules', '.next', '**/archive/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['lib/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      // SPEC-REGULA-REALDB-001 REQ-COV-001: ratchet floor. M0 baseline (2026-07-09)
      // measured 62% Stmts / 73.5% Branch / 62% Funcs / 62% Lines over
      // lib/app/components. Thresholds sit ~2pt below baseline as a stable floor:
      // catches significant regression (>2pt drop) without flaking on minor
      // run-to-run variance. Target 85% tracked in follow-up (ratchet up).
      // 2026-07-11 ratchet-up (Phase 4 BLOCK-4, #402): 28 files (incl 3 large
      // routes) → All-files Stmts 63.78 / Branch 75.54 / Funcs 64.83 / Lines 63.78.
      // Floor bumped 60/70/60/60 → 62/74/63/62 → 63/75/64/63 (margin below actual).
      // 85% target remains follow-up (long tail — large lib/route coverage).
      thresholds: {
        statements: 63,
        branches: 75,
        functions: 64,
        lines: 63,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/components': path.resolve(__dirname, './components'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@/stores': path.resolve(__dirname, './stores'),
      '@/styles': path.resolve(__dirname, './styles'),
    },
  },
});
