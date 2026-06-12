// @MX:SPEC SPEC-REGULA-DIGEST-001
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { writeAudit } from '../../../../../lib/audit';
import { withPermission } from '../../../../../lib/auth/with-permission';
import { db } from '../../../../../lib/db/client';
import { orgDigestPreferences, weeklyDigests } from '../../../../../lib/db/schema';
import { sendDigestEmail } from '../../../../../lib/digest/email-sender';
import { generateWeeklyDigest } from '../../../../../lib/digest/digest-generator';

const RequestSchema = z.object({
  weekId: z
    .string()
    .regex(/^\d{4}-W\d{2}$/)
    .optional(),
  sendEmail: z.boolean().default(false),
});

export const POST = withPermission('dashboard.view', async (req, _ctx, session) => {
  const orgId = session.user.organizationId;
  if (!orgId) {
    return Response.json({ error: 'No organization' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = await generateWeeklyDigest(orgId, parsed.data.weekId);

  await writeAudit({
    actor_id: session.user.id,
    action: 'digest_generated',
    resource_type: 'weekly_digest',
    resource_id: payload.week_id,
    meta_json: { orgId, updateCount: payload.update_count },
  });

  if (parsed.data.sendEmail) {
    const prefs = await db
      .select()
      .from(orgDigestPreferences)
      .where(eq(orgDigestPreferences.orgId, orgId))
      .limit(1);
    if (prefs[0]?.recipientEmails?.length) {
      await sendDigestEmail(orgId, payload, prefs[0].recipientEmails);
      await db
        .update(weeklyDigests)
        .set({ emailSentAt: new Date() })
        .where(eq(weeklyDigests.orgId, orgId));
      await writeAudit({
        actor_id: session.user.id,
        action: 'digest_emailed',
        resource_type: 'weekly_digest',
        resource_id: payload.week_id,
      });
    }
  }

  return Response.json({ success: true, digest: payload });
});
