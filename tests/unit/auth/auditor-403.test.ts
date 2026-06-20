// @MX:NOTE [AUTO] TDD RED — auditor write-block + audit.denied logging (SPEC-REGULA-AUDITOR-VIEW-001).
// @MX:SPEC SPEC-REGULA-AUDITOR-VIEW-001 (AC #2, #3)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock writeAudit BEFORE importing withPermission so the wrapper closes over the spy.
const writeAuditMock = vi.fn((_event: unknown) => Promise.resolve());
vi.mock('@/lib/audit', () => ({
  writeAudit: (event: unknown) => writeAuditMock(event),
}));

// Mock auth() so we can inject an auditor session.
const authMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => authMock(),
}));

// Mock ACL membership checks — auditor is org member.
vi.mock('@/lib/auth/acl', () => ({
  isOrgMember: () => Promise.resolve(true),
  isProjectMember: () => Promise.resolve(true),
}));

import type { Role } from '@/lib/auth/rbac';
import { withPermission } from '@/lib/auth/with-permission';

function makeSession(role: Role) {
  return {
    user: {
      id: `user-${role}`,
      role,
      organizationId: 'org-1',
      email: `${role}@example.com`,
    },
  };
}

function makeRequest(method: string): Request {
  return new Request('https://example.com/api/ra/test', { method });
}

describe('SPEC-REGULA-AUDITOR-VIEW-001 — auditor write-block (AC #2, #3)', () => {
  beforeEach(() => {
    writeAuditMock.mockClear();
    authMock.mockClear();
  });

  it('auditor POST on a write endpoint returns 403', async () => {
    authMock.mockResolvedValue(makeSession('auditor'));
    const handler = vi.fn(() => Promise.resolve(new Response('ok', { status: 200 })));
    const wrapped = withPermission('consult.create', handler);

    const res = await wrapped(makeRequest('POST'), {});

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('auditor DELETE on a write endpoint returns 403', async () => {
    authMock.mockResolvedValue(makeSession('auditor'));
    const handler = vi.fn(() => Promise.resolve(new Response('ok', { status: 200 })));
    const wrapped = withPermission('conversation.delete', handler);

    const res = await wrapped(makeRequest('DELETE'), {});

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('auditor PATCH on a write endpoint returns 403', async () => {
    authMock.mockResolvedValue(makeSession('auditor'));
    const handler = vi.fn(() => Promise.resolve(new Response('ok', { status: 200 })));
    const wrapped = withPermission('templates.edit', handler);

    const res = await wrapped(makeRequest('PATCH'), {});

    expect(res.status).toBe(403);
  });

  it('auditor PUT on a write endpoint returns 403', async () => {
    authMock.mockResolvedValue(makeSession('auditor'));
    const handler = vi.fn(() => Promise.resolve(new Response('ok', { status: 200 })));
    const wrapped = withPermission('checklist.update', handler);

    const res = await wrapped(makeRequest('PUT'), {});

    expect(res.status).toBe(403);
  });

  it('403 response body includes auditor marker', async () => {
    authMock.mockResolvedValue(makeSession('auditor'));
    const handler = vi.fn();
    const wrapped = withPermission('consult.create', handler);

    const res = await wrapped(makeRequest('POST'), {});
    const body = await res.json();

    expect(body).toHaveProperty('error');
    expect(body.read_only_role).toBe(true);
  });

  it('auditor write attempt logs audit.denied with actor + attempted action + timestamp context', async () => {
    authMock.mockResolvedValue(makeSession('auditor'));
    const handler = vi.fn();
    const wrapped = withPermission('consult.create', handler);

    await wrapped(makeRequest('POST'), {});

    expect(writeAuditMock).toHaveBeenCalledTimes(1);
    const call = writeAuditMock.mock.calls[0];
    const event = (call?.[0] ?? {}) as {
      action: string;
      actor_id: string;
      meta_json: Record<string, unknown>;
    };
    expect(event.action).toBe('audit.denied');
    expect(event.actor_id).toBe('user-auditor');
    expect(event.meta_json).toMatchObject({
      attemptedAction: 'consult.create',
      method: 'POST',
      reason: 'auditor_read_only',
    });
  });

  it('auditor GET on an allowed read endpoint still succeeds (no false-positive block)', async () => {
    authMock.mockResolvedValue(makeSession('auditor'));
    const handler = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    const wrapped = withPermission('audit.read' as never, handler);

    const res = await wrapped(makeRequest('GET'), {});
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('auditor POST on audit.package.generate reaches the package handler', async () => {
    authMock.mockResolvedValue(makeSession('auditor'));
    const handler = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    const wrapped = withPermission('audit.package.generate' as never, handler);

    const res = await wrapped(makeRequest('POST'), {});

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(writeAuditMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'audit.denied' }),
    );
  });

  it('non-auditor role is NOT blocked by the auditor write guard (no regression)', async () => {
    authMock.mockResolvedValue(makeSession('ra-member'));
    const handler = vi.fn(() => Promise.resolve(new Response('ok', { status: 200 })));
    const wrapped = withPermission('consult.create', handler);

    const res = await wrapped(makeRequest('POST'), {});
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
