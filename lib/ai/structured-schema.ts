// @MX:ANCHOR [AUTO] Structured block Zod schemas — shared between server and client.
// @MX:REASON Single source of truth for 6 block types matching FOUNDATION
// message_blocks.block_type pgEnum. fan_in >= 3: structured-blocks.ts,
// PATCH route handler, Phase 4 History renderer.
// @MX:SPEC SPEC-REGULA-STRUCTURED-001 (REQ-STRUCT-011~016)

import { z } from 'zod';

// ---------------------------------------------------------------------------
// ProseBlockSchema — block_type: 'prose'
// Stores the final cleaned prose with citation markup.
// ---------------------------------------------------------------------------
export const ProseBlockSchema = z.object({
  type: z.literal('prose'),
  text: z.string().min(1),
});

export type ProseBlock = z.infer<typeof ProseBlockSchema>;

// ---------------------------------------------------------------------------
// ChecklistBlockSchema — block_type: 'checklist' (REQ-STRUCT-012)
// 1~20 items, each with id + title + optional ref + optional refSourceIndex.
// ---------------------------------------------------------------------------
export const ChecklistBlockSchema = z.object({
  type: z.literal('checklist'),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200),
        ref: z.string().max(100).optional(),
        refSourceIndex: z.number().int().positive().optional(),
        completed: z.boolean(),
      }),
    )
    .min(1)
    .max(20),
});

export type ChecklistBlock = z.infer<typeof ChecklistBlockSchema>;

// ---------------------------------------------------------------------------
// ComparisonBlockSchema — block_type: 'comparison' (REQ-STRUCT-013)
// 2~5 cols, 1~30 rows; each row length MUST equal cols length.
// ---------------------------------------------------------------------------
export const ComparisonBlockSchema = z
  .object({
    type: z.literal('comparison'),
    title: z.string().min(1).max(120),
    cols: z.array(z.string().min(1)).min(2).max(5),
    rows: z.array(z.array(z.string())).min(1).max(30),
  })
  .refine((data) => data.rows.every((r) => r.length === data.cols.length), {
    message: 'row length must equal cols length',
  });

export type ComparisonBlock = z.infer<typeof ComparisonBlockSchema>;

// ---------------------------------------------------------------------------
// TimelineBlockSchema — block_type: 'timeline' (REQ-STRUCT-014)
// 1~12 items; date must be YYYY-MM-DD; at most one current item.
// ---------------------------------------------------------------------------
export const TimelineBlockSchema = z
  .object({
    type: z.literal('timeline'),
    items: z
      .array(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          title: z.string().min(1).max(120),
          description: z.string().max(300),
          current: z.boolean().optional(),
        }),
      )
      .min(1)
      .max(12),
  })
  .refine((data) => data.items.filter((i) => i.current === true).length <= 1, {
    message: 'at most one current item',
  });

export type TimelineBlock = z.infer<typeof TimelineBlockSchema>;

// ---------------------------------------------------------------------------
// SourcesBlockSchema — block_type: 'sources' (REQ-STRUCT-015)
// Matches SourcesEvent shape from streaming contract.
// ---------------------------------------------------------------------------
export const SourcesBlockSchema = z.object({
  type: z.literal('sources'),
  items: z.array(
    z.object({
      citeIndex: z.number().int().positive(),
      id: z.string().uuid(),
      orgLabel: z.string(),
      title: z.string(),
      year: z.number().nullable(),
      type: z.enum(['Regulation', 'Guidance', 'Standard', 'Industry', 'Internal']),
      region: z.string(),
      url: z.string().url().optional(),
    }),
  ),
});

export type SourcesBlock = z.infer<typeof SourcesBlockSchema>;

// ---------------------------------------------------------------------------
// RelatedBlockSchema — block_type: 'related' (REQ-STRUCT-016)
// 3~5 Korean natural-language questions, each ≤ 100 chars.
// ---------------------------------------------------------------------------
export const RelatedBlockSchema = z.object({
  type: z.literal('related'),
  items: z.array(z.string().min(1).max(100)).min(3).max(5),
});

export type RelatedBlock = z.infer<typeof RelatedBlockSchema>;

// ---------------------------------------------------------------------------
// BlockSchema — discriminated union of all 6 block types (REQ-STRUCT-011)
// Used for runtime validation when reading from message_blocks.block_json.
// Note: ComparisonBlockSchema and TimelineBlockSchema use .refine() which
// makes them ZodEffects — not compatible with z.discriminatedUnion. We use
// z.union with a type discriminator instead and rely on the individual schemas
// for deep validation.
// ---------------------------------------------------------------------------

// Base schemas without refine for the union discriminator
const ComparisonBlockBaseSchema = z.object({
  type: z.literal('comparison'),
  title: z.string().min(1).max(120),
  cols: z.array(z.string().min(1)).min(2).max(5),
  rows: z.array(z.array(z.string())).min(1).max(30),
});

const TimelineBlockBaseSchema = z.object({
  type: z.literal('timeline'),
  items: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        title: z.string().min(1).max(120),
        description: z.string().max(300),
        current: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(12),
});

export const BlockSchema = z.discriminatedUnion('type', [
  ProseBlockSchema,
  ChecklistBlockSchema,
  ComparisonBlockBaseSchema,
  TimelineBlockBaseSchema,
  SourcesBlockSchema,
  RelatedBlockSchema,
]);

export type Block = z.infer<typeof BlockSchema>;
