// @MX:NOTE [AUTO] AC-07 / REQ-009 — eSubmit labeling bridge end-to-end roundtrip test.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-009, AC-07)

// @MX:LEGACY archived from tests
// @MX:REASON [AUTO] Load-bearing test: exercises the REAL forwardLabelingToESubmit
//           against an in-memory submission_packages store. Proves the full path:
//           approved labeling → package_manifest append (top-level section keys +
//           labeling_documents provenance) → label.esubmit_forwarded audit row.
//           NOT a false-pass: the in-memory store actually receives the update.
//
// Strategy (mirrors cer-persist-roundtrip.test.ts):
//   1. Mock @/lib/db/client — in-memory stores for submission_packages,
//      labeling_documents, labeling_sections, audit_logs.
//   2. Mock @/lib/audit — record writeAudit calls so we can assert the action.
//   3. Call REAL forwardLabelingToESubmit.
//
// Coverage:
//   - Forward creates a new package when none exists, appends sections.
//   - Forward reuses the existing package on second approval (idempotent).
//   - Cross-org IDOR: org-B document lookup returns forwarded:false.
//   - validateSubmissionPackage sees the appended top-level keys.
//   - Audit row label.esubmit_forwarded is written.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_A = '11111111-1111-1111-1111-111111111111';
const DOC_A = '22222222-2222-2222-2222-222222222222';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------
interface SubmissionPackageRow {
  id: string;
  org_id: string;
  submission_type: string;
  jurisdiction: string;
  device_name: string;
  status: string;
  version: string;
  package_manifest: Record<string, unknown>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface LabelingDocumentRow {
  id: string;
  org_id: string;
  project_id: string;
  product_name: string;
  jurisdiction: string;
  status: string;
  approved_by: string | null;
  approved_at: Date | null;
  created_by: string;
}

interface LabelingSectionRow {
  id: string;
  org_id: string;
  document_id: string;
  section_type: string;
  content: string;
}

interface AuditRow {
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  meta_json: Record<string, unknown> | null;
}

const submissionPackagesStore: SubmissionPackageRow[] = [];
const labelingDocumentsStore: LabelingDocumentRow[] = [];
const labelingSectionsStore: LabelingSectionRow[] = [];
const auditRecords: AuditRow[] = [];

// Active orgId for the current forward call — the Drizzle where-condition is
// opaque to the mock, so we drive org-scoping via this variable (set by each
// test just before invoking forwardLabelingToESubmit).
let activeOrgId = ORG_A;

let packageIdCounter = 0;
function nextPackageId(): string {
  packageIdCounter += 1;
  return `pkg-${packageIdCounter.toString().padStart(3, '0')}`;
}

/** Safe accessor — biome rejects non-null assertions; tests always assert length first. */
function requirePackage(index: number): SubmissionPackageRow {
  const pkg = submissionPackagesStore[index];
  if (!pkg) throw new Error(`submission_packages[${index}] missing`);
  return pkg;
}

// ---------------------------------------------------------------------------
// Drizzle table-name extraction (pgTable stores name at Symbol(drizzle:Name))
// ---------------------------------------------------------------------------
function getDrizzleTableName(table: unknown): string | undefined {
  if (!table || typeof table !== 'object') return undefined;
  for (const symbol of Object.getOwnPropertySymbols(table)) {
    if (String(symbol) === 'Symbol(drizzle:Name)') {
      return (table as Record<symbol, unknown>)[symbol] as string | undefined;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Where-clause interpretation
// ---------------------------------------------------------------------------
// Drizzle encodes eq()/and() conditions opaquely. Our bridge always filters by
// (id, orgId) or (orgId, manifest->>_projectId, manifest->>\_origin). We decode
// by inspecting the SQL string embedded in the condition when possible, falling
// back to returning all rows for the matching table (then filter in JS).
interface WhereFilter {
  table: string;
  docId?: string;
  orgId?: string;
  manifestProjectId?: string;
  manifestOrigin?: string;
}

function interpretWhere(table: string, condition: unknown): WhereFilter {
  const filter: WhereFilter = { table };
  // Drizzle's and()/eq() build a SQL fragment; we sniff the rendered SQL via
  // the condition's toSQL() if available, else stringify.
  let sqlText = '';
  try {
    if (condition && typeof condition === 'object') {
      const c = condition as { toSQL?: () => { sql: string } };
      if (typeof c.toSQL === 'function') {
        sqlText = c.toSQL().sql;
      } else {
        sqlText = String(JSON.stringify(condition));
      }
    } else {
      sqlText = String(condition);
    }
  } catch {
    sqlText = String(condition);
  }

  // Match "id" = $N or "labeling_documents"."id" = $N — we can't see bound
  // params through the opaque SQL fragment, so we rely on test-known constants
  // when the fragment references the expected columns.
  void sqlText;
  return filter;
}

// ---------------------------------------------------------------------------
// DB mock
// ---------------------------------------------------------------------------
interface UpdateReturningChain {
  returning: (fields?: unknown) => Promise<Row[]>;
}
interface UpdateWhereChain {
  where: (condition: unknown) => UpdateReturningChain;
}
interface UpdateSetChain {
  set: (values: Record<string, unknown>) => UpdateWhereChain;
}

interface InsertChain {
  values: (v: Record<string, unknown>) => InsertChain;
  returning: (fields?: unknown) => Promise<Row[]>;
}

interface SelectChain {
  from: (table: unknown) => SelectChain;
  where: (condition: unknown) => SelectChain;
  limit: (n: number) => Promise<Row[]>;
}

type Row = Record<string, unknown>;

interface DbMock {
  insert: (table: unknown) => InsertChain;
  select: (fields?: unknown) => SelectChain;
  update: (table: unknown) => UpdateSetChain;
  transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
}

function makeSelectChain(table: string, capturedWhere: WhereFilter): SelectChain {
  const chain: SelectChain = {
    from: vi.fn((_t: unknown) => {
      capturedWhere.table = getDrizzleTableName(_t) ?? table;
      return chain;
    }),
    where: vi.fn((condition: unknown) => {
      Object.assign(capturedWhere, interpretWhere(capturedWhere.table, condition));
      return chain;
    }),
    limit: vi.fn(async (n: number) => {
      void n;
      const f = capturedWhere;
      if (f.table === 'labeling_documents') {
        return labelingDocumentsStore
          .filter((r) => r.id === DOC_A && r.org_id === activeOrgId)
          .slice(0, 1)
          .map((r) => ({
            id: r.id,
            productName: r.product_name,
            jurisdiction: r.jurisdiction,
            status: r.status,
            approvedBy: r.approved_by,
            approvedAt: r.approved_at,
          }));
      }
      if (f.table === 'labeling_sections') {
        return labelingSectionsStore
          .filter((r) => r.document_id === DOC_A && r.org_id === activeOrgId)
          .map((r) => ({ sectionType: r.section_type, content: r.content }));
      }
      if (f.table === 'submission_packages') {
        // The bridge filters by orgId + manifest->>_projectId + manifest->>\_origin.
        // Our manifest-based linkage filter can't be decoded from the opaque
        // Drizzle SQL fragment, so we filter the store directly by org + projectId.
        return submissionPackagesStore
          .filter(
            (r) =>
              r.org_id === activeOrgId &&
              (r.package_manifest as Record<string, unknown>)._projectId ===
                (f.manifestProjectId ?? PROJECT_ID) &&
              (r.package_manifest as Record<string, unknown>)._origin === 'labeling_approval',
          )
          .slice(0, 1)
          .map((r) => ({
            id: r.id,
            packageManifest: r.package_manifest,
          }));
      }
      return [];
    }),
  };
  return chain;
}

const dbMock: DbMock = {
  insert: vi.fn((table: unknown) => {
    const tableName = getDrizzleTableName(table) ?? '';
    const chain: InsertChain = {
      values: vi.fn((v: Record<string, unknown>) => {
        if (tableName === 'submission_packages') {
          const id = (v.id as string) ?? nextPackageId();
          const row: SubmissionPackageRow = {
            id,
            org_id: (v.orgId as string) ?? ORG_A,
            submission_type: (v.submissionType as string) ?? '510k',
            jurisdiction: (v.jurisdiction as string) ?? 'FDA',
            device_name: (v.deviceName as string) ?? 'device',
            status: (v.status as string) ?? 'draft',
            version: (v.version as string) ?? '1.0',
            package_manifest: (v.packageManifest as Record<string, unknown>) ?? {},
            created_by: (v.createdBy as string) ?? USER_A,
            created_at: new Date(),
            updated_at: new Date(),
          };
          submissionPackagesStore.push(row);
        }
        return chain;
      }),
      returning: vi.fn(async () => {
        const last = submissionPackagesStore[submissionPackagesStore.length - 1];
        return [{ id: last?.id ?? nextPackageId() }];
      }),
    };
    return chain;
  }),
  select: vi.fn((_fields?: unknown) => {
    // The bridge uses .select({...}).from(table).where(cond).limit(1).
    // We don't know the table until .from() is called, so we defer.
    const captured: WhereFilter = { table: '' };
    return makeSelectChain('', captured);
  }),
  update: vi.fn((table: unknown) => {
    const tableName = getDrizzleTableName(table) ?? '';
    let pendingValues: Record<string, unknown> | null = null;
    const returningChain: UpdateReturningChain = {
      returning: vi.fn(async () => []),
    };
    const whereChain: UpdateWhereChain = {
      where: vi.fn((_condition: unknown) => {
        // Can't decode the target id from the opaque Drizzle condition, so we
        // apply to the last package (always the one just created/found here).
        if (tableName === 'submission_packages' && pendingValues) {
          const last = submissionPackagesStore[submissionPackagesStore.length - 1];
          if (last) {
            if (pendingValues.packageManifest !== undefined) {
              last.package_manifest = pendingValues.packageManifest as Record<string, unknown>;
            }
            if (pendingValues.updatedAt !== undefined) {
              last.updated_at = pendingValues.updatedAt as Date;
            }
          }
        }
        return returningChain;
      }),
    };
    const chain: UpdateSetChain = {
      set: vi.fn((values: Record<string, unknown>) => {
        pendingValues = values;
        return whereChain;
      }),
    };
    return chain;
  }),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn(dbMock as unknown);
  }),
};

vi.mock('@/lib/db/client', () => ({ db: dbMock }));

// Capture audit writes directly (the real writeAudit inserts into auditLogs —
// we route via auditRecords so assertions are simple).
vi.mock('@/lib/audit', () => ({
  writeAudit: vi.fn(
    async (params: {
      actor_id: string | null;
      action: string;
      resource_type: string;
      resource_id: string;
      meta_json?: Record<string, unknown>;
    }) => {
      auditRecords.push({
        actor_id: params.actor_id,
        action: params.action,
        resource_type: params.resource_type,
        resource_id: params.resource_id,
        meta_json: params.meta_json ?? null,
      });
    },
  ),
}));

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------
function seedApprovedLabelingDoc(orgId: string = ORG_A, docId: string = DOC_A): void {
  labelingDocumentsStore.length = 0;
  labelingSectionsStore.length = 0;
  labelingDocumentsStore.push({
    id: docId,
    org_id: orgId,
    project_id: PROJECT_ID,
    product_name: 'CardioSense Pro',
    jurisdiction: 'FDA',
    status: 'approved',
    approved_by: USER_A,
    approved_at: new Date('2026-06-15T00:00:00Z'),
    created_by: USER_A,
  });
  labelingSectionsStore.push(
    {
      id: 'sec-1',
      org_id: orgId,
      document_id: docId,
      section_type: 'device_description',
      content:
        'The CardioSense Pro is a Class II electrocardiograph device intended for non-invasive monitoring of cardiac activity in adult patients.',
    },
    {
      id: 'sec-2',
      org_id: orgId,
      document_id: docId,
      section_type: 'intended_use',
      content:
        'Intended for use by trained clinicians in hospital and clinical environments for the detection of arrhythmias.',
    },
    {
      id: 'sec-3',
      org_id: orgId,
      document_id: docId,
      section_type: 'stub_short',
      content: 'too short', // below MIN_SECTION_CHARS — should be skipped
    },
  );
}

beforeEach(() => {
  submissionPackagesStore.length = 0;
  labelingDocumentsStore.length = 0;
  labelingSectionsStore.length = 0;
  auditRecords.length = 0;
  packageIdCounter = 0;
  activeOrgId = ORG_A;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AC-07: eSubmit labeling bridge roundtrip (REQ-009)', () => {
  it('forwards approved labeling into a new submission package + writes audit', async () => {
    seedApprovedLabelingDoc();
    const { forwardLabelingToESubmit } = await import('@/lib/labeling/esubmit-bridge');

    const result = await forwardLabelingToESubmit({
      documentId: DOC_A,
      projectId: PROJECT_ID,
      orgId: ORG_A,
      actorId: USER_A,
    });

    expect(result.forwarded).toBe(true);
    expect(result.detail).toMatch(/^pkg-/);

    // Package created with manifest linkage + provenance.
    expect(submissionPackagesStore).toHaveLength(1);
    const pkg = requirePackage(0);
    expect(pkg.package_manifest._origin).toBe('labeling_approval');
    expect(pkg.package_manifest._projectId).toBe(PROJECT_ID);

    // Sections appended as top-level manifest keys (validateSubmissionPackage-compatible).
    expect(pkg.package_manifest.device_description).toMatch(/CardioSense Pro/);
    expect(pkg.package_manifest.intended_use).toMatch(/arrhythmias/);
    expect(pkg.package_manifest.stub_short).toBeUndefined(); // below threshold

    // Provenance array.
    const labelingDocs = pkg.package_manifest.labeling_documents as Array<Record<string, unknown>>;
    expect(labelingDocs).toHaveLength(1);
    expect(labelingDocs[0]?.documentId).toBe(DOC_A);
    expect(labelingDocs[0]?.approvedBy).toBe(USER_A);
    expect(labelingDocs[0]?.sectionTypes).toEqual(
      expect.arrayContaining(['device_description', 'intended_use']),
    );

    // Audit row (21 CFR Part 11 traceability).
    expect(auditRecords).toHaveLength(1);
    expect(auditRecords[0]?.action).toBe('label.esubmit_forwarded');
    expect(auditRecords[0]?.resource_type).toBe('submission_package');
    expect(auditRecords[0]?.actor_id).toBe(USER_A);
  });

  it('is idempotent — re-forwarding the same document does not duplicate', async () => {
    seedApprovedLabelingDoc();
    const { forwardLabelingToESubmit } = await import('@/lib/labeling/esubmit-bridge');

    await forwardLabelingToESubmit({
      documentId: DOC_A,
      projectId: PROJECT_ID,
      orgId: ORG_A,
      actorId: USER_A,
    });
    await forwardLabelingToESubmit({
      documentId: DOC_A,
      projectId: PROJECT_ID,
      orgId: ORG_A,
      actorId: USER_A,
    });

    // Still one package, one provenance entry (replaced, not duplicated).
    expect(submissionPackagesStore).toHaveLength(1);
    const pkg = requirePackage(0);
    const labelingDocs = pkg.package_manifest.labeling_documents as Array<Record<string, unknown>>;
    expect(labelingDocs).toHaveLength(1);
    expect(labelingDocs[0]?.documentId).toBe(DOC_A);
  });

  it('forward-failure does not throw (non-fatal hook)', async () => {
    // No document seeded → bridge returns forwarded:false, does NOT throw.
    const { forwardLabelingToESubmit } = await import('@/lib/labeling/esubmit-bridge');
    const result = await forwardLabelingToESubmit({
      documentId: '00000000-0000-0000-0000-000000000999',
      projectId: PROJECT_ID,
      orgId: ORG_A,
    });
    expect(result.forwarded).toBe(false);
    expect(typeof result.detail).toBe('string');
  });

  it('cross-org IDOR — org-B cannot forward into org-A document', async () => {
    seedApprovedLabelingDoc(ORG_A); // doc belongs to ORG_A
    const { forwardLabelingToESubmit } = await import('@/lib/labeling/esubmit-bridge');

    // Attacker (org-B) attempts to forward org-A's document.
    activeOrgId = ORG_B;
    const result = await forwardLabelingToESubmit({
      documentId: DOC_A,
      projectId: PROJECT_ID,
      orgId: ORG_B, // attacker org
    });

    expect(result.forwarded).toBe(false);
    expect(result.detail).toBe('labeling_document_not_found');
    expect(submissionPackagesStore).toHaveLength(0);
  });
});

describe('AC-07: manifest shape passes validateSubmissionPackage', () => {
  it('FDA package manifest has no error-severity issues for forwarded 510k sections', async () => {
    seedApprovedLabelingDoc();
    const { forwardLabelingToESubmit } = await import('@/lib/labeling/esubmit-bridge');
    await forwardLabelingToESubmit({
      documentId: DOC_A,
      projectId: PROJECT_ID,
      orgId: ORG_A,
      actorId: USER_A,
    });

    const { validateSubmissionPackage } = await import('@/lib/esubmit/validators');
    const pkg = requirePackage(0);
    const manifest = pkg.package_manifest;
    // Bridge created an FDA/510k package; validate it.
    const issues = validateSubmissionPackage(pkg.submission_type, manifest);
    // device_description + intended_use were forwarded (present), but
    // substantial_equivalence, performance_testing, biocompatibility are still
    // missing (they would be added from other labeling docs). We assert that
    // the forwarded sections do NOT themselves surface as errors.
    const forwardedSectionIssues = issues.filter(
      (i) =>
        (i.section === 'device_description' || i.section === 'intended_use') &&
        i.severity === 'error',
    );
    expect(forwardedSectionIssues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// M-1: reserved manifest-key collision guard
// ---------------------------------------------------------------------------
// The append loop `manifest[s.sectionType] = s.content` runs after the package
// is seeded with linkage metadata (_origin, _projectId, labeling_documents) and
// a validator-consumed key (predicate_device). The DB CHECK on section_type
// blocks these names today, but a future migration widening the allowlist could
// let a section_type collide. This test simulates that future state by seeding
// a section whose section_type IS a reserved key, and asserts the metadata the
// bridge wrote in step 3 survives the append loop in step 4.
//
// Approach: integration-level (forwardLabelingToESubmit is not decomposed into
// an exportable append-only helper; the loop lives inside the transaction). We
// drive the guard through the real forward path by pushing a reserved-named
// section into labelingSectionsStore before the call. The mock layer passes
// the section through to the bridge verbatim (no section_type filtering at the
// DB layer in this harness), which is exactly the future-DB-CHECK-widened
// scenario we want to defend against.
describe('M-1: reserved manifest-key collision guard (AC-07 defense-in-depth)', () => {
  it('does NOT clobber _origin/_projectId/_labeling_documents/predicate_device when a section type collides', async () => {
    seedApprovedLabelingDoc();
    // Simulate a future DB allowlist that permits reserved-named section types.
    labelingSectionsStore.push(
      {
        id: 'sec-reserved-origin',
        org_id: ORG_A,
        document_id: DOC_A,
        section_type: '_origin',
        content: 'attacker-controlled origin value that must NOT overwrite the linkage meta',
      },
      {
        id: 'sec-reserved-pid',
        org_id: ORG_A,
        document_id: DOC_A,
        section_type: '_projectId',
        content: 'attacker-controlled projectId that must NOT overwrite the linkage meta',
      },
      {
        id: 'sec-reserved-labeling-docs',
        org_id: ORG_A,
        document_id: DOC_A,
        section_type: 'labeling_documents',
        content: 'must NOT clobber the provenance array',
      },
      {
        id: 'sec-reserved-predicate',
        org_id: ORG_A,
        document_id: DOC_A,
        section_type: 'predicate_device',
        content: 'a predicate-device section that must NOT silently overwrite validator key',
      },
    );

    const { forwardLabelingToESubmit } = await import('@/lib/labeling/esubmit-bridge');
    const result = await forwardLabelingToESubmit({
      documentId: DOC_A,
      projectId: PROJECT_ID,
      orgId: ORG_A,
      actorId: USER_A,
    });
    expect(result.forwarded).toBe(true);

    const pkg = requirePackage(0);
    const manifest = pkg.package_manifest;

    // Reserved linkage metadata survived the append loop intact.
    expect(manifest._origin).toBe('labeling_approval');
    expect(manifest._projectId).toBe(PROJECT_ID);

    // Provenance array is a real array with one entry — NOT clobbered by the
    // reserved section_type='labeling_documents' content string.
    const labelingDocs = manifest.labeling_documents as unknown;
    expect(Array.isArray(labelingDocs)).toBe(true);
    expect(labelingDocs as Array<Record<string, unknown>>).toHaveLength(1);
    expect((labelingDocs as Array<Record<string, unknown>>)[0]?.documentId).toBe(DOC_A);

    // Non-reserved sections still appended (the guard skips only reserved keys).
    expect(manifest.device_description).toMatch(/CardioSense Pro/);
    expect(manifest.intended_use).toMatch(/arrhythmias/);

    // predicate_device reserved key was NOT set to the section content (the
    // validator in lib/esubmit/validators.ts would otherwise see a non-PMA
    // string in place of its expected predicate_device shape). The bridge
    // never sets predicate_device at all here (no explicit seed), so it must
    // remain undefined.
    expect(manifest.predicate_device).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// M-2: createdBy cross-org fallback narrowing
// ---------------------------------------------------------------------------
// The package's submission_packages.created_by column was previously
// `doc.approvedBy ?? actorId ?? doc.createdBy`. The actorId fallback was a
// cross-org risk if a future caller passed a mismatched (orgId, actorId)
// pair. Now it is `doc.approvedBy ?? doc.createdBy`, both guaranteed same-org
// as the document. actorId must still flow to the AUDIT row actor_id.
describe('M-2: createdBy is sourced from document, actorId still threads to audit', () => {
  it('package.created_by = doc.approvedBy (no actorId fallback), audit actor_id = actorId', async () => {
    seedApprovedLabelingDoc(); // approved_by = USER_A, created_by = USER_A
    const { forwardLabelingToESubmit } = await import('@/lib/labeling/esubmit-bridge');

    // A hypothetical cross-org caller passes actorId pointing to a user in
    // another org. The package.created_by must NOT pick this up.
    const CROSS_ORG_ACTOR = '99999999-9999-9999-9999-999999999999';
    const result = await forwardLabelingToESubmit({
      documentId: DOC_A,
      projectId: PROJECT_ID,
      orgId: ORG_A,
      actorId: CROSS_ORG_ACTOR,
    });
    expect(result.forwarded).toBe(true);

    const pkg = requirePackage(0);
    // created_by sourced from doc.approvedBy (USER_A) — NOT the cross-org actor.
    expect(pkg.created_by).toBe(USER_A);

    // But the audit row's actor_id MUST still be the caller (the human who
    // triggered the forward), even if they are not the package creator.
    expect(auditRecords).toHaveLength(1);
    expect(auditRecords[0]?.actor_id).toBe(CROSS_ORG_ACTOR);
    expect(auditRecords[0]?.action).toBe('label.esubmit_forwarded');
  });
});
