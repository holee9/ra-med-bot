// @MX:ANCHOR [AUTO] Refine Route — POST /api/ra/refine
// @MX:REASON Entry point for inline answer refinement with tone presets.
// @MX:SPEC SPEC-REGULA-ANSWER-REFINE-001 (REQ-ANSWER-REFINE-001..004)
export const runtime = 'nodejs';

import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { isAnswerLocked } from '@/lib/signature/lock';
import { z } from 'zod';

export const TONE_LABELS: Record<string, string> = {
  conservative: '보수적 / 안전 우선',
  'regulatory-strict': '규제 엄격',
  'executive-summary': '경영 요약',
  'technical-detail': '기술 상세',
};

const RefineSchema = z.object({
  messageId: z.string().min(1),
  conversationId: z.string().min(1),
  blockContent: z.string().min(1).max(20_000),
  tone: z.enum(['conservative', 'regulatory-strict', 'executive-summary', 'technical-detail']),
  customNote: z.string().max(500).optional(),
});

const TONE_INSTRUCTIONS: Record<string, string> = {
  conservative:
    'Rewrite the following regulatory answer using a conservative, safety-first tone. Emphasize risk mitigation, regulatory conservatism, and cautious language.',
  'regulatory-strict':
    'Rewrite using strict regulatory language aligned with FDA and EU MDR requirements. Use precise regulatory terminology and cite specific article numbers where applicable.',
  'executive-summary':
    'Rewrite as a concise executive summary. Lead with the key decision, omit technical detail, and close with the recommended action.',
  'technical-detail':
    'Rewrite with full technical depth. Include method rationale, specific standard requirements, and detailed implementation guidance.',
};

export const POST = withPermission('consult.create', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RefineSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { messageId, conversationId, blockContent, tone, customNote } = parsed.data;

  // REQ-ESIG-003: Reject refinement on signed (locked) answers (§11.70)
  const locked = await isAnswerLocked(messageId, db);
  if (locked) {
    return Response.json({ error: 'answer_locked' }, { status: 403 });
  }

  // E2E_TEST_MODE: return deterministic refined content without LLM call.
  const isE2EMode = process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
  if (isE2EMode) {
    const toneLabel = TONE_LABELS[tone] ?? tone;
    const refined = `[${toneLabel} 톤으로 정제됨] ${blockContent.slice(0, 200)}`;
    return Response.json({
      refined,
      tone,
      sourceMessageId: messageId,
    });
  }

  // Production: delegate to LLM via configured provider.
  const { getLlmModel } = await import('@/lib/ai/llm-provider');
  const { generateText } = await import('ai');
  const model = getLlmModel();

  const instruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.conservative;
  const noteClause = customNote ? `\n\nAdditional context: ${customNote}` : '';
  const prompt = `${instruction}${noteClause}\n\nOriginal content:\n${blockContent}\n\nRefined version:`;

  const result = await generateText({ model, prompt });
  const refined = result.text ?? blockContent;

  // Append immutable audit record.
  try {
    await writeAudit({
      action: 'answer.refine',
      actor_id: session.user.id,
      resource_type: 'message',
      resource_id: messageId,
      conversation_id: conversationId,
      meta_json: {
        tone,
        customNote,
        originalLength: blockContent.length,
        refinedLength: refined.length,
      },
    });
  } catch {
    // Audit failure does NOT block the response (fail-open for user experience).
  }

  return Response.json({
    refined,
    tone,
    sourceMessageId: messageId,
  });
});

export function GET(): Response {
  return new Response('Method Not Allowed', { status: 405 });
}
