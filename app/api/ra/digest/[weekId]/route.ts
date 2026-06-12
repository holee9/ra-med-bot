// @MX:SPEC SPEC-REGULA-DIGEST-001
// Public shareable digest view — token-based, no auth required.
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../lib/db/client';
import { weeklyDigests } from '../../../../../lib/db/schema';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ weekId: string }> },
) {
  const { weekId } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  const rows = token
    ? await db
        .select()
        .from(weeklyDigests)
        .where(
          and(
            eq(weeklyDigests.weekId, weekId),
            eq(weeklyDigests.shareToken, token),
          ),
        )
        .limit(1)
    : await db
        .select()
        .from(weeklyDigests)
        .where(eq(weeklyDigests.weekId, weekId))
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
