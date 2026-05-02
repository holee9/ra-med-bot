// Tests for SPEC-REGULA-FOUNDATION-001 T-002 (REQ-FND-021..029)
// Verifies design token layer: styles/tokens.css and app/globals.css.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const TOKENS = path.join(ROOT, 'styles/tokens.css');
const GLOBALS = path.join(ROOT, 'app/globals.css');

describe('REQ-FND-021: styles/tokens.css design tokens', () => {
  it('file exists', () => {
    expect(existsSync(TOKENS)).toBe(true);
  });

  const css = existsSync(TOKENS) ? readFileSync(TOKENS, 'utf8') : '';

  it('contains --color-brand-50 through --color-brand-900 (9 ramp steps)', () => {
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    for (const step of steps) {
      expect(css).toMatch(new RegExp(`--color-brand-${step}\\s*:`));
    }
  });

  it('contains amber accent palette', () => {
    for (const step of [50, 100, 400, 500, 600, 700]) {
      expect(css).toMatch(new RegExp(`--color-amber-${step}\\s*:`));
    }
  });

  it('contains semantic colors (success/warn/danger)', () => {
    expect(css).toMatch(/--color-success\s*:/);
    expect(css).toMatch(/--color-warn\s*:/);
    expect(css).toMatch(/--color-danger\s*:/);
  });

  it('contains ink neutral ladder', () => {
    for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      expect(css).toMatch(new RegExp(`--color-ink-${step}\\s*:`));
    }
  });
});

describe('REQ-FND-023: --font-serif exact ordering (AUD-002)', () => {
  const css = readFileSync(TOKENS, 'utf8');
  it('--font-serif equals "Source Serif 4", "Noto Serif KR", Georgia, serif', () => {
    expect(css).toMatch(
      /--font-serif\s*:\s*"Source Serif 4",\s*"Noto Serif KR",\s*Georgia,\s*serif\s*;/,
    );
  });
});

describe('REQ-FND-024: --font-sans includes Pretendard', () => {
  const css = readFileSync(TOKENS, 'utf8');
  it('Pretendard appears in --font-sans stack', () => {
    expect(css).toMatch(/--font-sans\s*:[^;]*Pretendard/);
  });
  it('starts with "IBM Plex Sans" before Pretendard', () => {
    expect(css).toMatch(/--font-sans\s*:\s*"IBM Plex Sans",\s*"Pretendard"/);
  });
});

describe('REQ-FND-028: layout constants', () => {
  const css = readFileSync(TOKENS, 'utf8');
  it('--nav-w: 260px', () => {
    expect(css).toMatch(/--nav-w\s*:\s*260px\s*;/);
  });
  it('--topbar-h: 56px', () => {
    expect(css).toMatch(/--topbar-h\s*:\s*56px\s*;/);
  });
  it('--right-w: 360px', () => {
    expect(css).toMatch(/--right-w\s*:\s*360px\s*;/);
  });
  it('--content-max: 840px', () => {
    expect(css).toMatch(/--content-max\s*:\s*840px\s*;/);
  });
});

describe('REQ-FND-027: dark mode override block', () => {
  const css = readFileSync(TOKENS, 'utf8');
  it('contains [data-theme="dark"] selector', () => {
    expect(css).toMatch(/\[data-theme=["']dark["']\]\s*\{/);
  });

  it('redefines at least 10 color tokens within the dark block', () => {
    const match = css.match(/\[data-theme=["']dark["']\]\s*\{([\s\S]*?)\n\}/);
    expect(match).not.toBeNull();
    const block = match?.[1];
    if (block === undefined) {
      expect(block).toBeDefined();
      return;
    }
    const overrides = block.match(/--[a-z0-9-]+\s*:/g) ?? [];
    expect(overrides.length).toBeGreaterThanOrEqual(10);
  });

  it('does NOT contain a @theme block (single source of truth in globals.css)', () => {
    expect(css).not.toMatch(/@theme\s*\{/);
  });
});

describe('REQ-FND-022 & REQ-FND-029: app/globals.css', () => {
  it('file exists', () => {
    expect(existsSync(GLOBALS)).toBe(true);
  });

  const css = existsSync(GLOBALS) ? readFileSync(GLOBALS, 'utf8') : '';

  it('imports ../styles/tokens.css', () => {
    expect(css).toMatch(/@import\s+["']\.\.\/styles\/tokens\.css["']/);
  });

  it('contains a @theme block', () => {
    expect(css).toMatch(/@theme\s*\{/);
  });

  it('@theme block exposes --color-brand-* mappings', () => {
    const match = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toMatch(/--color-brand-800/);
  });

  it('@theme block exposes --font-serif and --font-sans', () => {
    const match = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
    expect(match?.[1]).toMatch(/--font-serif/);
    expect(match?.[1]).toMatch(/--font-sans/);
  });
});
