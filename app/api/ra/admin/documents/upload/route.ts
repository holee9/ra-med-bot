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

import { chunk } from '@/lib/ingest/chunkers';
import { DocClass } from '@/lib/ingest/doc-class';
import { embedChunks } from '@/lib/ingest/embed';
import { SUPPORTED_MIME_TYPES, extractText } from '@/lib/ingest/extract';
import { writeAudit } from '@/lib/kernel/audit';
import { withPermission } from '@/lib/kernel/auth/with-permission';
import { db } from '@/lib/kernel/db/client';
import { sourceSections } from '@/lib/kernel/db/schema';
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
  const existingSourceIdRaw = form.get('sourceId');

  if (!(file instanceof File)) {
    return Response.json({ error: 'file_missing' }, { status: 400 });
  }

  const parsedClass = DocClassSchema.safeParse(docClassRaw);
  if (!parsedClass.success) {
    return Response.json({ error: 'docClass_invalid' }, { status: 400 });
  }
  const docClass = parsedClass.data;

  // REQ-CORPUSLIC-002/003 — pre-ingest license gate. A source MUST have an
  // active license before ingest (SPEC intent: "ingestion 이전에 사용권 검증
  // gate"). New-source creation + ingest in one ungated flow is forbidden —
  // unlicensed paid-standard content would enter the corpus. Therefore an
  // existing sourceId with an active license is REQUIRED; uploads without one
  // are rejected with 400 + audited as `corpus.ingestion_blocked`.
  // Primary wired call site for assertIngestionLicensed.
  const existingSourceId =
    typeof existingSourceIdRaw === 'string' && existingSourceIdRaw.trim().length > 0
      ? existingSourceIdRaw.trim()
      : null;
  if (!existingSourceId) {
    // REQ-003: no pre-registered licensed source → block ingest at the gate.
    await writeAudit({
      action: 'corpus.ingestion_blocked',
      actor_id: session.user.id,
      resource_type: 'source',
      resource_id: 'pending',
      meta_json: {
        reason: 'no_licensed_source',
        docClass,
        fileName: file.name,
      },
    });
    return Response.json(
      {
        error: 'no_licensed_source',
        reason:
          'sourceId with active license required before ingestion — register license via POST /api/corpus-license/source-license first',
      },
      { status: 400 },
    );
  }
  if (session.user.organizationId) {
    const { assertIngestionLicensed } = await import('@/lib/corpus-license/license-gate');
    const gate = await assertIngestionLicensed({
      sourceId: existingSourceId,
      orgId: session.user.organizationId,
      userId: session.user.id,
      wantsFullText: true,
    });
    if (!gate.allowed) {
      return Response.json(
        { error: 'ingestion_license_blocked', reason: gate.reason, licenseType: gate.licenseType },
        { status: 403 },
      );
    }
  }

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
  //    SPEC-REGULA-PHI-REMOVAL-001: PII redaction removed — Regula ingests
  //    internal RA documents (510(k), certifications, SOPs) and does not
  //    handle patient information. The embed layer retains its own defense-
  //    in-depth PII guard.
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
  // 5. Persist source_sections against the PRE-REGISTERED, LICENSED source
  //    (existingSourceId). The upload route no longer creates new source
  //    rows — SPEC REQ-003 requires a licensed source to exist before ingest.
  //    The title override (if any) updates the existing source row.
  // ---------------------------------------------------------------------
  // 21 CFR Part 11 §11.10(e) — Issue #378: source_sections INSERT + the two
  // upload audit rows ride the SAME db.transaction so a failure between them
  // rolls back both. setPendingReviewOnIngest stays on a separate best-effort
  // boundary (governance write may be unavailable; RLS isolates) — run AFTER
  // the atomic persist+audit so its try/catch swallow cannot mask an audit
  // failure.
  const result: UploadSuccess = await db.transaction(async (tx) => {
    // Attach sections to the pre-registered source (no new sources row).
    const sectionRows = chunks.map((c, idx) => ({
      sourceId: existingSourceId,
      anchor: `${docClass}-${idx + 1}`,
      heading: typeof c.metadata.sectionPath === 'string' ? c.metadata.sectionPath : null,
      text: c.text,
      embedding: embeddings[idx] ?? null,
    }));

    await tx.insert(sourceSections).values(sectionRows);

    await writeAudit(
      {
        action: 'document.upload',
        actor_id: session.user.id,
        resource_type: 'source',
        resource_id: existingSourceId,
        meta_json: {
          docClass,
          mimeType,
          sizeBytes: file.size,
          sectionCount: sectionRows.length,
          filenameExt: file.name.includes('.')
            ? (file.name.split('.').pop()?.slice(0, 32) ?? null)
            : null,
          filenameLength: file.name.length,
        },
      },
      tx,
    );

    await writeAudit(
      {
        action: 'document.chunk',
        actor_id: session.user.id,
        resource_type: 'source',
        resource_id: existingSourceId,
        meta_json: { sectionCount: sectionRows.length, docClass },
      },
      tx,
    );

    return { sourceId: existingSourceId, sectionCount: sectionRows.length };
  });

  // REQ-SOURCE-GOV-009/AC-04 — set the newly-ingested source to pending_review.
  // Called AFTER the license gate (which already passed above) so the source
  // enters RA-owner approval workflow. Internal SOPs without owner_department
  // stay pending_review and are flagged for the governance dashboard.
  try {
    const { setPendingReviewOnIngest } = await import('@/lib/source-governance/review-workflow');
    await setPendingReviewOnIngest({
      sourceId: existingSourceId,
      orgId,
      isInternalSop: docClass === DocClass.internal_sop,
      ownerDepartment: null,
    });
  } catch {
    // Governance write unavailable — license gate still passed; RLS isolates.
  }

  return Response.json(result, { status: 201 });
});
