// @MX:SPEC SPEC-REGULA-CLASSIFY-001 (REQ-CLASSIFY-001, REQ-CLASSIFY-015)
import { withPermission } from '@/lib/auth/with-permission';
import type { AuthSession } from '@/lib/auth/with-permission';
import { writeAudit } from '@/lib/audit';
import { classifyDevice } from '@/lib/classification/classification-engine';
import { parseDeviceIntent } from '@/lib/classification/intent-parser';
import { db } from '@/lib/db/client';
import { deviceClassifications } from '@/lib/db/schema';
import { z } from 'zod';

const RequestSchema = z.object({
  deviceDescription: z.string().min(10).max(2000),
  deviceType: z
    .enum(['active', 'non_active', 'software_only', 'ivd', 'implantable'])
    .optional(),
  contactType: z
    .enum(['no_contact', 'external', 'internal', 'implant'])
    .optional(),
  hasSoftware: z.boolean().default(false),
  hasAiMl: z.boolean().default(false),
  isSterile: z.boolean().default(false),
});

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function postClassification(
  request: Request,
  session: AuthSession,
): Promise<Response> {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return new Response(JSON.stringify({ error: 'No organization' }), { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid input', details: parsed.error.format() }),
      { status: 400 },
    );
  }

  const { deviceDescription, hasSoftware, hasAiMl, isSterile } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            sse({ event: 'parsing', message: 'Analyzing device description...' }),
          ),
        );

        const parsedIntent = await parseDeviceIntent(deviceDescription);
        const deviceType = parsed.data.deviceType ?? parsedIntent.deviceType;
        const contactType = parsed.data.contactType ?? parsedIntent.contactType;

        controller.enqueue(
          encoder.encode(
            sse({
              event: 'classifying',
              message: 'Applying classification rules for 5 jurisdictions...',
            }),
          ),
        );

        const result = classifyDevice({
          deviceDescription,
          deviceType,
          contactType,
          hasSoftware: parsedIntent.hasSoftware || hasSoftware,
          hasAiMl: parsedIntent.hasAiMl || hasAiMl,
          isSterile: parsedIntent.isSterile || isSterile,
        });

        // Persist classification result
        const [saved] = await db
          .insert(deviceClassifications)
          .values({
            orgId,
            userId: session.user.id,
            deviceDescription,
            deviceType,
            contactType,
            hasSoftware: parsedIntent.hasSoftware || hasSoftware,
            hasAiMl: parsedIntent.hasAiMl || hasAiMl,
            isSterile: parsedIntent.isSterile || isSterile,
            fdaClass: result.fda.deviceClass,
            fdaPathway: result.fda.pathway,
            euClass: result.eu.deviceClass,
            euPathway: result.eu.pathway,
            euRule: result.eu.rule ?? null,
            mfdsClass: result.mfds.deviceClass,
            nmpaClass: result.nmpa.deviceClass,
            pmdaClass: result.pmda.deviceClass,
            classificationRationale: result as unknown as Record<string, unknown>,
          })
          .returning();

        await writeAudit({
          actor_id: session.user.id,
          action: 'device_classified',
          resource_type: 'device_classification',
          resource_id: saved?.id ?? 'unknown',
          meta_json: {
            classificationId: saved?.id,
            deviceType,
            fdaClass: result.fda.deviceClass,
            euClass: result.eu.deviceClass,
          },
        });

        controller.enqueue(
          encoder.encode(
            sse({ event: 'result', classification: result, classificationId: saved?.id }),
          ),
        );
        controller.enqueue(encoder.encode(sse({ event: 'done' })));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            sse({
              event: 'error',
              message: err instanceof Error ? err.message : 'Classification failed',
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export const POST = withPermission(
  'consult.create',
  async (request, _ctx, session) => postClassification(request, session),
);
