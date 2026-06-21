// @MX:NOTE [AUTO] T-005 RED phase — gate-1-checkpoint script unit tests.
// @MX:SPEC SPEC-REGULA-QA-IMPLEMENTATION-CHECKPOINT-001 (REQ-G1-001 through REQ-G1-007)

import { describe, expect, it } from 'vitest';
import {
  checkFileForPlaceholderTodos,
  formatCheckpointComment,
} from '../../../scripts/qa/gate-1-checkpoint';

describe('checkFileForPlaceholderTodos', () => {
  it('returns empty array for clean route handler code', () => {
    const content = `
export async function POST(req: Request) {
  const data = await req.json();
  await writeAudit({ action: 'create', actor_id: 'u1', resource_type: 'item', resource_id: '1' });
  return new Response(JSON.stringify(data), { status: 201 });
}
`;
    const violations = checkFileForPlaceholderTodos(content, 'app/api/items/route.ts');
    expect(violations).toHaveLength(0);
  });

  it('returns violation for TODO in state-mutating route handler body', () => {
    const content = `
export async function POST(req: Request) {
  const data = await req.json(); // TODO: validate input schema
  return new Response(null, { status: 201 });
}
`;
    const violations = checkFileForPlaceholderTodos(content, 'app/api/items/route.ts');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('app/api/items/route.ts');
    expect(violations[0]).toContain('TODO in state-mutating route');
  });

  it('returns violation for FIXME in PATCH handler', () => {
    const content = `
export const PATCH = withPermission('item.update', async (req, ctx, session) => {
  const placeholder = 'FIXME: implement proper update logic';
  return new Response(null, { status: 204 });
});
`;
    const violations = checkFileForPlaceholderTodos(content, 'app/api/items/[id]/route.ts');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('TODO in state-mutating route');
  });

  it('ignores files without state-mutating route exports', () => {
    const content = `
// TODO: add more utility functions
export function helperFn() {
  // FIXME: this is a placeholder
  return 42;
}
`;
    const violations = checkFileForPlaceholderTodos(content, 'lib/utils.ts');
    expect(violations).toHaveLength(0);
  });

  it('ignores TODOs in pure comment-only lines', () => {
    const content = `
// TODO: consider refactoring in future
// TODO: add more tests
export async function DELETE(req: Request) {
  await db.delete(items).where(eq(items.id, 'x'));
  return new Response(null, { status: 204 });
}
`;
    const violations = checkFileForPlaceholderTodos(content, 'app/api/items/route.ts');
    expect(violations).toHaveLength(0);
  });

  it('ignores TODOs in GET handlers (not state-mutating)', () => {
    const content = `
export async function GET(req: Request) {
  const result = 'TODO: return real data';
  return new Response(result, { status: 200 });
}
`;
    // GET only — no state-mutating export, so no violations
    const violations = checkFileForPlaceholderTodos(content, 'app/api/items/route.ts');
    expect(violations).toHaveLength(0);
  });

  it('returns violation line number in message', () => {
    const content = `export async function POST(req: Request) {
  const x = 1; // TODO: remove this
  return new Response(null, { status: 201 });
}`;
    const violations = checkFileForPlaceholderTodos(content, 'app/api/test/route.ts');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toContain('line 2');
  });
});

describe('formatCheckpointComment', () => {
  it('includes ### QA checkpoint header', () => {
    const comment = formatCheckpointComment({
      typecheckPassed: true,
      lintPassed: true,
      testsPassed: true,
      contractResults: [],
      violations: [],
      changeDescription: 'Added validation logic',
    });
    expect(comment).toContain('### QA checkpoint');
  });

  it('includes change description', () => {
    const comment = formatCheckpointComment({
      typecheckPassed: true,
      lintPassed: true,
      testsPassed: true,
      contractResults: [],
      violations: [],
      changeDescription: 'Gate 1 implementation complete',
    });
    expect(comment).toContain('Gate 1 implementation complete');
  });

  it('marks PASS when all checks pass', () => {
    const comment = formatCheckpointComment({
      typecheckPassed: true,
      lintPassed: true,
      testsPassed: true,
      contractResults: [],
      violations: [],
      changeDescription: 'All good',
    });
    expect(comment).toContain('PASS');
    expect(comment).not.toContain('FAIL');
  });

  it('marks FAIL when typecheck fails', () => {
    const comment = formatCheckpointComment({
      typecheckPassed: false,
      lintPassed: true,
      testsPassed: true,
      contractResults: [],
      violations: [],
      changeDescription: 'Type error present',
    });
    expect(comment).toContain('FAIL');
  });

  it('marks FAIL when lint fails', () => {
    const comment = formatCheckpointComment({
      typecheckPassed: true,
      lintPassed: false,
      testsPassed: true,
      contractResults: [],
      violations: [],
      changeDescription: 'Lint error present',
    });
    expect(comment).toContain('FAIL');
  });

  it('marks FAIL when tests fail', () => {
    const comment = formatCheckpointComment({
      typecheckPassed: true,
      lintPassed: true,
      testsPassed: false,
      contractResults: [],
      violations: [],
      changeDescription: 'Tests broken',
    });
    expect(comment).toContain('FAIL');
  });

  it('marks FAIL when violations present', () => {
    const comment = formatCheckpointComment({
      typecheckPassed: true,
      lintPassed: true,
      testsPassed: true,
      contractResults: [],
      violations: ['app/api/test/route.ts: line 5: TODO in state-mutating route'],
      changeDescription: 'Violations found',
    });
    expect(comment).toContain('FAIL');
    expect(comment).toContain('Violations');
  });

  it('includes contract results section when provided', () => {
    const comment = formatCheckpointComment({
      typecheckPassed: true,
      lintPassed: true,
      testsPassed: true,
      contractResults: ['audit-completeness: ✓ PASS', 'rbac-coverage: ✓ PASS'],
      violations: [],
      changeDescription: 'With contracts',
    });
    expect(comment).toContain('Contract checks');
    expect(comment).toContain('audit-completeness');
    expect(comment).toContain('rbac-coverage');
  });

  it('includes PASS checkmarks for passing checks', () => {
    const comment = formatCheckpointComment({
      typecheckPassed: true,
      lintPassed: true,
      testsPassed: true,
      contractResults: [],
      violations: [],
      changeDescription: 'All passing',
    });
    expect(comment).toContain('typecheck');
    expect(comment).toContain('lint');
    expect(comment).toContain('tests');
  });
});
