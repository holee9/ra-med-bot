// @MX:NOTE [AUTO] Notification Preferences — GET + PATCH /api/ra/notifications/preferences
// @MX:SPEC SPEC-REGULA-NOTIFICATIONS-001 (REQ-NOTIFY-002)
export const runtime = 'nodejs';

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Default preferences shape.
const DEFAULT_PREFS = {
  expert_review_assigned: { email: true, slack: true },
  expert_review_sla_warning: { email: true, slack: true },
  regulatory_update_high_risk: { email: true, slack: false },
  regulatory_update_weekly_digest: { email: true, slack: false },
  workflow_completed: { email: true, slack: true },
  batch_query_completed: { email: true, slack: false },
  knowledge_gap_detected: { email: false, slack: false },
};

export type NotificationPreferences = typeof DEFAULT_PREFS;

const PatchSchema = z.object({
  preferences: z.record(
    z.object({
      email: z.boolean().optional(),
      slack: z.boolean().optional(),
    }),
  ),
});

// GET — return current preferences (merged with defaults).
export const GET = withPermission('profile.edit', async (_req, _ctx, session) => {
  const [user] = await db
    .select({ notificationPref: users.notificationPref })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!user) return Response.json({ error: 'user_not_found' }, { status: 404 });

  // Merge saved prefs with defaults (saved values override defaults).
  const saved = (user.notificationPref as Partial<NotificationPreferences>) ?? {};
  const merged = { ...DEFAULT_PREFS, ...saved };

  return Response.json({ preferences: merged });
});

// PATCH — update preferences (partial merge).
export const PATCH = withPermission('profile.edit', async (req, _ctx, session) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Fetch current prefs.
  const [user] = await db
    .select({ notificationPref: users.notificationPref })
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!user) return Response.json({ error: 'user_not_found' }, { status: 404 });

  const existing = (user.notificationPref as Partial<NotificationPreferences>) ?? {};
  const updated = { ...existing };

  for (const [event, channels] of Object.entries(parsed.data.preferences)) {
    const cur = (updated[event as keyof NotificationPreferences] as Record<string, boolean>) ?? {};
    updated[event as keyof NotificationPreferences] = {
      ...cur,
      ...channels,
    } as (typeof DEFAULT_PREFS)[keyof typeof DEFAULT_PREFS];
  }

  const changedEvents = Object.keys(parsed.data.preferences).sort();

  await db.update(users).set({ notificationPref: updated }).where(eq(users.id, session.user.id));
  await writeAudit({
    actor_id: session.user.id,
    action: 'profile.update',
    resource_type: 'notification_preferences',
    resource_id: session.user.id,
    meta_json: { changedEvents },
  });

  return Response.json({ preferences: { ...DEFAULT_PREFS, ...updated } });
});
