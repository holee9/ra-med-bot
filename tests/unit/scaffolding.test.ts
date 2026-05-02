// @MX:NOTE Scaffolding test — verifies REQ-FND-001..006, 029a, 060.
// Reads files at the repo root and asserts shape; no runtime imports of
// app code so it can run before any application files exist.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readJson = (rel: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

describe('package.json', () => {
  const pkg = readJson('package.json') as {
    packageManager?: string;
    engines?: { node?: string };
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it('REQ-FND-001: declares pnpm as the package manager', () => {
    expect(pkg.packageManager).toBeDefined();
    expect(pkg.packageManager).toMatch(/^pnpm@9\./);
  });

  it('REQ-FND-002: pins Node engine to >= 20', () => {
    expect(pkg.engines?.node).toBe('>=20.0.0');
  });

  it('REQ-FND-003: pins Next.js 15, React 18, TypeScript 5.4+', () => {
    expect(pkg.dependencies?.next).toMatch(/^\^15\./);
    expect(pkg.dependencies?.react).toMatch(/^\^18\./);
    expect(pkg.devDependencies?.typescript).toMatch(/^\^5\.[4-9]/);
  });

  it('REQ-FND-004: includes the production runtime dependencies', () => {
    const required = [
      'next-auth',
      'drizzle-orm',
      'postgres',
      'zod',
      'zustand',
      '@tanstack/react-query',
      'ai',
      'tailwindcss', // v4 lives in devDeps but must be present
    ];
    for (const name of required) {
      const present =
        pkg.dependencies?.[name] !== undefined || pkg.devDependencies?.[name] !== undefined;
      expect(present, `${name} must be declared`).toBe(true);
    }
  });

  it('REQ-FND-005: includes the dev tooling dependencies', () => {
    const required = [
      '@biomejs/biome',
      'vitest',
      '@playwright/test',
      'drizzle-kit',
      '@testing-library/react',
      '@vitejs/plugin-react',
      '@types/node',
      '@types/react',
    ];
    for (const name of required) {
      expect(pkg.devDependencies?.[name], `${name} must be in devDependencies`).toBeDefined();
    }
  });

  it('REQ-FND-025: uses @fontsource/pretendard (not Google Fonts)', () => {
    expect(pkg.dependencies?.['@fontsource/pretendard']).toBeDefined();
  });
});

describe('tsconfig.json', () => {
  const ts = readJson('tsconfig.json') as { compilerOptions?: Record<string, unknown> };

  it('REQ-FND-006: enables strict mode', () => {
    expect(ts.compilerOptions?.strict).toBe(true);
  });

  it('declares the @/* path alias', () => {
    const paths = ts.compilerOptions?.paths as Record<string, string[]> | undefined;
    expect(paths?.['@/*']).toEqual(['./*']);
  });
});

describe('.env.example', () => {
  const env = readText('.env.example');

  it('REQ-FND-007: contains all Phase 1 keys', () => {
    const required = [
      'DATABASE_URL',
      'AUTH_SECRET',
      'NEXTAUTH_URL',
      'AUTH_MICROSOFT_ENTRA_ID',
      'AUTH_MICROSOFT_SECRET',
      'AUTH_MICROSOFT_TENANT_ID',
      'AUTH_GOOGLE_ID',
      'AUTH_GOOGLE_SECRET',
    ];
    for (const key of required) {
      expect(env, `${key} must appear in .env.example`).toContain(key);
    }
  });

  it('does not leak the legacy NEXTAUTH_SECRET name as a primary key', () => {
    // The Auth.js v5 canonical name is AUTH_SECRET. NEXTAUTH_SECRET is allowed
    // only as a comment-side note, never as a live env declaration.
    expect(env).not.toMatch(/^NEXTAUTH_SECRET=/m);
  });
});

describe('tailwind.config.ts', () => {
  const cfg = readText('tailwind.config.ts');

  it('REQ-FND-029a: darkMode is class', () => {
    expect(cfg).toMatch(/darkMode:\s*['"]class['"]/);
  });

  it('REQ-FND-029a: content globs cover app/ and components/', () => {
    expect(cfg).toContain('./app/**/*.{ts,tsx}');
    expect(cfg).toContain('./components/**/*.{ts,tsx}');
  });
});

describe('biome.json', () => {
  const biome = readJson('biome.json') as Record<string, unknown>;

  it('exists with linter enabled', () => {
    expect((biome.linter as { enabled?: boolean })?.enabled).toBe(true);
  });

  it('REQ-FND-030: hex-color guard script exists and is wired into lint', () => {
    expect(fs.existsSync(path.join(root, 'scripts/no-hex-colors.mjs'))).toBe(true);
    const pkg = readJson('package.json') as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['lint:hex']).toBe('node scripts/no-hex-colors.mjs');
    expect(pkg.scripts?.lint).toContain('lint:hex');
  });
});

describe('DEVELOPMENT.md', () => {
  const doc = readText('DEVELOPMENT.md');

  it('REQ-FND-060: has all five required sections', () => {
    const sections = [
      'Prerequisites',
      'Setup',
      'Development Commands',
      'Testing',
      'Troubleshooting',
    ];
    for (const heading of sections) {
      expect(doc, `Missing section: ${heading}`).toMatch(new RegExp(`^##\\s+${heading}\\s*$`, 'm'));
    }
  });
});

describe('drizzle.config.ts', () => {
  it('exists', () => {
    expect(fs.existsSync(path.join(root, 'drizzle.config.ts'))).toBe(true);
  });
});

describe('vitest.config.ts', () => {
  it('exists', () => {
    expect(fs.existsSync(path.join(root, 'vitest.config.ts'))).toBe(true);
  });
});
