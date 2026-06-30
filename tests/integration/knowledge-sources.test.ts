// @MX:NOTE [AUTO] Integration tests for Knowledge Sources API — CRUD + sync + IDOR + audit.
// @MX:SPEC Issue #307 D-2 (Knowledge Sources API)

import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/ra/knowledge-sources/route';
import { POST as POST_SYNC } from '@/app/api/ra/knowledge-sources/[id]/sync/route';
import { DELETE as DELETE_ID } from '@/app/api/ra/knowledge-sources/[id]/route';
import { db } from '@/lib/db/client';
import { knowledgeSources, auditLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';

// Mock auth module
vi.mock('@/lib/auth');

// Mock withPermission — capa 패턴: currentSession 주입 (handler 3인자, 반환 2인자 Next.js).
let currentSession: any = null;
vi.mock('@/lib/auth/with-permission', () => ({
  withPermission: (_action: string, handler: any) =>
    async (req: Request, ctx: any) => handler(req, ctx, currentSession),
}));

// Mock session creator — currentSession 설정 + { session, userId } 반환
function createMockSession(orgId?: string): { session: any; userId: string } {
  const userId = randomUUID();
  const session = {
    user: {
      id: userId,
      role: 'ra-lead' as const,
      organizationId: orgId || randomUUID(),
      email: 'test@example.com',
    },
  };
  currentSession = session;
  return { session, userId };
}

describe('Knowledge Sources API', () => {
  let sourceId: string;
  let testOrgId: string;

  beforeEach(async () => {
    testOrgId = randomUUID();
    // Clean up test data
    await db.delete(auditLogs);
    await db.delete(knowledgeSources);
  });

  describe('POST /api/ra/knowledge-sources', () => {
    it('should create a knowledge source with valid git URL', async () => {
      const { session, userId } = createMockSession(testOrgId);

      const request = new Request('http://localhost/api/ra/knowledge-sources', {
        method: 'POST',
        body: JSON.stringify({
          git_url: 'https://github.com/owner/repo.git',
          branch: 'main',
          auth_token: null,
        }),
      });

      const response = await POST(request, {});
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.source).toBeDefined();
      expect(data.source.gitUrl).toBe('https://github.com/owner/repo.git');
      expect(data.source.branch).toBe('main');
      expect(data.source.organizationId).toBe(session.user.organizationId);

      sourceId = data.source.id;
    });

    it('should reject invalid git URL', async () => {
      const { session } = createMockSession(testOrgId);

      const request = new Request('http://localhost/api/ra/knowledge-sources', {
        method: 'POST',
        body: JSON.stringify({
          git_url: 'not-a-git-url',
          branch: 'main',
        }),
      });

      const response = await POST(request, {});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('invalid_git_url');
    });

    it('should create audit log on create', async () => {
      const { session, userId } = createMockSession(testOrgId);

      const request = new Request('http://localhost/api/ra/knowledge-sources', {
        method: 'POST',
        body: JSON.stringify({
          git_url: 'https://github.com/test/repo.git',
          branch: 'main',
        }),
      });

      await POST(request, {});

      const audits = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'knowledge_source.created' as never));

      expect(audits.length).toBeGreaterThan(0);
      expect(audits[0]?.actorId).toBe(userId);
      expect(audits[0]?.resourceType).toBe('knowledgeSource');
    });
  });

  describe('GET /api/ra/knowledge-sources', () => {
    it('should list knowledge sources for org', async () => {
      const { session, userId } = createMockSession(testOrgId);

      // Create a test source first
      await db
        .insert(knowledgeSources)
        .values({
          gitUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          organizationId: testOrgId,
          createdBy: userId,
          syncStatus: 'idle',
        });

      const request = new Request('http://localhost/api/ra/knowledge-sources');
      const response = await GET(request, {});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sources).toBeDefined();
      expect(data.sources.length).toBeGreaterThan(0);
      expect(data.sources[0]?.organizationId).toBe(testOrgId);
    });
  });

  describe('DELETE /api/ra/knowledge-sources/[id]', () => {
    it('should delete a knowledge source', async () => {
      const { session, userId } = createMockSession(testOrgId);

      // Create a test source first
      const [source] = await db
        .insert(knowledgeSources)
        .values({
          gitUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          organizationId: testOrgId,
          createdBy: userId,
          syncStatus: 'idle',
        })
        .returning();

      if (!source) {
        throw new Error('Failed to create test source');
      }

      const request = new Request(`http://localhost/api/ra/knowledge-sources/${source.id}`, {
        method: 'DELETE',
      });

      const response = await DELETE_ID(request, { params: Promise.resolve({ id: source.id }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent source', async () => {
      const { session } = createMockSession(testOrgId);

      const request = new Request('http://localhost/api/ra/knowledge-sources/non-existent', {
        method: 'DELETE',
      });

      const response = await DELETE_ID(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('not_found');
    });

    it('should block cross-org access (IDOR)', async () => {
      const { session, userId } = createMockSession(testOrgId);
      const differentOrgId = randomUUID();

      // Create a source for different org
      const [source] = await db
        .insert(knowledgeSources)
        .values({
          gitUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          organizationId: differentOrgId,
          createdBy: userId,
          syncStatus: 'idle',
        })
        .returning();

      if (!source) {
        throw new Error('Failed to create test source');
      }

      const request = new Request(`http://localhost/api/ra/knowledge-sources/${source.id}`, {
        method: 'DELETE',
      });

      const response = await DELETE_ID(request, { params: Promise.resolve({ id: source.id }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('forbidden');
    });
  });

  describe('POST /api/ra/knowledge-sources/[id]/sync', () => {
    it('should trigger sync for a knowledge source', async () => {
      const { session, userId } = createMockSession(testOrgId);

      // Create a test source first
      const [source] = await db
        .insert(knowledgeSources)
        .values({
          gitUrl: 'https://github.com/test/repo.git',
          branch: 'main',
          organizationId: testOrgId,
          createdBy: userId,
          syncStatus: 'synced',
        })
        .returning();

      if (!source) {
        throw new Error('Failed to create test source');
      }

      const request = new Request(`http://localhost/api/ra/knowledge-sources/${source.id}/sync`, {
        method: 'POST',
      });

      // Mock syncKnowledgeSource to avoid actual git clone
      const { syncKnowledgeSource } = await import('@/lib/knowledge-sources/sync');
      const mockSync = vi.mocked(syncKnowledgeSource);
      mockSync.mockResolvedValue(undefined);

      const response = await POST_SYNC(request, { params: Promise.resolve({ id: source.id }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Sync completed');
    });
  });
});
