import { withPermission } from '@/lib/auth/with-permission';
import type { AuthSession } from '@/lib/auth/with-permission';
import { auditCerCreated, auditCerLiteratureSearch } from '@/lib/cer/audit';
import { assembleCer } from '@/lib/cer/cer-assembler';
import { formatVancouver } from '@/lib/cer/citation-formatter';
import { type AppraisalResult, appraiseEvidence } from '@/lib/cer/literature-appraisal';
import type { CerStageId } from '@/lib/cer/meddev-stages';
import { searchPubMed } from '@/lib/cer/pubmed-client';
import { CerInputSchema } from '@/lib/workflows/types';

// REQ-CER-016: literature search retrieves >=50 abstracts per query.
const LITERATURE_MAX_RESULTS = 50;

async function postCer(request: Request, session: AuthSession): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid input', details: {} }, { status: 400 });
  }

  const result = CerInputSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Invalid input', details: result.error.format() },
      { status: 400 },
    );
  }

  const data = result.data;
  const runId = crypto.randomUUID();

  // REQ-CER-036: record CER creation before any external work.
  await auditCerCreated(session.user.id, runId);

  // REQ-CER-016~022: fetch and appraise literature.
  const articles = await searchPubMed(data.pubmedQuery, LITERATURE_MAX_RESULTS);
  const literature = articles.map((article) => {
    const appraisal: AppraisalResult = appraiseEvidence(article);
    return {
      ...article,
      citation: formatVancouver(article),
      appraisal,
    };
  });

  // REQ-CER-040: audit the literature search (query text NOT persisted).
  await auditCerLiteratureSearch(session.user.id, runId, data.pubmedQuery, articles.length);

  // Assemble the initial CerDocument. No stage content is authored yet, so all
  // 10 MEDDEV stages are emitted empty/incomplete (REQ-CER-031).
  const cerDocument = assembleCer({
    cerRunId: runId,
    deviceName: data.deviceName,
    manufacturer: data.manufacturer,
    stageContent: new Map<CerStageId, string>(),
    literature: articles,
  });

  return Response.json(
    {
      runId,
      workflowType: 'cer',
      status: 'queued',
      cerDocument,
      literature,
      literatureCount: articles.length,
      queuedAt: new Date().toISOString(),
    },
    { status: 202 },
  );
}

export const POST = withPermission('consult.create', async (request, _ctx, session) =>
  postCer(request, session),
);
