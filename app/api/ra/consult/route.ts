// @MX:ANCHOR [AUTO] SSE Route Handler — POST /api/ra/consult
// @MX:REASON Only entry point for the consult streaming pipeline.
// Handles RBAC via withPermission, rate-limit, Zod validation, SSE headers, and error wrapping.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-001..010, REQ-CHAT-053..055)

// REQ-LAUNCH-038: nodejs runtime required for pgvector (pg driver not compatible with edge runtime)
export const runtime = 'nodejs';

import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/observability/logger';
import type { Session } from 'next-auth';
import type { NextRequest } from 'next/server';
import { consult, ensureConversation } from '../../../../lib/ai/consult';
import { encodeSSE } from '../../../../lib/ai/streaming';
import { writeAudit } from '../../../../lib/kernel/audit';
import { withPermission } from '../../../../lib/kernel/auth/with-permission';
import { db } from '../../../../lib/kernel/db/client';
import { messages } from '../../../../lib/kernel/db/schema';
import { ConsultRequestSchema } from '../../../../types/consult';
import type { StreamEvent } from '../../../../types/streaming';

// E2E_TEST_MODE: deterministic fake SSE stream — no LLM calls.
// Yields real conversationId/messageId so expert-review FK constraints are satisfied.
async function* e2eTestEvents(
  query: string,
  conversationId: string,
  messageId: string,
): AsyncGenerator<StreamEvent, void, unknown> {
  const isLowConf = query.trim() === '__test:low_confidence__';
  const isCitationTest = query.trim() === '__test:citation_response__';

  yield { type: 'meta', conversationId, messageId };
  const text = isLowConf
    ? 'Test response with low confidence score for expert review.'
    : 'This is a test regulatory response. EU MDR Article 10 requires establishing a quality management system.';

  for (const word of text.split(' ')) {
    yield { type: 'prose_delta', delta: `${word} ` };
  }

  yield {
    type: 'confidence',
    level: isLowConf ? 'low' : 'high',
    score: isLowConf ? 0.3 : 0.9,
    breakdown: isLowConf
      ? { citationCoverage: 0.38, sourceAgreement: 0.45, sourceRecency: 0.6, retrievalScore: 0.52 }
      : { citationCoverage: 0.92, sourceAgreement: 0.88, sourceRecency: 0.8, retrievalScore: 0.94 },
  };

  if (isLowConf) {
    yield { type: 'expert_review_required', reason: 'Low confidence score below threshold' };
  } else if (isCitationTest) {
    yield {
      type: 'sources',
      items: [
        {
          id: 'test-src-1',
          citeIndex: 1,
          orgLabel: 'EU MDR',
          title: 'Regulation (EU) 2017/745',
          year: 2017,
          type: 'Regulation' as const,
          url: null,
          anchor: 'Article 10',
          offset: 0,
        },
        {
          id: 'test-src-2',
          citeIndex: 2,
          orgLabel: 'FDA 21 CFR',
          title: '21 CFR Part 820',
          year: 2022,
          type: 'Regulation' as const,
          url: null,
          anchor: '820.30',
          offset: 0,
        },
      ],
    };
  } else {
    yield {
      type: 'sources',
      items: [
        {
          id: 'test-src-1',
          citeIndex: 1,
          orgLabel: 'EU MDR',
          title: 'Regulation (EU) 2017/745',
          year: 2017,
          type: 'Regulation' as const,
          url: null,
          anchor: 'Article 10',
          offset: 0,
        },
      ],
    };
  }
}

// REQ-CHAT-007 — in-memory token bucket, 30 req / 60 s per user.
// @MX:WARN [AUTO] In-Memory Rate Limiter — State Loss on Restart
// @MX:REASON [AUTO] Map-based rate limiter loses all state on server restart/deployment,
// potentially allowing rate limit bypass in distributed environments. For production
// REQ-CHAT-007 compliance, migrate to Redis-based distributed rate limiter with:
// - Redis INCR + EXPIRE for atomic token bucket operations
// - Shared state across multiple server instances
// - Persistent rate limit enforcement across deployments
// Current implementation acceptable for single-instance development/staging only.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// SSE headers per REQ-CHAT-004.
const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/* audit-check-ignore: consult() writes llm.call, source.access, and expert review audit rows. */
export const POST = withPermission('consult.create', async (req, _ctx, session) => {
  const nextReq = req as NextRequest;

  // REQ-CHAT-007 — rate limit.
  if (!checkRateLimit(session.user.id)) {
    return new Response('Too Many Requests', { status: 429 });
  }

  // REQ-CHAT-003 — Zod body validation.
  let body: unknown;
  try {
    body = await nextReq.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = ConsultRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Validation failed', issues: parsed.error.issues }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const input = parsed.data;
  const messageId = randomUUID();
  const conversationId = await ensureConversation(
    input.conversationId,
    session.user.id,
    input.projectId,
  );

  const startTs = Date.now();

  // REQ-CHAT-010 — abort on client disconnect.
  const { signal } = nextReq;

  // consult() expects the Auth.js Session type. AuthSession is structurally
  // compatible but missing the `expires` field. Cast via unknown to satisfy the
  // type checker without altering runtime behavior.
  const authJsSession = session as unknown as Session;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function push(ev: StreamEvent): void {
        controller.enqueue(encoder.encode(encodeSSE(ev)));
      }

      const isE2EMode =
        process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
      let e2eAuditWritten = false;

      if (isE2EMode) {
        // Create real message/audit rows up front so E2E clients that close the
        // SSE stream early still exercise the audit contract deterministically.
        await db
          .insert(messages)
          .values({
            id: messageId,
            conversationId,
            role: 'assistant',
            contentProse: 'E2E test response.',
          })
          .onConflictDoNothing();
        await writeAudit({
          actor_id: session.user.id,
          action: 'chat.query',
          resource_type: 'message',
          resource_id: messageId,
          conversation_id: conversationId,
        });
        e2eAuditWritten = true;
      }

      const eventSource = isE2EMode
        ? e2eTestEvents(input.question, conversationId, messageId)
        : consult(input, authJsSession, messageId, conversationId, signal);

      try {
        for await (const ev of eventSource) {
          if (signal.aborted) break;
          push(ev);
        }
        // Write chat.query audit row after E2E stream completes (REQ-FND-048).
        if (isE2EMode && !signal.aborted && !e2eAuditWritten) {
          await writeAudit({
            actor_id: session.user.id,
            action: 'chat.query',
            resource_type: 'message',
            resource_id: messageId,
            conversation_id: conversationId,
          });
        }
      } catch (err) {
        // REQ-CHAT-008 — safe error event.
        logger.error('[consult] pipeline error:', err);
        const code =
          err instanceof Error && err.message.includes('rate') ? 'rate_limit' : 'llm_failure';
        push({
          type: 'error',
          code,
          message: 'Internal error. Please try again.',
        });
      } finally {
        // REQ-CHAT-009 — done event as last event.
        if (!signal.aborted) {
          push({ type: 'done', duration_ms: Date.now() - startTs });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
});

// REQ-CHAT-001 — GET/PUT/DELETE return 405.
export function GET(): Response {
  return new Response('Method Not Allowed', { status: 405 });
}
