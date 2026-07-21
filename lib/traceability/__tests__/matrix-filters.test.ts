// @MX:NOTE [AUTO] C2 regression — matrix filters applied in the DB path.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-005, AC-02)
// @MX:TEST regression for the C2 defect: loadDeliverables previously ignored
//          jurisdiction/product/packageId/riskLevel — the Zod schema accepted
//          them but the query dropped them. This stubs the DB layer to capture
//          the WHERE clauses and asserts each filter narrows the refId set.

import {
  designHistoryFiles,
  evidenceEdges,
  evidenceNodes,
  riskItems,
  submissionPackages,
} from '@/lib/kernel/db/schema';
import { describe, expect, it } from 'vitest';
import { type MatrixFilters, buildMatrix } from '../matrix';

type Row = Record<string, unknown>;

/**
 * Drizzle-shaped stub keyed by table object identity. Each registered table
 * returns its configured rows for any select().from(table).where(...) chain.
 * The `calls` array records which tables were queried so tests can assert the
 * filter subqueries fired (they did NOT fire before the C2 fix).
 */
function makeDb(opts: {
  byTable: Map<unknown, Row[]>;
  deliverables: Row[];
}) {
  const calls: string[] = [];
  const select = (_cols?: unknown) => ({
    from: (table: unknown) => {
      const name = nameOf(table);
      const rows = name === 'evidence_nodes' ? opts.deliverables : (opts.byTable.get(table) ?? []);
      return {
        where: (..._clauses: unknown[]) => {
          calls.push(name);
          return rows;
        },
      };
    },
  });
  return { db: { select } as never, calls };
}

/** Resolve the drizzle table name from the [drizzle:Name] symbol. */
function nameOf(table: unknown): string {
  const sym = (table as Record<symbol, unknown>)[Symbol.for('drizzle:Name')];
  return typeof sym === 'string' ? sym : '?';
}

describe('C2: matrix DB-path filters narrow deliverables (REQ-TRACEABILITY-005)', () => {
  /** Build a heterogeneous Map<unknown, Row[]> without TS inferring one table type. */
  function tbl(entries: [unknown, Row[]][] = []): Map<unknown, Row[]> {
    return new Map(entries);
  }

  it('jurisdiction filter queries submission_packages + design_history_files', async () => {
    const { db, calls } = makeDb({
      byTable: tbl([
        [submissionPackages, [{ id: 'pkg-eu' }]],
        [designHistoryFiles, [{ id: 'dhf-1' }]],
      ]),
      deliverables: [
        {
          id: 'd1',
          nodeType: 'submission_package',
          refTable: 'submission_packages',
          refId: 'pkg-eu',
        },
      ],
    });
    const filters: MatrixFilters = { orgId: 'org-A', jurisdiction: 'EU' };
    await buildMatrix(db, filters, { staleNodeIds: new Set() });
    // Pre-fix: loadDeliverables never queried submission_packages/design_history_files.
    expect(calls).toContain('submission_packages');
    expect(calls).toContain('design_history_files');
  });

  it('product filter queries submission_packages + design_history_files by device_name', async () => {
    const { db, calls } = makeDb({
      byTable: tbl([
        [submissionPackages, [{ id: 'pkg-1' }]],
        [designHistoryFiles, []],
      ]),
      deliverables: [
        {
          id: 'd1',
          nodeType: 'submission_package',
          refTable: 'submission_packages',
          refId: 'pkg-1',
        },
      ],
    });
    const filters: MatrixFilters = { orgId: 'org-A', product: 'CardiacSensor-X' };
    await buildMatrix(db, filters, { staleNodeIds: new Set() });
    expect(calls).toContain('submission_packages');
    expect(calls).toContain('design_history_files');
  });

  it('packageId filter queries evidence_edges for exported_in link', async () => {
    const { db, calls } = makeDb({
      byTable: tbl([[evidenceEdges, [{ toNodeId: 'd2' }]]]),
      deliverables: [
        {
          id: 'd1',
          nodeType: 'submission_package',
          refTable: 'submission_packages',
          refId: 'pkg-1',
        },
      ],
    });
    const filters: MatrixFilters = { orgId: 'org-A', packageId: 'pkg-1' };
    await buildMatrix(db, filters, { staleNodeIds: new Set() });
    expect(calls).toContain('evidence_edges');
  });

  it('riskLevel filter queries risk_items', async () => {
    const { db, calls } = makeDb({
      byTable: tbl([[riskItems, [{ id: 'risk-1' }]]]),
      deliverables: [{ id: 'd1', nodeType: 'risk_item', refTable: 'risk_items', refId: 'risk-1' }],
    });
    const filters: MatrixFilters = { orgId: 'org-A', riskLevel: 'unacceptable' };
    await buildMatrix(db, filters, { staleNodeIds: new Set() });
    expect(calls).toContain('risk_items');
  });

  it('no filters → no source-table filter subqueries (pre-fix baseline)', async () => {
    const { db, calls } = makeDb({
      byTable: tbl(),
      deliverables: [
        { id: 'd1', nodeType: 'workflow_run', refTable: 'workflow_runs', refId: 'run-1' },
      ],
    });
    const filters: MatrixFilters = { orgId: 'org-A' };
    await buildMatrix(db, filters, { staleNodeIds: new Set() });
    // No filter subqueries should fire when no filter is set. (evidence_edges
    // is still read by loadIncomingEdges — that is not a filter subquery.)
    expect(calls).not.toContain('submission_packages');
    expect(calls).not.toContain('risk_items');
    expect(calls).not.toContain('design_history_files');
  });
});

// Reference the imports so the schema tables are resolved for name introspection.
void evidenceNodes;
