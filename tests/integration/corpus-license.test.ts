// @MX:NOTE [AUTO] Route-level + domain-level integration tests for Corpus License.
// @MX:SPEC SPEC-REGULA-CORPUS-LICENSE-001 (REQ-CORPUSLIC-001~014, AC-01~07)
//
// Hybrid strategy (mirrors cyberdevice.test.ts / capa.test.ts):
//   1. Source-level: read route/lib source and assert the control is present
//      (withPermission RBAC, writeAudit tx, IDOR guard, gate wiring).
//      This is the anti-dead-code guarantee: every gate function MUST have a
//      confirmed call site in the live route/lib path.
//   2. Domain-level: exercise the pure gate functions (license-gate,
//      expiry-checker, usage-notice) directly with a mocked db client.
//
// AC mapping:
//   AC-01 — ingestion blocked without license metadata (source-level gate + domain)
//   AC-02 — paid-standard full-text blocked without entitlement (domain + source)
//   AC-03 — expired source excluded from search (domain filterExpiredSources)
//   AC-04 — export includes usage notice (domain generateUsageNotice + source wiring)
//   AC-05 — every license change audited (source-level audit tx assertions)
//   AC-06 — abstract-only blocks full-text, allows abstract (domain permitted-use)
//   AC-07 — unauthorized license change → 403 + audit (source-level RBAC + IDOR)

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const readText = (rel: string): string => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------------------
// Shared mock db — CAPA #251 hybrid pattern. Each test configures the rows
// its gate needs, then exercises the REAL lib function.
// The select chain returns a Promise-like (array) that ALSO has `.limit()` so
// both `await db.select().from().where()` and `...where().limit(1)` work.
// ---------------------------------------------------------------------------
function makeThenable(rowsFor: () => unknown[]) {
  // A Promise that carries a `.limit` method on it via assignment.
  const p = Promise.resolve(rowsFor()) as Promise<unknown[]> & {
    limit: () => Promise<unknown[]>;
  };
  p.limit = () => Promise.resolve(rowsFor());
  return p;
}

