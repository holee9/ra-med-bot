// @MX:NOTE Unit tests for structured-schema.ts — REQ-STRUCT-011~016.
// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  BlockSchema,
  ChecklistBlockSchema,
  ComparisonBlockSchema,
  ProseBlockSchema,
  RelatedBlockSchema,
  SourcesBlockSchema,
  TimelineBlockSchema,
} from '../../lib/ai/structured-schema';

// --- ProseBlockSchema ---
describe('ProseBlockSchema', () => {
  it('accepts valid prose block', () => {
    const result = ProseBlockSchema.safeParse({ type: 'prose', text: 'Hello world' });
    expect(result.success).toBe(true);
  });

  it('rejects prose block without text', () => {
    const result = ProseBlockSchema.safeParse({ type: 'prose' });
    expect(result.success).toBe(false);
  });

  it('rejects empty text', () => {
    const result = ProseBlockSchema.safeParse({ type: 'prose', text: '' });
    expect(result.success).toBe(false);
  });
});

// --- ChecklistBlockSchema (REQ-STRUCT-012) ---
describe('ChecklistBlockSchema', () => {
  const validItem = {
    id: 'item-1',
    title: '21 CFR §807.81(a) 요구사항 검토',
    completed: false,
  };

  it('accepts valid checklist block with min items', () => {
    const result = ChecklistBlockSchema.safeParse({
      type: 'checklist',
      items: [validItem],
    });
    expect(result.success).toBe(true);
  });

  it('accepts item with optional ref and refSourceIndex', () => {
    const result = ChecklistBlockSchema.safeParse({
      type: 'checklist',
      items: [{ ...validItem, ref: '21 CFR §807.81(a)', refSourceIndex: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects 0 items (min 1)', () => {
    const result = ChecklistBlockSchema.safeParse({ type: 'checklist', items: [] });
    expect(result.success).toBe(false);
  });

  it('rejects 21 items (max 20)', () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ id: `item-${i}`, title: 'T', completed: false }));
    const result = ChecklistBlockSchema.safeParse({ type: 'checklist', items });
    expect(result.success).toBe(false);
  });

  it('rejects item with empty id', () => {
    const result = ChecklistBlockSchema.safeParse({
      type: 'checklist',
      items: [{ id: '', title: 'T', completed: false }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects item with empty title', () => {
    const result = ChecklistBlockSchema.safeParse({
      type: 'checklist',
      items: [{ id: 'x', title: '', completed: false }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects item with title > 200 chars', () => {
    const result = ChecklistBlockSchema.safeParse({
      type: 'checklist',
      items: [{ id: 'x', title: 'A'.repeat(201), completed: false }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 20 items', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `item-${i}`, title: 'T', completed: false }));
    const result = ChecklistBlockSchema.safeParse({ type: 'checklist', items });
    expect(result.success).toBe(true);
  });
});

// --- ComparisonBlockSchema (REQ-STRUCT-013) ---
describe('ComparisonBlockSchema', () => {
  it('accepts valid comparison block', () => {
    const result = ComparisonBlockSchema.safeParse({
      type: 'comparison',
      title: 'FDA vs EU 비교',
      cols: ['FDA', 'EU'],
      rows: [['a', 'b'], ['c', 'd']],
    });
    expect(result.success).toBe(true);
  });

  it('rejects row length mismatch (cols=2, row=1)', () => {
    const result = ComparisonBlockSchema.safeParse({
      type: 'comparison',
      title: 'Test',
      cols: ['FDA', 'EU'],
      rows: [['a']],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('row length'))).toBe(true);
    }
  });

  it('rejects 1 col (min 2)', () => {
    const result = ComparisonBlockSchema.safeParse({
      type: 'comparison',
      title: 'Test',
      cols: ['FDA'],
      rows: [['a']],
    });
    expect(result.success).toBe(false);
  });

  it('rejects 6 cols (max 5)', () => {
    const result = ComparisonBlockSchema.safeParse({
      type: 'comparison',
      title: 'Test',
      cols: ['A', 'B', 'C', 'D', 'E', 'F'],
      rows: [['1', '2', '3', '4', '5', '6']],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty rows (min 1)', () => {
    const result = ComparisonBlockSchema.safeParse({
      type: 'comparison',
      title: 'Test',
      cols: ['A', 'B'],
      rows: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = ComparisonBlockSchema.safeParse({
      type: 'comparison',
      title: '',
      cols: ['A', 'B'],
      rows: [['a', 'b']],
    });
    expect(result.success).toBe(false);
  });
});

// --- TimelineBlockSchema (REQ-STRUCT-014) ---
describe('TimelineBlockSchema', () => {
  const validItem = {
    date: '2026-01-15',
    title: '제출 마감',
    description: '510(k) 제출 마감일',
  };

  it('accepts valid timeline block', () => {
    const result = TimelineBlockSchema.safeParse({
      type: 'timeline',
      items: [validItem],
    });
    expect(result.success).toBe(true);
  });

  it('accepts item with current flag', () => {
    const result = TimelineBlockSchema.safeParse({
      type: 'timeline',
      items: [{ ...validItem, current: true }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects when 2 items both have current=true', () => {
    const result = TimelineBlockSchema.safeParse({
      type: 'timeline',
      items: [
        { ...validItem, current: true },
        { date: '2026-02-15', title: 'B', description: 'D', current: true },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('current'))).toBe(true);
    }
  });

  it('rejects invalid date format (2026/01/15)', () => {
    const result = TimelineBlockSchema.safeParse({
      type: 'timeline',
      items: [{ date: '2026/01/15', title: 'T', description: 'D' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty items (min 1)', () => {
    const result = TimelineBlockSchema.safeParse({ type: 'timeline', items: [] });
    expect(result.success).toBe(false);
  });

  it('rejects 13 items (max 12)', () => {
    const items = Array.from({ length: 13 }, (_, i) => ({
      date: `2026-0${Math.min(i + 1, 9)}-01`,
      title: 'T',
      description: 'D',
    }));
    const result = TimelineBlockSchema.safeParse({ type: 'timeline', items });
    expect(result.success).toBe(false);
  });
});

// --- SourcesBlockSchema (REQ-STRUCT-015) ---
describe('SourcesBlockSchema', () => {
  const validSource = {
    citeIndex: 1,
    id: '123e4567-e89b-12d3-a456-426614174000',
    orgLabel: 'FDA',
    title: 'Guidance on 510(k)',
    year: 2024,
    type: 'Regulation' as const,
    region: 'US',
  };

  it('accepts valid sources block', () => {
    const result = SourcesBlockSchema.safeParse({
      type: 'sources',
      items: [validSource],
    });
    expect(result.success).toBe(true);
  });

  it('accepts source with optional url', () => {
    const result = SourcesBlockSchema.safeParse({
      type: 'sources',
      items: [{ ...validSource, url: 'https://fda.gov/guidance' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects citeIndex = 0 (must be positive)', () => {
    const result = SourcesBlockSchema.safeParse({
      type: 'sources',
      items: [{ ...validSource, citeIndex: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid id', () => {
    const result = SourcesBlockSchema.safeParse({
      type: 'sources',
      items: [{ ...validSource, id: 'not-a-uuid' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown source type', () => {
    const result = SourcesBlockSchema.safeParse({
      type: 'sources',
      items: [{ ...validSource, type: 'Unknown' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 5 valid source types', () => {
    const types = ['Regulation', 'Guidance', 'Standard', 'Industry', 'Internal'] as const;
    for (const t of types) {
      const result = SourcesBlockSchema.safeParse({
        type: 'sources',
        items: [{ ...validSource, type: t }],
      });
      expect(result.success).toBe(true);
    }
  });
});

// --- RelatedBlockSchema (REQ-STRUCT-016) ---
describe('RelatedBlockSchema', () => {
  it('accepts 3 items (min)', () => {
    const result = RelatedBlockSchema.safeParse({
      type: 'related',
      items: ['질문1', '질문2', '질문3'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts 5 items (max)', () => {
    const result = RelatedBlockSchema.safeParse({
      type: 'related',
      items: ['q1', 'q2', 'q3', 'q4', 'q5'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects 2 items (min 3)', () => {
    const result = RelatedBlockSchema.safeParse({
      type: 'related',
      items: ['q1', 'q2'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects 6 items (max 5)', () => {
    const result = RelatedBlockSchema.safeParse({
      type: 'related',
      items: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects item > 100 chars', () => {
    const result = RelatedBlockSchema.safeParse({
      type: 'related',
      items: ['q1', 'q2', 'A'.repeat(101)],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty string item', () => {
    const result = RelatedBlockSchema.safeParse({
      type: 'related',
      items: ['q1', 'q2', ''],
    });
    expect(result.success).toBe(false);
  });
});

// --- BlockSchema discriminated union (REQ-STRUCT-011) ---
describe('BlockSchema discriminated union', () => {
  it('accepts prose block via union', () => {
    const result = BlockSchema.safeParse({ type: 'prose', text: 'hello' });
    expect(result.success).toBe(true);
  });

  it('accepts checklist block via union', () => {
    const result = BlockSchema.safeParse({
      type: 'checklist',
      items: [{ id: 'x', title: 'T', completed: false }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown block type', () => {
    const result = BlockSchema.safeParse({ type: 'unknown', data: 'x' });
    expect(result.success).toBe(false);
  });
});
