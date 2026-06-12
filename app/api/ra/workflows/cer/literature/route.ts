// @MX:ANCHOR [AUTO] Literature Search Route — POST /api/ra/workflows/cer/literature
// @MX:REASON SSE streaming entry point for the PICO→search→screen→synthesize pipeline.
// @MX:SPEC REQ-CLINLIT-001~025

export const runtime = 'nodejs';

import { withPermission } from '@/lib/auth/with-permission';
import { formatVancouver } from '@/lib/cer/citation-formatter';
import { synthesizeEvidence } from '@/lib/cer/evidence-synthesis';
import { appraiseEvidence } from '@/lib/cer/literature-appraisal';
import { generatePicoQuery } from '@/lib/cer/pico-generator';
import { searchPubMed } from '@/lib/cer/pubmed-client';
import { screenArticles } from '@/lib/cer/screening-pipeline';
import { db } from '@/lib/db/client';
import { evidenceSyntheses, literatureReferences, literatureSearches } from '@/lib/db/schema';
import { z } from 'zod';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

const LiteratureSearchInputSchema = z.object({
  cerRunId: z.string().uuid(),
  deviceDescription: z.string().min(10).max(2000),
});

function sseEvent(event: string, data: unknown): string {
  return `data: ${JSON.stringify({ event, data })}\n\n`;
}

export const POST = withPermission('consult.create', async (req, _ctx, _session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = LiteratureSearchInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { cerRunId, deviceDescription } = parsed.data;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const push = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));

      try {
        // Step 1: Generate PICO framework.
        const pico = await generatePicoQuery(deviceDescription);
        push('pico', { pico });

        // Step 2: Search PubMed.
        const articles = await searchPubMed(pico.searchQuery, 50);
        push('search', { count: articles.length, query: pico.searchQuery });

        if (articles.length === 0) {
          push('done', { searchId: null, message: 'No articles found for this query.' });
          controller.close();
          return;
        }

        // Step 3: Screen articles by title/abstract.
        const screeningResults = await screenArticles(articles, pico, deviceDescription);
        const includedPmids = new Set(
          screeningResults.filter((r) => r.decision === 'include').map((r) => r.pmid),
        );
        push('screening', {
          total: articles.length,
          included: includedPmids.size,
          excluded: screeningResults.filter((r) => r.decision === 'exclude').length,
          uncertain: screeningResults.filter((r) => r.decision === 'uncertain').length,
        });

        // Step 4: Appraise included articles (deterministic SIGN 50 / GRADE).
        const includedArticles = articles.filter((a) => includedPmids.has(a.pmid));
        const appraisedArticles = includedArticles.map((article) => {
          const appraisal = appraiseEvidence(article);
          return {
            ...article,
            sign50Level: appraisal.sign50Level,
            gradeQuality: appraisal.gradeQuality,
            citation: formatVancouver(article),
          };
        });

        // Step 5: Synthesize evidence into CER sections.
        const synthesis = await synthesizeEvidence(appraisedArticles, deviceDescription, pico);
        push('synthesis', {
          gradeCounts: synthesis.gradeCounts,
          gradeSummary: synthesis.gradeSummary.slice(0, 200),
        });

        // Step 6: Persist to database.
        const screeningMap = new Map(screeningResults.map((r) => [r.pmid, r]));

        const [searchRow] = await db
          .insert(literatureSearches)
          .values({
            cerRunId,
            deviceDescription,
            picoPatient: pico.patient,
            picoIntervention: pico.intervention,
            picoComparator: pico.comparator,
            picoOutcome: pico.outcome,
            searchQuery: pico.searchQuery,
            meshTerms: pico.meshTerms,
            totalRecords: articles.length,
            afterDedup: articles.length,
            afterTitleAbstract: includedPmids.size,
            afterFullText: includedPmids.size,
            includedCount: includedPmids.size,
          })
          .returning({ id: literatureSearches.id });

        const searchId = searchRow?.id;
        if (!searchId) throw new Error('Failed to insert literature_searches row');

        if (articles.length > 0) {
          await db.insert(literatureReferences).values(
            articles.map((article) => {
              const screening = screeningMap.get(article.pmid);
              const appraised = appraisedArticles.find((a) => a.pmid === article.pmid);
              return {
                searchId,
                pmid: article.pmid,
                title: article.title,
                abstract: article.abstract ?? null,
                authors: article.authors,
                journal: article.journal,
                year: article.year,
                vancouverCitation: formatVancouver(article),
                sign50Level: appraised?.sign50Level ?? null,
                gradeQuality: appraised?.gradeQuality ?? null,
                screeningDecision: screening?.decision ?? 'pending',
                screeningReason: screening?.reason ?? null,
                included: includedPmids.has(article.pmid),
              };
            }),
          );
        }

        await db.insert(evidenceSyntheses).values({
          searchId,
          gradeSummary: synthesis.gradeSummary,
          narrativeSynthesis: synthesis.narrativeSynthesis,
          cerSection6Draft: synthesis.cerSection6Draft,
          cerSection7Draft: synthesis.cerSection7Draft,
          cerSection8Draft: synthesis.cerSection8Draft,
          highCount: synthesis.gradeCounts.high,
          moderateCount: synthesis.gradeCounts.moderate,
          lowCount: synthesis.gradeCounts.low,
          veryLowCount: synthesis.gradeCounts.veryLow,
        });

        push('done', {
          searchId,
          includedCount: includedPmids.size,
          totalCount: articles.length,
          cerSection6Draft: synthesis.cerSection6Draft,
          cerSection7Draft: synthesis.cerSection7Draft,
          cerSection8Draft: synthesis.cerSection8Draft,
        });
      } catch (err) {
        console.error('[literature/route] pipeline error:', err);
        push('error', { message: 'Literature search failed. Please try again.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
});

export function GET(): Response {
  return new Response('Method Not Allowed', { status: 405 });
}
