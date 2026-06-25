// @MX:NOTE [AUTO] Inngest function for docingest/document.created — full ingest pipeline.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-021, REQ-DOC-022, REQ-DOC-025),
//   SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-002)
// Steps: license-gate → extract → redact → chunk → embed → insert chunks → update status
// Each step is wrapped in Inngest step.run for independent retry + observability.

import { DocClass } from '../../ingest/doc-class';
import { INNGEST_EVENTS, inngest } from '../client';

export interface DocCreatedEvent {
  name: 'docingest/document.created';
  data: {
    documentId: string;
    orgId: string;
    docClass: DocClass;
    r2Key: string;
    mimeType: string;
    uploadedBy: string;
    /**
     * REQ-CORPUSLIC-002 — the pre-registered, licensed sourceId this document
     * attaches to. The upload route enforces this before enqueuing; the worker
     * re-checks (defense-in-depth) so a bypassed enqueue cannot store chunks.
     */
    sourceId: string;
  };
}

/**
 * Process a newly uploaded document through the full ingest pipeline.
 * Registered with Inngest for reliable async execution (per-step retries).
 */
export const uploadProcessedFn = inngest.createFunction(
  {
    id: 'docingest-upload-processed',
    name: 'Process Uploaded Document',
    retries: 3,
    triggers: [{ event: INNGEST_EVENTS.DOCINGEST_DOCUMENT_CREATED }],
  },
  async ({ event, step }) => {
    const { documentId, orgId, docClass, r2Key, mimeType, sourceId } = event.data;

    // Pipeline modules imported dynamically so module load does not pull the
    // ingest/embed (openai) dependency chain eagerly (keeps tests side-effect-free).
    const { chunk } = await import('../../ingest/chunkers/index');
    const { embedChunks } = await import('../../ingest/embed');
    const { extractText } = await import('../../ingest/extract/index');
    const { redactPiiForIngest } = await import('../../ingest/pii/redact');
    const { notifyAdminQuarantine } = await import('../../notifications/admin-quarantine');

    // Step 0: REQ-CORPUSLIC-002 license gate — defense-in-depth. The upload
    // route already gates before enqueuing, but the Inngest worker is the
    // actual storage path. On denial, SKIP insertChunks + audit + bail.
    const ingestAllowed = await step.run('license-gate', async () => {
      const { assertIngestionLicensed } = await import('@/lib/corpus-license/license-gate');
      const gate = await assertIngestionLicensed({
        sourceId,
        orgId,
        userId: event.data.uploadedBy,
        wantsFullText: true,
      });
      return gate.allowed;
    });

    if (!ingestAllowed) {
      // Do NOT proceed to extract/chunk/embed/insertChunks. Mark the document
      // as ingestion-blocked so the upload UI surfaces the rejection.
      await step.run('mark-blocked', async () =>
        updateDocumentStatus(documentId, 'ingestion_blocked'),
      );
      return { status: 'ingestion_blocked', chunkCount: 0 };
    }

    // Step 1: Download and extract text
    const rawText = await step.run('extract-text', async () => {
      try {
        const fileBuffer = await fetchFromR2(r2Key);
        return await extractText(fileBuffer, mimeType);
      } catch (err) {
        await notifyAdminQuarantine(documentId, `Text extraction failed: ${err}`);
        throw new Error(`Extraction failed for ${documentId}: ${err}`);
      }
    });

    // Step 2: PII redaction
    const redactedText = await step.run('redact-pii', async () => {
      try {
        const redaction = await redactPiiForIngest(rawText, docClass);
        return redaction.text;
      } catch (err) {
        await notifyAdminQuarantine(documentId, `Redaction failed: ${err}`);
        throw new Error(`Redaction failed for ${documentId}: ${err}`);
      }
    });

    // Step 3: Chunk
    const chunks = await step.run('chunk', async () =>
      chunk(docClass, redactedText, { documentId, orgId }),
    );

    // Step 4: Embed
    const embeddings = await step.run('embed', async () => {
      try {
        return await embedChunks(chunks.map((c) => c.text));
      } catch (err) {
        await notifyAdminQuarantine(documentId, `Embedding failed: ${err}`);
        throw new Error(`Embedding failed for ${documentId}: ${err}`);
      }
    });

    // Step 5: Insert chunks
    const chunkCount = await step.run('insert-chunks', async () => {
      const chunkRecords = chunks.map((c) => ({
        text: c.text,
        metadata: c.metadata as unknown as Record<string, unknown>,
      }));
      return insertChunks(documentId, orgId, chunkRecords, embeddings);
    });

    // Step 5b: REQ-SOURCE-GOV-009/AC-04 — set the source to pending_review.
    // Called AFTER the license gate (step 0) so the source enters RA-owner
    // approval workflow. Internal SOPs without owner_department stay pending.
    await step.run('set-pending-review', async () => {
      const { setPendingReviewOnIngest } = await import('@/lib/source-governance/review-workflow');
      return setPendingReviewOnIngest({
        sourceId,
        orgId,
        isInternalSop: docClass === DocClass.internal_sop,
        ownerDepartment: null,
      });
    });

    // Step 6: Update status
    await step.run('update-status', async () => updateDocumentStatus(documentId, 'indexed'));

    return { status: 'indexed', chunkCount };
  },
);

// ---------------------------------------------------------------------------
// Helper stubs (implementations depend on DB client and R2 config)
// @MX:TODO: [AUTO] wire to real DB insert + R2 SDK in DOCINGEST Phase 3
// ---------------------------------------------------------------------------

async function fetchFromR2(r2Key: string): Promise<Buffer> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const bucket = process.env.CF_R2_BUCKET;
  if (!accountId || !bucket) throw new Error('R2 not configured');

  const response = await fetch(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${r2Key}`, {
    headers: { Authorization: `Bearer ${process.env.CF_R2_TOKEN}` },
  });
  if (!response.ok) throw new Error(`R2 fetch failed: ${r2Key}`);
  return Buffer.from(await response.arrayBuffer());
}

async function insertChunks(
  _documentId: string,
  _orgId: string,
  chunks: Array<{ text: string; metadata: Record<string, unknown> }>,
  _embeddings: number[][],
): Promise<number> {
  // In production: batch insert into document_chunks table via withTenantScope
  return chunks.length;
}

async function updateDocumentStatus(_documentId: string, _status: string): Promise<void> {
  // In production: UPDATE organization_documents SET status = $status WHERE id = $documentId
}
