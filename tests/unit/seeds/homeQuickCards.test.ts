// @MX:NOTE [AUTO] T-021 TDD RED phase — Home quick cards seed tests.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-004)

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..', '..');

describe('lib/seeds/homeQuickCards.ts (REQ-BREADTH-004)', () => {
  it('homeQuickCards.ts file exists', () => {
    const filePath = path.join(root, 'lib', 'seeds', 'homeQuickCards.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('exports homeQuickCards constant', () => {
    const src = fs.readFileSync(path.join(root, 'lib', 'seeds', 'homeQuickCards.ts'), 'utf8');
    expect(src).toMatch(/export const homeQuickCards/);
  });

  it('homeQuickCards is an array of 4 items', async () => {
    const { homeQuickCards } = await import('@/lib/seeds/homeQuickCards');
    expect(Array.isArray(homeQuickCards)).toBe(true);
    expect(homeQuickCards).toHaveLength(4);
  });

  it('each card has icon, title, description, sampleQuestion fields', async () => {
    const { homeQuickCards } = await import('@/lib/seeds/homeQuickCards');
    for (const card of homeQuickCards) {
      expect(typeof card.icon).toBe('string');
      expect(typeof card.title).toBe('string');
      expect(typeof card.description).toBe('string');
      expect(typeof card.sampleQuestion).toBe('string');
    }
  });

  it('covers regulation-lookup, strategy, comparison, timeline use cases', async () => {
    const { homeQuickCards } = await import('@/lib/seeds/homeQuickCards');
    const icons = homeQuickCards.map((c) => c.icon);
    expect(icons).toContain('Search');
    expect(icons).toContain('Target');
    expect(icons).toContain('GitCompare');
    expect(icons).toContain('Clock');
  });

  it('all sampleQuestion fields are Korean-language strings', async () => {
    const { homeQuickCards } = await import('@/lib/seeds/homeQuickCards');
    for (const card of homeQuickCards) {
      // Korean character range check: 가-힣
      expect(card.sampleQuestion).toMatch(/[가-힣]/);
    }
  });

  it('all title and description fields are Korean-language strings', async () => {
    const { homeQuickCards } = await import('@/lib/seeds/homeQuickCards');
    for (const card of homeQuickCards) {
      expect(card.title).toMatch(/[가-힣]/);
      expect(card.description).toMatch(/[가-힣]/);
    }
  });
});