function makeMockDb(rows: Record<string, unknown[]>) {
  const rowsFor = (key: string): unknown[] => rows[key] ?? [];
  const selectMock = () => ({
    from: () => ({
      where: () => makeThenable(() => rowsFor('select')),
    }),
  });
  return {
    select: vi.fn(selectMock),
    insert: vi.fn(() => ({
      values: () => ({ returning: () => Promise.resolve(rowsFor('insert')) }),
    })),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        select: selectMock,
        insert: vi.fn(() => ({
          values: () => ({ returning: () => Promise.resolve(rowsFor('insert')) }),
        })),
        update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
// AC-01: ingestion blocked without license metadata (REQ-003)
// ---------------------------------------------------------------------------
describe('AC-01: ingestion blocked without license metadata (REQ-003)', () => {
  it('source-level: ingest upload route wires assertIngestionLicensed', () => {
    const src = readText('app/api/ra/admin/documents/upload/route.ts');
    expect(src).toContain('assertIngestionLicensed');
    expect(src).toContain('ingestion_license_blocked');
  });

  it('source-level: ingestion-gate route wraps withPermission', () => {
    const src = readText('app/api/corpus-license/ingestion-gate/route.ts');
    expect(src).toContain("withPermission('corpuslicense.view'");
    expect(src).toContain('assertIngestionLicensed');
  });

  it('domain: assertIngestionLicensed blocks when no license row exists', async () => {
    vi.doMock('@/lib/db/client', () => ({ db: makeMockDb({ select: [] }) }));
    vi.doMock('@/lib/corpus-license/audit', () => ({
      auditIngestionBlocked: vi.fn(),
      auditFullTextBlocked: vi.fn(),
    }));
    const mod = await import('@/lib/corpus-license/license-gate');
    const result = await mod.assertIngestionLicensed({
      sourceId: 'src-1',
      orgId: 'org-1',
      userId: 'user-1',
      wantsFullText: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no_license_metadata');
    vi.doUnmock('@/lib/db/client');
    vi.doUnmock('@/lib/corpus-license/audit');
  });
});

// ---------------------------------------------------------------------------
// AC-02: paid-standard full-text blocked without entitlement (REQ-004)
// ---------------------------------------------------------------------------
describe('AC-02: paid-standard full-text blocked without entitlement (REQ-004)', () => {
  it('domain: isFullTextBlocked enforces the gate predicate (REQ-004 logic)', async () => {
    // REQ-004 collapses to: a standard_paid source without entitlement is
    // full-text-blocked. The policy is constructed inline to test the pure
    // predicate the gate relies on (avoids env-validating db re-import).
    const { isFullTextBlocked } = await import('@/lib/corpus-license/permitted-use');
    const policyWithoutEntitlement = {
      sourceId: 'iso-src',
      licenseType: 'standard_paid' as const,
      permittedUse: { ingest: false, embed: false, search: false, summarize: false, export: false },
      fullTextAllowed: false,
      abstractOnly: true,
      hasActiveEntitlement: false,
    };
    expect(isFullTextBlocked(policyWithoutEntitlement)).toBe(true);
  });

  it('source-level: license-gate blocks full_text_requires_entitlement + audits', () => {
    const src = readText('lib/corpus-license/license-gate.ts');
    expect(src).toContain('full_text_requires_entitlement');
    expect(src).toContain('auditFullTextBlocked');
  });

  it('source-level: permitted-use collapses standard_paid without entitlement', () => {
    const src = readText('lib/corpus-license/permitted-use.ts');
    expect(src).toMatch(/licenseType === 'standard_paid' && !hasActiveEntitlement/);
    expect(src).toMatch(/fullTextAllowed: false/);
  });
});

// ---------------------------------------------------------------------------
// AC-03: expired source excluded from search (REQ-008)
// ---------------------------------------------------------------------------
describe('AC-03: expired source excluded from search (REQ-008)', () => {
  it('source-level: hybrid-search wires filterExpiredSources', () => {
    const src = readText('lib/ai/retrievers/hybrid-search.ts');
    expect(src).toContain('filterExpiredSources');
  });

  it('source-level: internal-sops retriever wires filterExpiredSources', () => {
    const src = readText('lib/ai/retrievers/internal-sops.ts');
    expect(src).toContain('filterExpiredSources');
  });

  it('domain: filterExpiredSources drops past-expiry sources', async () => {
    const pastDate = '2020-01-01';
    const futureDate = '2099-12-31';
    vi.doMock('@/lib/db/client', () => ({
      db: makeMockDb({
        select: [
          { sourceId: 'expired-src', id: 'lic-a', expiryDate: pastDate },
          { sourceId: 'active-src', id: 'lic-b', expiryDate: futureDate },
        ],
      }),
    }));
    const mod = await import('@/lib/corpus-license/expiry-checker');
    const eligible = await mod.filterExpiredSources(['expired-src', 'active-src'], 'org-1');
    expect(eligible.has('expired-src')).toBe(false);
    expect(eligible.has('active-src')).toBe(true);
    vi.doUnmock('@/lib/db/client');
  });
});

// ---------------------------------------------------------------------------
// AC-04: export includes usage notice (REQ-007/011)
// ---------------------------------------------------------------------------
describe('AC-04: export/answer includes usage notice (REQ-007/011)', () => {
  it('source-level: consult.ts wires generateUsageNotice into sources event', () => {
    const src = readText('lib/ai/consult.ts');
    expect(src).toContain('generateUsageNotice');
    expect(src).toContain('usageNotice');
  });

  it('source-level: SourceItem carries optional usageNotice field', () => {
    const src = readText('types/streaming.ts');
    expect(src).toMatch(/usageNotice\?:\s*string/);
  });

  it('domain: generateUsageNotice returns per-source restriction text', async () => {
    vi.doMock('@/lib/db/client', () => ({
      db: makeMockDb({
        select: [
          { sourceId: 'iso-src', licenseType: 'standard_paid', abstractOnly: false },
          { sourceId: 'pubmed-src', licenseType: 'journal', abstractOnly: true },
        ],
      }),
    }));
    const mod = await import('@/lib/corpus-license/usage-notice');
    const notices = await mod.generateUsageNotice(['iso-src', 'pubmed-src'], 'org-1');
    expect(notices).toHaveLength(2);
    const iso = notices.find((n) => n.sourceId === 'iso-src');
    const pubmed = notices.find((n) => n.sourceId === 'pubmed-src');
    expect(iso?.notice).toMatch(/paid standard/i);
    expect(pubmed?.notice).toMatch(/abstract-only policy applies/i);
    vi.doUnmock('@/lib/db/client');
  });
});

// ---------------------------------------------------------------------------
// AC-05: every license change audited (REQ-010)
// ---------------------------------------------------------------------------
describe('AC-05: every license change audited (REQ-010)', () => {
  it('source-level: source-license route writes auditLicenseSet inside tx', () => {
    const src = readText('app/api/corpus-license/source-license/route.ts');
    expect(src).toContain('auditLicenseSet(');
    expect(src).toMatch(/db\.transaction/);
  });

  it('source-level: entitlement route wires grant/revoke audit helpers', () => {
    const src = readText('app/api/corpus-license/entitlement/route.ts');
    expect(src).toContain('grantEntitlement');
    expect(src).toContain('revokeEntitlement');
  });

  it('source-level: entitlement.ts writes audit inside db.transaction', () => {
    const src = readText('lib/corpus-license/entitlement.ts');
    expect(src).toMatch(/auditEntitlementGranted\(/);
    expect(src).toMatch(/auditEntitlementRevoked\(/);
    expect(src).toMatch(/db\.transaction/);
  });
});

// ---------------------------------------------------------------------------
// AC-06: abstract-only blocks full-text, allows abstract (REQ-013)
// ---------------------------------------------------------------------------
describe('AC-06: abstract-only blocks full-text, allows abstract (REQ-013)', () => {
  it('domain: isFullTextBlocked returns true when abstractOnly flag is set', async () => {
    // Inline fixture for the pure predicate — no DB needed.
    const policy = {
      sourceId: 'src-1',
      licenseType: 'journal' as const,
      permittedUse: { ingest: true, embed: true, search: true, summarize: true, export: true },
      fullTextAllowed: true,
      abstractOnly: true,
      hasActiveEntitlement: true,
    };
    const { isFullTextBlocked } = await import('@/lib/corpus-license/permitted-use');
    expect(isFullTextBlocked(policy)).toBe(true);
  });

  it('source-level: abstract-only enforcement audit action exists', () => {
    const src = readText('lib/corpus-license/audit.ts');
    expect(src).toContain('auditAbstractOnlyEnforced');
    expect(src).toContain('corpus.abstract_only_enforced');
  });
});

// ---------------------------------------------------------------------------
// AC-07: unauthorized license change → 403 + audit (REQ-012)
// ---------------------------------------------------------------------------
describe('AC-07: unauthorized license change → 403 + audit (REQ-012)', () => {
  it('source-level: source-license route enforces corpuslicense.manage RBAC', () => {
    const src = readText('app/api/corpus-license/source-license/route.ts');
    expect(src).toContain("withPermission('corpuslicense.manage'");
  });

  it('source-level: entitlement route enforces corpuslicense.manage RBAC', () => {
    const src = readText('app/api/corpus-license/entitlement/route.ts');
    expect(src).toContain("withPermission('corpuslicense.manage'");
  });

  it('source-level: IDOR guard returns 404 on cross-org source_license', () => {
    const src = readText('lib/corpus-license/access.ts');
    expect(src).toContain('auditCorpusAccessDenied');
    expect(src).toContain('source_license_cross_org');
  });
});

// ---------------------------------------------------------------------------
// IDOR + revoke + expiry warning (additional coverage)
// ---------------------------------------------------------------------------
describe('Additional: entitlement revoke → search exclusion (REQ-008)', () => {
  it('source-level: revokeEntitlement sets status revoked', () => {
    const src = readText('lib/corpus-license/entitlement.ts');
    expect(src).toMatch(/status:\s*'revoked'/);
    expect(src).toContain('revokeEntitlement');
  });
});

describe('Additional: expiry warning query (REQ-014)', () => {
  it('source-level: getExpiryWarnings exists and filters upcoming window', () => {
    const src = readText('lib/corpus-license/expiry-checker.ts');
    expect(src).toContain('getExpiryWarnings');
    expect(src).toMatch(/withinDays/);
  });
});

// ---------------------------------------------------------------------------
// Anti-dead-code: every gate function has a confirmed call site (L-006)
// ---------------------------------------------------------------------------
describe('Anti-dead-code: gate functions have confirmed call sites', () => {
  it('assertIngestionLicensed is called in a route/lib path', () => {
    const upload = readText('app/api/ra/admin/documents/upload/route.ts');
    const gate = readText('app/api/corpus-license/ingestion-gate/route.ts');
    expect(
      upload.includes('assertIngestionLicensed') || gate.includes('assertIngestionLicensed'),
    ).toBe(true);
  });

  it('filterExpiredSources is called in a retriever path', () => {
    const hybrid = readText('lib/ai/retrievers/hybrid-search.ts');
    const sops = readText('lib/ai/retrievers/internal-sops.ts');
    expect(hybrid.includes('filterExpiredSources') || sops.includes('filterExpiredSources')).toBe(
      true,
    );
  });

  it('generateUsageNotice is called in the consult answer path', () => {
    const consult = readText('lib/ai/consult.ts');
    expect(consult.includes('generateUsageNotice')).toBe(true);
  });
});
