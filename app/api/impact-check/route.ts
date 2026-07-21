// SPEC-V3-IMPACT-001 M7: API route for impact check wizard.
// @MX:ANCHOR [AUTO] Impact wizard API orchestrates 4-layer analysis.
// @MX:REASON Single entry point for impact assessment. fan_in >= 3 (UI, CLI, webhook).
// @MX:SPEC SPEC-V3-IMPACT-001 (AC-IMP-01..04, AC-IMP-09, AC-IMP-13)

import {
  calculateSignal,
  classifyChangeCategory,
  createImpactTicket,
  findSimilarCases,
  lookupRetestMatrix,
} from '@/lib/domains/impact';
import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Zod validation schema (AC-IMP-01..04: wizard input validation)
const ImpactCheckSchema = z.object({
  orgId: z.string(),
  productId: z.string(),
  changeType: z.enum(['bom', 'sw', 'sw-minor', 'label', 'warn', 'process', 'sterile']),
  markets: z.array(z.enum(['us', 'eu', 'kr', 'cn', 'jp'])),
  changeDetail: z.string().min(1).max(2000),
  assigneeId: z.string().optional(),
});

interface ImpactCheckResponse {
  matrix: Array<{ level: string; ref: string; note: string; market: string }>;
  signal: 'green' | 'yellow' | 'red';
  classification: {
    category: string;
    confidence: number;
    reason: string;
  };
  similarCases?: Array<{
    id: string;
    title: string;
    content: string;
    similarity: number;
  }>;
  ticketId?: string;
  recommendation: string;
}

// M10 RBAC: wrap POST with impact.self_check permission (AC-IMP-13).
export const POST = withPermission('impact.self_check', async (req, _ctx, session) => {
  try {
    // Parse and validate input
    const body = await req.json();
    const input = ImpactCheckSchema.parse(body);

    // Layer 1: Matrix lookup (loop over markets)
    const matrixResults = input.markets.map((market) =>
      lookupRetestMatrix(input.changeType, market),
    );

    // Layer 2: LLM classification
    const classification = await classifyChangeCategory(input.changeDetail);

    // Signal calculation (uses classification confidence)
    const signal = calculateSignal(matrixResults, classification.confidence * 100);

    // AC-IMP-12: 21 CFR Part 11 audit log for impact check execution.
    await writeAudit({
      actor_id: session?.user?.id ?? null,
      action: 'impact.check',
      resource_type: 'impact_assessment',
      resource_id: input.productId,
      meta_json: {
        org_id: input.orgId,
        change_type: input.changeType,
        markets: input.markets.join(','),
        signal,
        confidence: classification.confidence,
      },
    });

    const response: ImpactCheckResponse = {
      matrix: matrixResults.map((cell, index) => ({
        level: cell.level,
        ref: cell.ref,
        note: cell.note,
        market: input.markets[index] || '',
      })),
      signal,
      classification,
      recommendation: '',
    };

    if (classification.confidence >= 0.8) {
      // High confidence → Layer 4: RAG similar cases
      const similarCases = await findSimilarCases({
        productId: input.productId,
        changeType: input.changeType,
        changeDetail: input.changeDetail,
      });

      response.similarCases = similarCases.cases;
      response.recommendation = 'high-confidence-auto-approve';
    } else {
      // Low confidence → Layer 3: Create ticket
      if (input.assigneeId) {
        const ticketId = await createImpactTicket(db, {
          orgId: input.orgId,
          title: `Impact review needed: ${input.changeType}`,
          description: input.changeDetail,
          priority: signal === 'red' ? 'critical' : 'high',
          assigneeId: input.assigneeId,
          productId: input.productId,
          signal,
          classification,
        });

        response.ticketId = ticketId;
      }
      response.recommendation = 'low-confidence-manual-review';
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
