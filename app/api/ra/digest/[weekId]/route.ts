// @MX:SPEC SPEC-REGULA-DIGEST-001
// Public shareable digest view — token-gated, no auth required.
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../lib/db/client';
import { weeklyDigests } from '../../../../../lib/db/schema';

export async function GET(req: Request, { params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return Response.json({ error: 'share_token_required' }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(weeklyDigests)
    .where(and(eq(weeklyDigests.weekId, weekId), eq(weeklyDigests.shareToken, token)))
    .limit(1);

  const digest = rows[0];
  if (!digest) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json({
    digest: digest.digestJson,
    weekId: digest.weekId,
    generatedAt: digest.generatedAt,
  });
}
