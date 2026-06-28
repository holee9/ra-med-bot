// @MX:NOTE [AUTO] REQ-009 — eSubmit forward hook (ACTIVE).
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-009, AC-07)
// @MX:REASON [AUTO] Activated in #249. The approve route calls this AFTER the
//           approval tx commits; failure here is non-fatal (forward hook, not a gate).
//
// Package-linkage decision (Charter [지양-2] provenance, [ simplicity ]):
//   submission_packages has NO project_id column (only org_id). Rather than
//   adding a linkage table or a new column, the linkage is carried inside
//   package_manifest jsonb:
//     - manifest._projectId   → the labeling project this package belongs to
//     - manifest._origin      → 'labeling_approval' (distinguishes from manually
//                                created packages that have no _origin)
//     - manifest.labeling_documents[] → provenance entries (documentId, version,
//                                jurisdiction, approvedBy, approvedAt, sectionType)
//   Lookup: by (orgId, manifest->>_projectId = projectId, manifest->>\_origin).
//   If none exists, a new package is created for that project. This preserves
//   the existing submission_packages schema (no migration needed for linkage)
//   while keeping full traceability of which approved labeling docs were folded in.
//
// Idempotency: re-forwarding the same approved document updates its provenance
// entry in-place (matched by documentId) instead of appending a duplicate.
//
// Manifest append shape (validateSubmissionPackage-compatible):
//   Each labeling section becomes a top-level manifest key named after its
//   section_type (e.g. "device_description", "intended_use"). validateSubmission
//   Package checks these top-level keys for min-20-char presence, so the
//   forwarded labeling content satisfies that contract directly.

import { writeAudit } from '@/lib/audit';
import { db } from '@/lib/db/client';
import { labelingDocuments, labelingSections, submissionPackages } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export interface ESubmitBridgeResult {
  /** True when the eSubmit package was created or updated with the labeling. */
  forwarded: boolean;
  /** Package id on success, or a stable reason code on failure. */
  detail: string;
}

/**
 * Minimum content length for a manifest section to be considered "complete"
 * by validateSubmissionPackage. We skip forwarding sections below this threshold
 * rather than emitting incomplete entries.
 */
const MIN_SECTION_CHARS = 20;

/**
 * @MX:NOTE [AUTO] Reserved manifest keys — forwarding must NEVER clobber these.
 * @MX:REASON [AUTO] Defense-in-depth (M-1): today the labeling_sections.section_type
 *           CHECK constraint (5-value allowlist) blocks `__proto__`/`constructor`
 *           and these reserved names from ever reaching the append loop. But a
 *           FUTURE migration widening the allowlist could let a section type
 *           collide with submission metadata keys (`_origin`, `_projectId`,
 *           `labeling_documents`) or validator-consumed keys (`predicate_device`
 *           — see lib/esubmit/validators.ts). The bridge would then silently
 *           overwrite submission package metadata. Skip reserved keys explicitly.
 */
const RESERVED_MANIFEST_KEYS = new Set([
  '_origin',
  '_projectId',
  'labeling_documents',
  'predicate_device',
]);

/**
 * REQ-009: forward an approved labeling document into the project's eSubmit
 * submission package. Appends each approved section into package_manifest as a
 * top-level key (so validateSubmissionPackage sees them), records provenance
 * under manifest.labeling_documents, and writes a 21 CFR Part 11 audit row.
 *
 * Non-fatal: returns {forwarded:false, detail:<reason>} on any failure rather
 * than throwing — the approve route's success must not depend on the forward.
 */
