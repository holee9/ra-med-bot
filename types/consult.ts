// @MX:ANCHOR ConsultRequest Zod schema — entry point for all consult API requests.
// @MX:REASON Referenced by route handler, useStreamingAnswer hook, and tests.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-003)

import { z } from 'zod';

// @MX:NOTE Attachment schema for Phase 4 file attach feature.
// Phase 2: attachments field is accepted but ignored.
const AttachmentSchema = z.object({
  fileId: z.string().uuid(),
});

export const ConsultRequestSchema = z.object({
  /** The user's question — 1 to 4000 characters. */
  question: z
    .string()
    .min(1, 'Question must be at least 1 character')
    .max(4000, 'Question must not exceed 4000 characters'),

  /** Existing conversation to append to. UUID format. */
  conversationId: z.string().uuid().optional(),

  /** Project context for the consultation. UUID format. */
  projectId: z.string().uuid().optional(),

  /** Source corpus filter. Defaults to 'all'. */
  sourceFilter: z.enum(['all', 'regs', 'internal']).default('all'),

  /** File attachments — Phase 4 feature, accepted but ignored in Phase 2. */
  attachments: z.array(AttachmentSchema).optional(),

  /** Response locale. Defaults to 'ko'. */
  locale: z.enum(['ko', 'en']).default('ko'),
});

export type ConsultRequest = z.infer<typeof ConsultRequestSchema>;
