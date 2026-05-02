// @MX:ANCHOR SSE Route Handler — POST /api/ra/consult
// @MX:REASON Only entry point for the consult streaming pipeline.
// Handles auth, rate-limit, Zod validation, SSE headers, and error wrapping.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-001..010, REQ-CHAT-053..055)

import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { consult, ensureConversation } from '../../../../lib/ai/consult';
import { encodeSSE } from '../../../../lib/ai/streaming';
import { auth } from '../../../../lib/auth';
import { ConsultRequestSchema } from '../../../../types/consult';
import type { StreamEvent } from '../../../../types/streaming';

// REQ-CHAT-007 — in-memory token bucket, 30 req / 60 s per user.
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

export async function POST(req: NextRequest): Promise<Response> {
  // REQ-CHAT-002 — auth guard.
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  // REQ-CHAT-007 — rate limit.
  if (!checkRateLimit(session.user.id)) {
    return new Response('Too Many Requests', { status: 429 });
  }

  // REQ-CHAT-003 — Zod body validation.
  let body: unknown;
  try {
    body = await req.json();
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
  const { signal } = req;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let terminalEventEmitted = false;

      function push(ev: StreamEvent): void {
        if (ev.type === 'done' || ev.type === 'error') {
          terminalEventEmitted = true;
        }
        controller.enqueue(encoder.encode(encodeSSE(ev)));
      }

      try {
        for await (const ev of consult(input, session, messageId, conversationId, signal)) {
          if (signal.aborted) break;
          push(ev);
        }
      } catch (err) {
        // REQ-CHAT-008 — safe error event.
        console.error('[consult] pipeline error:', err);
        const code =
          err instanceof Error && err.message.includes('rate') ? 'rate_limit' : 'llm_failure';
        push({
          type: 'error',
          code,
          message: 'Internal error. Please try again.',
        });
      } finally {
        // REQ-CHAT-009 — done event as last event.
        if (!signal.aborted && !terminalEventEmitted) {
          push({ type: 'done', duration_ms: Date.now() - startTs });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// REQ-CHAT-001 — GET/PUT/DELETE return 405.
export function GET(): Response {
  return new Response('Method Not Allowed', { status: 405 });
}
