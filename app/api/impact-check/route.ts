// SPEC-V3-IMPACT-001 M7: API route for impact check wizard.
// @MX:ANCHOR [AUTO] Impact wizard API orchestrates 4-layer analysis.
// @MX:REASON Single entry point for impact assessment. fan_in >= 3 (UI, CLI, webhook).
// @MX:SPEC SPEC-V3-IMPACT-001 (AC-IMP-01..04, AC-IMP-09)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import {
  lookupRetestMatrix,
  calculateSignal,
  classifyChangeCategory,
  createImpactTicket,
  findSimilarCases,
} from '@/lib/domains/impact';

// Zod validation schema
const ImpactCheckSchema = z.object({
  orgId: z.string(),
  productId: z.string(),
  changeType: z.enum(['bom', 'sw', 'sw-minor', 'label', 'warn', 'process', 'sterile']),
  markets: z.array(z.enum(['us', 'eu', 'kr', 'cn', 'jp'])),
  changeDetail: z.string().min(1).max(2000),
  assigneeId: z.string().optional(),
});

type ImpactCheckInput = z.infer<typeof ImpactCheckSchema>;

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

export async function POST(req: NextRequest) {
  try {
    // Parse and validate input
    const body = await req.json();
    const input = ImpactCheckSchema.parse(body);

    // Layer 1: Matrix lookup (loop over markets)
    const matrixResults = input.markets.map(market =>
      lookupRetestMatrix(input.changeType, market),
    );

    // Layer 2: LLM classification
    const classification = await classifyChangeCategory(input.changeDetail);

    // Layer 1: Signal calculation (uses classification confidence)
    const signal = calculateSignal(matrixResults, classification.confidence * 100);

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
}
