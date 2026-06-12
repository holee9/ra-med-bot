// @MX:ANCHOR [AUTO] SSE Route Handler — POST /api/ra/vigilance
// @MX:REASON Entry point for the vigilance reporting pipeline: assess → draft → persist → audit.
// @MX:SPEC SPEC-REGULA-VIGILANCE-001 (REQ-VIG-001~024)

export const runtime = 'nodejs';

import { withPermission } from '@/lib/auth/with-permission';
import type { AuthSession } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { adverseEvents, reportabilityAssessments, vigilanceReports } from '@/lib/db/schema';
import {
  auditReportDrafted,
  auditReportabilityAssessed,
  auditVigilanceEventCreated,
} from '@/lib/vigilance/audit';
import { assessReportability } from '@/lib/vigilance/reportability-engine';
import type { AdverseEventInput } from '@/lib/vigilance/reportability-engine';
import { generateReportDraft } from '@/lib/vigilance/report-generator';
import type { ReportType } from '@/lib/vigilance/report-generator';
import { z } from 'zod';

// Zod validation schema for incoming adverse event data
const AdverseEventSchema = z.object({
  eventDescription: z.string().min(10, 'Event description must be at least 10 characters'),
  patientOutcome: z.enum(['death', 'serious_injury', 'malfunction', 'no_injury', 'other']),
  deviceCategory: z.enum(['class_I', 'class_II', 'class_III', 'IIa', 'IIb', 'III']),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'eventDate must be YYYY-MM-DD'),
  awarenessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'awarenessDate must be YYYY-MM-DD'),
  isManufacturerAware: z.boolean(),
});

const RequestSchema = z.object({
  adverseEventData: z.object({
    eventDescription: z.string().min(10),
    patientOutcome: z.enum(['death', 'serious_injury', 'malfunction', 'no_injury', 'other']),
    deviceCategory: z.enum(['class_I', 'class_II', 'class_III', 'IIa', 'IIb', 'III']),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    awarenessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isManufacturerAware: z.boolean(),
    // Additional DB fields passed alongside the engine input
    deviceName: z.string().min(1),
    deviceModel: z.string().optional(),
    lotNumber: z.string().optional(),
    reporterName: z.string().min(1),
    reporterRole: z.string().min(1),
  }),
  workflowRunId: z.string().uuid().optional(),
});

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function sseChunk(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function postVigilance(request: Request, session: AuthSession): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { adverseEventData, workflowRunId } = parsed.data;

  const engineInput: AdverseEventInput = {
    eventDescription: adverseEventData.eventDescription,
    patientOutcome: adverseEventData.patientOutcome,
    deviceCategory: adverseEventData.deviceCategory,
    eventDate: adverseEventData.eventDate,
    awarenessDate: adverseEventData.awarenessDate,
    isManufacturerAware: adverseEventData.isManufacturerAware,
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function push(event: string, data: unknown): void {
        controller.enqueue(encoder.encode(sseChunk(event, data)));
      }

      try {
        // Step 1: Deterministic reportability assessment (no AI)
        const decision = assessReportability(engineInput);
        push('assessment', { decision });

        // Step 2: Persist adverse event record
        const [eventRecord] = await db
          .insert(adverseEvents)
          .values({
            workflowRunId: workflowRunId ?? null,
            eventDate: adverseEventData.eventDate,
            deviceName: adverseEventData.deviceName,
            deviceModel: adverseEventData.deviceModel ?? null,
            lotNumber: adverseEventData.lotNumber ?? null,
            eventDescription: adverseEventData.eventDescription,
            patientOutcome: adverseEventData.patientOutcome,
            awarenessDate: adverseEventData.awarenessDate,
            reporterName: adverseEventData.reporterName,
            reporterRole: adverseEventData.reporterRole,
            createdBy: session.user.id,
          })
          .returning();

        if (!eventRecord) {
          push('error', { message: 'Failed to persist adverse event record' });
          controller.close();
          return;
        }

        // Persist reportability assessment
        await db.insert(reportabilityAssessments).values({
          adverseEventId: eventRecord.id,
          fdaMdrRequired: decision.fdaMdrRequired,
          fdaMdrDeadlineDays: decision.fdaMdrDeadlineDays,
          euMdvRequired: decision.euMdvRequired,
          euMdvDeadlineDays: decision.euMdvDeadlineDays,
          fscaRequired: decision.fscaRequired,
          assessmentRationale: decision.rationale,
          assessedByAi: true,
        });

        // Audit adverse event creation and assessment
        await auditVigilanceEventCreated({
          userId: session.user.id,
          adverseEventId: eventRecord.id,
          deviceName: adverseEventData.deviceName,
        });
        await auditReportabilityAssessed({
          userId: session.user.id,
          adverseEventId: eventRecord.id,
          fdaRequired: decision.fdaMdrRequired,
          euRequired: decision.euMdvRequired,
        });

        // Step 3: Generate AI report drafts for each applicable pathway
        const reportTypes: ReportType[] = [];
        if (decision.fdaMdrRequired) reportTypes.push('fda_mdr');
        if (decision.euMdvRequired) reportTypes.push('eu_mdv');
        if (decision.fscaRequired) reportTypes.push('fsca');

        const savedReportIds: Record<ReportType, string> = {} as Record<ReportType, string>;

        for (const reportType of reportTypes) {
          const draft = await generateReportDraft(engineInput, decision, reportType);

          const [reportRecord] = await db
            .insert(vigilanceReports)
            .values({
              adverseEventId: eventRecord.id,
              reportType: draft.reportType,
              reportFormat: draft.reportFormat,
              draftContent: draft.draftContent,
              submissionDeadline: draft.submissionDeadline,
            })
            .returning();

          if (reportRecord) {
            savedReportIds[reportType] = reportRecord.id;
            await auditReportDrafted({
              userId: session.user.id,
              reportId: reportRecord.id,
              reportType: draft.reportType,
            });
          }

          // SSE event names: draft_fda, draft_eu, draft_fsca
          const eventName = `draft_${reportType.replace('_mdr', '').replace('_mdv', '')}` as const;
          push(eventName, {
            reportType: draft.reportType,
            reportFormat: draft.reportFormat,
            draftContent: draft.draftContent,
            submissionDeadline: draft.submissionDeadline,
            reportId: reportRecord?.id ?? null,
          });
        }

        // Step 4: Final done event
        push('done', {
          eventId: eventRecord.id,
          reportIds: savedReportIds,
          reportTypesGenerated: reportTypes,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        push('error', { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

export const POST = withPermission('workflow.execute', async (request, _ctx, session) =>
  postVigilance(request, session),
);
