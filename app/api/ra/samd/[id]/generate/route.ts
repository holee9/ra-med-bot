// POST /api/ra/samd/[id]/generate — generate model card, checklist, monitoring plan via fast LLM.
// Streams SSE progress events; stores results in generated_* JSONB columns.
// @MX:ANCHOR [AUTO] SSE AI generation route for SaMD artifacts
// @MX:REASON External LLM call + DB write; fan_in >= 3 via wizard, re-generate button, API.
// @MX:SPEC SPEC-REGULA-SAMD-001

export const runtime = 'nodejs';

import { getLlmFastModel } from '@/lib/ai/llm-provider';
import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { samdAssessments } from '@/lib/db/schema';
import { generateText } from 'ai';
import { and, eq } from 'drizzle-orm';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function sseChunk(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const POST = withPermission('dashboard.view', async (_req, ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'Organization context required' }, { status: 400 });
  }

  const params = ctx.params ? await ctx.params : {};
  const id = (params as { id?: string }).id;
  if (!id) {
    return Response.json({ error: 'Missing assessment ID' }, { status: 400 });
  }

  const [assessment] = await db
    .select()
    .from(samdAssessments)
    .where(and(eq(samdAssessments.id, id), eq(samdAssessments.orgId, orgId)))
    .limit(1);

  if (!assessment) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseChunk(event, data)));
      };

      try {
        send('progress', { step: 'model_card', message: 'Generating AI/ML Model Card...' });

        // --- Model Card ---
        const modelCardResponse = await generateText({
          model: getLlmFastModel(),
          maxTokens: 1500,
          messages: [
            {
              role: 'user',
              content: `Generate an AI/ML Model Card for a SaMD (Software as a Medical Device) with the following characteristics:

Device: ${assessment.title}
Description: ${assessment.deviceDescription}
Intended Use: ${assessment.intendedUse}
AI/ML Type: ${assessment.aiMlType}
IMDRF Category: ${assessment.imdrfCategory}
FDA Pathway: ${assessment.fdaPathway}
EU AI Act Risk Level: ${assessment.euAiRiskLevel}

Return a JSON object with these fields:
{
  "name": "device name",
  "version": "1.0",
  "intended_use": "brief statement",
  "training_data_summary": "description of data requirements",
  "performance_metrics_placeholder": ["accuracy", "sensitivity", "specificity"],
  "known_limitations": ["limitation 1", "limitation 2"],
  "regulatory_basis": "FDA/EU regulatory basis statement"
}

Return only the JSON object, no markdown.`,
            },
          ],
        });

        let modelCard: unknown = null;
        const mcText = modelCardResponse.text?.trim() ?? '';
        if (mcText) {
          try {
            modelCard = JSON.parse(mcText);
          } catch {
            modelCard = { raw: mcText };
          }
        }

        send('progress', { step: 'checklist', message: 'Generating regulatory checklist...' });

        // --- Checklist ---
        const checklistResponse = await generateText({
          model: getLlmFastModel(),
          maxTokens: 2000,
          messages: [
            {
              role: 'user',
              content: `Generate a regulatory compliance checklist for a SaMD with:
- IMDRF Category: ${assessment.imdrfCategory}
- FDA Pathway: ${assessment.fdaPathway}
- EU AI Act Risk Level: ${assessment.euAiRiskLevel}
- AI/ML Type: ${assessment.aiMlType}

Return a JSON array of checklist items covering FDA AI/ML guidance, EU AI Act Annex IV, IMDRF N10/N12/N41:
[
  {
    "category": "FDA AI/ML",
    "item": "checklist item description",
    "required": true,
    "jurisdiction": "US"
  }
]

Include 10-15 key items. Return only the JSON array.`,
            },
          ],
        });

        let checklist: unknown = null;
        const clText = checklistResponse.text?.trim() ?? '';
        if (clText) {
          try {
            checklist = JSON.parse(clText);
          } catch {
            checklist = { raw: clText };
          }
        }

        send('progress', { step: 'monitoring_plan', message: 'Generating monitoring plan...' });

        // --- Monitoring Plan ---
        const monitoringResponse = await generateText({
          model: getLlmFastModel(),
          maxTokens: 1500,
          messages: [
            {
              role: 'user',
              content: `Generate a post-market monitoring plan for an AI/ML SaMD:
- Device: ${assessment.title}
- AI/ML Type: ${assessment.aiMlType}
- IMDRF Category: ${assessment.imdrfCategory}
- PCCP Required: ${assessment.pccpRequired}

Return a JSON object:
{
  "kpis": ["KPI 1", "KPI 2"],
  "drift_threshold": "description of acceptable drift threshold",
  "retraining_triggers": ["trigger 1", "trigger 2"],
  "reporting_frequency": "quarterly",
  "rwp_report_template": "Real-World Performance report structure description"
}

Return only the JSON object.`,
            },
          ],
        });

        let monitoringPlan: unknown = null;
        const mpText = monitoringResponse.text?.trim() ?? '';
        if (mpText) {
          try {
            monitoringPlan = JSON.parse(mpText);
          } catch {
            monitoringPlan = { raw: mpText };
          }
        }

        // Store results
        await db
          .update(samdAssessments)
          .set({
            generatedModelCard: modelCard as never,
            generatedChecklist: checklist as never,
            generatedMonitoringPlan: monitoringPlan as never,
            updatedAt: new Date(),
          })
          .where(and(eq(samdAssessments.id, id), eq(samdAssessments.orgId, orgId)));
        await writeAudit({
          actor_id: session.user.id,
          action: 'samd_assessment_updated',
          resource_type: 'samd_assessment',
          resource_id: id,
          meta_json: { generatedArtifacts: ['model_card', 'checklist', 'monitoring_plan'] },
        });

        send('done', {
          model_card: modelCard,
          checklist,
          monitoring_plan: monitoringPlan,
        });
      } catch (err) {
        send('error', {
          message: err instanceof Error ? err.message : 'Generation failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
});
