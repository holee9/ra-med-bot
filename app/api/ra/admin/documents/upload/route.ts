// @MX:ANCHOR [AUTO] Admin document upload — synchronous ingest pipeline endpoint.
// @MX:REASON Public API boundary. Wires UI form → extract → chunk → embed →
// sources/source_sections insert. fan_in will reach >=3 (UI form, integration
// test, and ingestion regression suite).
// @MX:SPEC SPEC-REGULA-QUALITY-001 (REQ-QUAL-015..019)
//
// Flow:
//   1. RBAC: sources.ingest (admin, org-scoped) via withPermission
//   2. Validate multipart payload (file + docClass)
//   3. Reject oversize / unsupported MIME (REQ-QUAL-019)
//   4. extractText -> chunk(docClass) -> embedChunks (PII guard inside embed)
//   5. Insert sources + sourceSections in a single transaction
//   6. Audit document.upload + document.chunk
//
// The Inngest async path (lib/inngest/docingest/upload-processed.ts) is the
// long-running background variant for R2-uploaded files; this synchronous
// route handles the in-app admin form which receives the file directly.

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { sourceSections, sources } from '@/lib/db/schema';
import { chunk } from '@/lib/ingest/chunkers';
import { DocClass } from '@/lib/ingest/doc-class';
import { embedChunks } from '@/lib/ingest/embed';
import { SUPPORTED_MIME_TYPES, extractText } from '@/lib/ingest/extract';
import { z } from 'zod';

// REQ-QUAL-019 — configurable size cap (default 10MB to match handoff §16).
const MAX_UPLOAD_BYTES = (() => {
  const raw = process.env.UPLOAD_MAX_BYTES;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 1024 * 1024;
})();

// Test fixtures use text/plain so the integration test can exercise the path
// without depending on a real PDF parser. Production callers stick with the
// extractor-supported set from lib/ingest/extract/index.ts.
const ALLOWED_MIME_TYPES = new Set<string>([...SUPPORTED_MIME_TYPES, 'text/plain']);

const DocClassSchema = z.nativeEnum(DocClass);

interface UploadSuccess {
  sourceId: string;
  sectionCount: number;
}

export const POST = withPermission('sources.ingest', async (req, _ctx, session) => {
  // ---------------------------------------------------------------------
  // 1. Parse multipart payload.
  // ---------------------------------------------------------------------
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'invalid_multipart' }, { status: 400 });
  }

  const file = form.get('file');
  const docClassRaw = form.get('docClass');
  const titleOverride = form.get('title');

  if (!(file instanceof File)) {
    return Response.json({ error: 'file_missing' }, { status: 400 });
  }

  const parsedClass = DocClassSchema.safeParse(docClassRaw);
  if (!parsedClass.success) {
    return Response.json({ error: 'docClass_invalid' }, { status: 400 });
  }
  const docClass = parsedClass.data;

  // ---------------------------------------------------------------------
  // 2. REQ-QUAL-019 — input validation (size + MIME).
  // ---------------------------------------------------------------------
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      {
        error: 'file_too_large',
        max_bytes: MAX_UPLOAD_BYTES,
        actual_bytes: file.size,
      },
      { status: 413 },
    );
  }

  const mimeType = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return Response.json({ error: 'unsupported_mime', mime_type: mimeType }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // ---------------------------------------------------------------------
  // 3. Extract text.
  // ---------------------------------------------------------------------
  let rawText: string;
  try {
    rawText =
      mimeType === 'text/plain' ? buffer.toString('utf8') : await extractText(buffer, mimeType);
  } catch (err) {
    return Response.json(
      { error: 'extract_failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 422 },
    );
  }

  if (rawText.trim().length === 0) {
    return Response.json({ error: 'empty_document' }, { status: 422 });
  }

  // ---------------------------------------------------------------------
  // 4. Chunk + embed.
  //    NOTE: PII redaction layers (regex/Workers AI/Presidio) live in the
  //    Inngest async pipeline. The admin sync upload relies on the
  //    embed-time PII guard (lib/ingest/embed.ts) as defense-in-depth and
  //    fails closed if SSN/email patterns leak through.
  //    @MX:TODO [AUTO] Hook redaction layers from upload-processed.ts into
  //    this sync path once they are extracted into a reusable module.
  // ---------------------------------------------------------------------
  const orgId = session.user.organizationId ?? '';
  const chunks = chunk(docClass, rawText, { orgId, uploadedBy: session.user.id });
  if (chunks.length === 0) {
    return Response.json({ error: 'chunking_produced_empty' }, { status: 422 });
  }

  const chunkTexts = chunks.map((c) => c.text);
  let embeddings: number[][];
  try {
    embeddings = await embedChunks(chunkTexts);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    const isPii = message.startsWith('PII guard triggered');
    return Response.json(
      { error: isPii ? 'pii_detected' : 'embedding_failed', detail: message },
      { status: isPii ? 422 : 502 },
    );
  }

  // ---------------------------------------------------------------------
  // 5. Persist sources + source_sections in a single transaction so a
  //    partial failure cannot leave orphan sources rows.
  // ---------------------------------------------------------------------
  const title =
    typeof titleOverride === 'string' && titleOverride.trim().length > 0
      ? titleOverride.trim()
      : file.name;

  const result: UploadSuccess = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(sources)
      .values({
        organizationId: session.user.organizationId ?? null,
        orgLabel: 'Internal',
        title,
        type: 'Internal',
        region: null,
        url: null,
      })
      .returning({ id: sources.id });

    const row = inserted[0];
    if (!row) throw new Error('source_insert_failed');

    const sectionRows = chunks.map((c, idx) => ({
      sourceId: row.id,
      anchor: `${docClass}-${idx + 1}`,
      heading: typeof c.metadata.sectionPath === 'string' ? c.metadata.sectionPath : null,
      text: c.text,
      embedding: embeddings[idx] ?? null,
    }));

    await tx.insert(sourceSections).values(sectionRows);

    return { sourceId: row.id, sectionCount: sectionRows.length };
  });

  // ---------------------------------------------------------------------
  // 6. Audit. Failures here propagate (lib/audit.ts contract — never
  //    swallow the audit write).
  // ---------------------------------------------------------------------
  await writeAudit({
    action: 'document.upload',
    actor_id: session.user.id,
    resource_type: 'source',
    resource_id: result.sourceId,
    meta_json: {
      docClass,
      mimeType,
      sizeBytes: file.size,
      sectionCount: result.sectionCount,
      filename: file.name,
    },
  });

  await writeAudit({
    action: 'document.chunk',
    actor_id: session.user.id,
    resource_type: 'source',
    resource_id: result.sourceId,
    meta_json: { sectionCount: result.sectionCount, docClass },
  });

  return Response.json(result, { status: 201 });
});
