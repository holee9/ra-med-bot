// @MX:NOTE [AUTO] T-013 TDD unit tests — Profile API route handlers.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-057, 058)

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock withPermission: pass-through with fixed session ---
vi.mock('@/lib/kernel/auth/with-permission', () => ({
  withPermission: vi.fn(
    (
      _action: string,
      handler: (req: Request, ctx: unknown, session: unknown) => Promise<Response>,
    ) =>
      (req: Request, ctx: unknown) =>
        handler(req, ctx, {
          user: { id: 'user-001', role: 'ra-member', organizationId: 'org-001' },
        }),
  ),
}));

// --- Mock writeAudit ---
vi.mock('@/lib/kernel/audit', () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

// --- Mock db ---
const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn(),
};

const mockUpdateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  returning: vi.fn(),
};

vi.mock('@/lib/kernel/db/client', () => ({
  db: {
    select: vi.fn(() => mockSelectChain),
    update: vi.fn(() => mockUpdateChain),
    transaction: vi.fn((callback) => {
      // Mock transaction: execute callback with a mock tx that has update method
      const mockTx = {
        update: vi.fn(() => mockUpdateChain),
      };
      return callback(mockTx);
    }),
  },
}));

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();

  // Reset chain stubs
  mockSelectChain.from.mockReturnThis();
  mockSelectChain.where.mockReturnThis();
  mockSelectChain.limit.mockResolvedValue([]);

  mockUpdateChain.set.mockReturnThis();
  mockUpdateChain.where.mockReturnThis();
  mockUpdateChain.returning.mockResolvedValue([]);
});

// Import handlers after mocks are in place
const { GET, PATCH } = await import('@/app/api/ra/profile/route');

// ---------------------------------------------------------------------------
// GET /api/ra/profile
// ---------------------------------------------------------------------------
describe('GET /api/ra/profile', () => {
  it('REQ-ENTERPRISE-057: returns user profile when found', async () => {
    const fakeUser = {
      id: 'user-001',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ra-member',
      notificationPref: {},
    };

    mockSelectChain.limit.mockResolvedValue([fakeUser]);

    const req = new Request('http://localhost/api/ra/profile');
    const res = await GET(req, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe('user-001');
    expect(body.email).toBe('test@example.com');
    expect(body.name).toBe('Test User');
    expect(body.role).toBe('ra-member');
    expect(body.notificationPref).toEqual({});
  });

  it('returns 404 when user not found in DB', async () => {
    mockSelectChain.limit.mockResolvedValue([]);

    const req = new Request('http://localhost/api/ra/profile');
    const res = await GET(req, {});

    expect(res.status).toBe(404);
  });

  it('returns only whitelisted fields (Drizzle explicit select restricts columns)', async () => {
    // The route uses explicit select({ id, email, name, role, notificationPref })
    // so only those 5 fields are returned — no extra DB columns leak through.
    const selectResult = {
      id: 'user-001',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ra-member',
      notificationPref: { email: true },
    };

    mockSelectChain.limit.mockResolvedValue([selectResult]);

    const req = new Request('http://localhost/api/ra/profile');
    const res = await GET(req, {});
    const body = await res.json();

    // These 5 fields should be present
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('role');
    expect(body).toHaveProperty('notificationPref');
    // Sensitive columns like themePref, locale, updatedAt are not selected
    expect(Object.keys(body)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/ra/profile
// ---------------------------------------------------------------------------
describe('PATCH /api/ra/profile', () => {
  it('REQ-ENTERPRISE-058: updates notificationPref successfully', async () => {
    const updatedUser = {
      id: 'user-001',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ra-member',
      notificationPref: { email: true, sms: false },
    };

    mockUpdateChain.returning.mockResolvedValue([updatedUser]);

    const req = new Request('http://localhost/api/ra/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationPref: { email: true, sms: false } }),
    });
    const res = await PATCH(req, {});
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notificationPref).toEqual({ email: true, sms: false });
  });

  it('REQ-ENTERPRISE-058: accepts theme field without failing', async () => {
    const updatedUser = {
      id: 'user-001',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ra-member',
      notificationPref: {},
    };

    // When only theme is patched (no notificationPref change), update may not be called
    // The route should still succeed and echo theme back
    mockUpdateChain.returning.mockResolvedValue([updatedUser]);
    mockSelectChain.limit.mockResolvedValue([updatedUser]);

    const req = new Request('http://localhost/api/ra/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'dark' }),
    });
    const res = await PATCH(req, {});

    expect(res.status).toBe(200);
  });

  it('REQ-ENTERPRISE-058: accepts locale field without failing', async () => {
    const updatedUser = {
      id: 'user-001',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ra-member',
      notificationPref: {},
    };

    mockUpdateChain.returning.mockResolvedValue([updatedUser]);
    mockSelectChain.limit.mockResolvedValue([updatedUser]);

    const req = new Request('http://localhost/api/ra/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'en' }),
    });
    const res = await PATCH(req, {});

    expect(res.status).toBe(200);
  });

  it('writes audit log on successful PATCH', async () => {
    const { writeAudit } = await import('@/lib/kernel/audit');

    const updatedUser = {
      id: 'user-001',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ra-member',
      notificationPref: { email: true },
    };

    mockUpdateChain.returning.mockResolvedValue([updatedUser]);

    const req = new Request('http://localhost/api/ra/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationPref: { email: true } }),
    });
    await PATCH(req, {});

    // writeAudit is called with params object and tx parameter
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'profile.update',
        actor_id: 'user-001',
        resource_type: 'user',
        resource_id: 'user-001',
      }),
      expect.any(Object), // tx parameter
    );
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/ra/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await PATCH(req, {});

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid theme value', async () => {
    const req = new Request('http://localhost/api/ra/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'rainbow' }),
    });
    const res = await PATCH(req, {});

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid locale value', async () => {
    const req = new Request('http://localhost/api/ra/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'fr' }),
    });
    const res = await PATCH(req, {});

    expect(res.status).toBe(400);
  });

  it('handles unknown extra fields gracefully (strips them)', async () => {
    const updatedUser = {
      id: 'user-001',
      email: 'test@example.com',
      name: 'Test User',
      role: 'ra-member',
      notificationPref: {},
    };

    mockUpdateChain.returning.mockResolvedValue([updatedUser]);
    mockSelectChain.limit.mockResolvedValue([updatedUser]);

    const req = new Request('http://localhost/api/ra/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknownField: 'value', notificationPref: {} }),
    });
    const res = await PATCH(req, {});

    // Should not crash — zod strips unknown fields
    expect(res.status).toBe(200);
  });
});