export async function forwardLabelingToESubmit(params: {
  documentId: string;
  projectId: string;
  orgId: string;
  /** Caller's user id (for the audit row). */
  actorId?: string;
}): Promise<ESubmitBridgeResult> {
  const { documentId, projectId, orgId } = params;
  const actorId = params.actorId ?? null;

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Load the approved labeling document (org-scoped — IDOR defense).
      const [doc] = await tx
        .select({
          id: labelingDocuments.id,
          productName: labelingDocuments.productName,
          jurisdiction: labelingDocuments.jurisdiction,
          status: labelingDocuments.status,
          approvedBy: labelingDocuments.approvedBy,
          approvedAt: labelingDocuments.approvedAt,
          createdBy: labelingDocuments.createdBy,
        })
        .from(labelingDocuments)
        .where(and(eq(labelingDocuments.id, documentId), eq(labelingDocuments.orgId, orgId)))
        .limit(1);
      if (!doc) {
        return { forwarded: false as const, detail: 'labeling_document_not_found' };
      }
      if (doc.status !== 'approved') {
        return { forwarded: false as const, detail: 'labeling_not_approved' };
      }

      // 2. Load the document's sections. Bounded to a generous ceiling so an
      // accidentally huge section set does not scan unboundedly.
      const sections = await tx
        .select({
          sectionType: labelingSections.sectionType,
          content: labelingSections.content,
        })
        .from(labelingSections)
        .where(and(eq(labelingSections.documentId, documentId), eq(labelingSections.orgId, orgId)))
        .limit(500);

      // 3. Find or create the project's submission package (manifest-scoped linkage).
      const [existing] = await tx
        .select({ id: submissionPackages.id, packageManifest: submissionPackages.packageManifest })
        .from(submissionPackages)
        .where(
          and(
            eq(submissionPackages.orgId, orgId),
            sql`${submissionPackages.packageManifest}->>'_projectId' = ${projectId}`,
            sql`${submissionPackages.packageManifest}->>'_origin' = 'labeling_approval'`,
          ),
        )
        .limit(1);

      const sectionEntries = sections.filter(
        (s) => typeof s.content === 'string' && s.content.trim().length >= MIN_SECTION_CHARS,
      );

      let packageId: string;
      let manifest: Record<string, unknown>;

      if (existing) {
        packageId = existing.id;
        manifest = (existing.packageManifest as Record<string, unknown>) ?? {};
      } else {
        // Create a new package for this project, seeded with linkage metadata.
        const [created] = await tx
          .insert(submissionPackages)
          .values({
            orgId,
            submissionType: deriveSubmissionType(doc.jurisdiction),
            jurisdiction: doc.jurisdiction,
            deviceName: doc.productName,
            version: '1.0',
            // createdBy is NOT NULL. Prefer the approved-by user (the RA-lead
            // who approved the labeling); fall back to the document's creator
            // (guaranteed non-null and same-org as the document). The actorId
            // fallback was dropped (M-2): actorId could reference a cross-org
            // user if a future caller passed a mismatched (orgId, actorId)
            // pair. actorId is still used for the AUDIT row actor_id below.
            createdBy: doc.approvedBy ?? doc.createdBy,
            packageManifest: {
              _origin: 'labeling_approval',
              _projectId: projectId,
              labeling_documents: [],
            } as unknown,
          })
          .returning({ id: submissionPackages.id });
        if (!created) {
          return { forwarded: false as const, detail: 'package_create_failed' };
        }
        packageId = created.id;
        manifest = {
          _origin: 'labeling_approval',
          _projectId: projectId,
          labeling_documents: [],
        };
      }

      // 4. Append labeling sections as top-level manifest keys.
      // @MX:WARN [AUTO] Skip reserved keys (M-1): a section_type collision with
      //       _origin / _projectId / labeling_documents / predicate_device MUST
      //       NOT clobber submission metadata. The DB CHECK blocks these today,
      //       but this guard survives a future allowlist widening.
      for (const s of sectionEntries) {
        if (RESERVED_MANIFEST_KEYS.has(s.sectionType)) continue;
        manifest[s.sectionType] = s.content;
      }

      // 5. Update provenance array (idempotent: replace entry with same documentId).
      const labelingDocs = Array.isArray(manifest.labeling_documents)
        ? (manifest.labeling_documents as Array<Record<string, unknown>>)
        : [];
      const provenanceEntry: Record<string, unknown> = {
        documentId,
        jurisdiction: doc.jurisdiction,
        approvedBy: doc.approvedBy,
        approvedAt: doc.approvedAt?.toISOString() ?? null,
        sectionTypes: sectionEntries.map((s) => s.sectionType),
      };
      const idx = labelingDocs.findIndex((e) => e.documentId === documentId);
      if (idx >= 0) {
        labelingDocs[idx] = provenanceEntry;
      } else {
        labelingDocs.push(provenanceEntry);
      }
      manifest.labeling_documents = labelingDocs;

      await tx
        .update(submissionPackages)
        .set({ packageManifest: manifest as unknown, updatedAt: new Date() })
        .where(eq(submissionPackages.id, packageId));

      // 6. Audit the forward (21 CFR Part 11 traceability).
      await writeAudit(
        {
          actor_id: actorId,
          action: 'label.esubmit_forwarded',
          resource_type: 'submission_package',
          resource_id: packageId,
          meta_json: {
            documentId,
            projectId,
            sectionsForwarded: sectionEntries.map((s) => s.sectionType),
          },
        },
        tx,
      );

      return { forwarded: true as const, detail: packageId };
    });

    return result;
  } catch (err) {
    // Non-fatal: do NOT propagate. The approve route must still succeed.
    const reason = err instanceof Error ? err.message : 'forward_exception';
    return { forwarded: false, detail: `esubmit_forward_failed:${reason}` };
  }
}

/**
 * Map a labeling jurisdiction to a submission_type accepted by the
 * submission_packages CHECK constraint. Falls back to '510k' for FDA and for
 * any unrecognized jurisdiction (manual review will catch mismatches).
 */
function deriveSubmissionType(jurisdiction: string): string {
  switch (jurisdiction) {
    case 'EU':
      return 'cer';
    case 'FDA':
      return '510k';
    case 'MFDS':
      return 'mfds_import';
    case 'NMPA':
      return 'nmpa_ecdt';
    default:
      return '510k';
  }
}
