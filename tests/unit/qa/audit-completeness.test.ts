// @MX:NOTE [AUTO] T-004 RED phase — audit-completeness script unit tests.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-032, REQ-ENTERPRISE-033)

import { describe, expect, it } from 'vitest';

// These functions will be created in GREEN phase.
// Importing will fail RED until scripts/qa/audit-completeness.ts exists.
import {
  checkFileForAuditCoverage,
  checkFileForPiiLeaks,
} from '../../../scripts/qa/audit-completeness';

describe('checkFileForAuditCoverage (REQ-ENTERPRISE-032)', () => {
  it('returns no violation when export async function POST contains writeAudit', () => {
    const content = `
import { writeAudit } from '@/lib/kernel/audit';
export async function POST(req: Request) {
  await writeAudit({ action: 'llm.call', actor_id: null, resource_type: 'test', resource_id: '1' });
  return new Response(null, { status: 200 });
}
`;
    const violations = checkFileForAuditCoverage(content, 'app/api/ra/test/route.ts');
    expect(violations).toHaveLength(0);
  });

  it('returns violation when export async function PATCH does NOT contain writeAudit', () => {
    const content = `
export async function PATCH(req: Request) {
  return new Response(null, { status: 204 });
}
`;
    const violations = checkFileForAuditCoverage(content, 'app/api/ra/test/route.ts');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/PATCH/);
  });

  it('returns no violation when export const POST = withPermission(...) contains writeAudit', () => {
    const content = `
export const POST = withPermission('consult.create', async (req, ctx, session) => {
  await writeAudit({ action: 'llm.call', actor_id: null, resource_type: 'test', resource_id: '1' });
  return new Response(null, { status: 200 });
});
`;
    const violations = checkFileForAuditCoverage(content, 'app/api/ra/test/route.ts');
    expect(violations).toHaveLength(0);
  });

  it('returns no violation when a route delegates to an approved audit wrapper', () => {
    const content = `
import { auditCerExported } from '@/lib/cer/audit';
export const POST = withPermission('consult.create', async (req, ctx, session) => {
  await auditCerExported(session.user.id, 'run-1', 'pdf');
  return new Response(null, { status: 200 });
});
`;
    const violations = checkFileForAuditCoverage(content, 'app/api/ra/test/route.ts');
    expect(violations).toHaveLength(0);
  });

  it('returns violation when export const DELETE = withPermission(...) does NOT contain writeAudit', () => {
    const content = `
export const DELETE = withPermission('consult.create', async (req, ctx, session) => {
  return new Response(null, { status: 204 });
});
`;
    const violations = checkFileForAuditCoverage(content, 'app/api/ra/test/route.ts');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/DELETE/);
  });

  it('ignores GET handlers (read-only, no audit required)', () => {
    const content = `
export async function GET(req: Request) {
  return new Response(null, { status: 200 });
}
`;
    const violations = checkFileForAuditCoverage(content, 'app/api/ra/test/route.ts');
    expect(violations).toHaveLength(0);
  });

  it('skips handler with audit-check-ignore comment', () => {
    const content = `
/* audit-check-ignore: read-only endpoint, no state mutation */
export async function PATCH(req: Request) {
  return new Response(null, { status: 204 });
}
`;
    const violations = checkFileForAuditCoverage(content, 'app/api/ra/test/route.ts');
    expect(violations).toHaveLength(0);
  });
});

describe('checkFileForPiiLeaks (REQ-ENTERPRISE-033)', () => {
  it('returns no violation for normal meta_json content', () => {
    const content = `
await writeAudit({ action: 'checklist.toggle', actor_id: 'u1', resource_type: 'block', resource_id: 'b1', meta_json: { blockId: 'b1', messageId: 'm1' } });
`;
    const violations = checkFileForPiiLeaks(content, 'app/api/ra/test/route.ts');
    expect(violations).toHaveLength(0);
  });

  it('returns PII violation when meta includes "question" key', () => {
    const content = `
await writeAudit({ action: 'llm.call', actor_id: 'u1', resource_type: 'msg', resource_id: 'r1', meta_json: { question: 'What is the dosage?' } });
`;
    const violations = checkFileForPiiLeaks(content, 'app/api/ra/test/route.ts');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/question/i);
  });

  it('returns PII violation when meta includes "email" key', () => {
    const content = `
await writeAudit({ action: 'auth.login', actor_id: null, resource_type: 'session', resource_id: 's1', meta_json: { email: 'user@example.com' } });
`;
    const violations = checkFileForPiiLeaks(content, 'app/api/ra/test/route.ts');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/email/i);
  });

  it('returns PII violation when meta includes "answer" key', () => {
    const content = `
await writeAudit({ action: 'llm.call', actor_id: 'u1', resource_type: 'msg', resource_id: 'r1', meta_json: { answer: 'Detailed response here...' } });
`;
    const violations = checkFileForPiiLeaks(content, 'app/api/ra/test/route.ts');
    expect(violations.length).toBeGreaterThan(0);
  });

  it('returns PII violation for string value longer than 500 chars', () => {
    const longString = 'a'.repeat(501);
    const content = `
await writeAudit({ action: 'llm.call', actor_id: 'u1', resource_type: 'msg', resource_id: 'r1', meta_json: { summary: '${longString}' } });
`;
    const violations = checkFileForPiiLeaks(content, 'app/api/ra/test/route.ts');
    expect(violations.length).toBeGreaterThan(0);
  });
});
