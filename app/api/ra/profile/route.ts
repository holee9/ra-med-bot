// @MX:ANCHOR [AUTO] Profile Route — GET (read) + PATCH (update)
// @MX:REASON Public API boundary for user profile read/update.
// Called from profile page and client-side preference wiring.
// @MX:SPEC SPEC-REGULA-ENTERPRISE-001 (REQ-ENTERPRISE-057, 058, 059)

import { writeAudit } from '@/lib/audit';
import { withPermission } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// REQ-ENTERPRISE-058: Zod schema for PATCH body — all fields optional.
// theme and locale are accepted but not persisted to DB (client-side storage).
const PatchSchema = z
  .object({
    notificationPref: z.record(z.unknown()).optional(),
    theme: z.enum(['light', 'dark']).optional(),
    locale: z.enum(['ko', 'en']).optional(),
  })
  .strip();

// GET /api/ra/profile — returns current user's profile.
// REQ-ENTERPRISE-057
export const GET = withPermission('profile.edit', async (_req, _ctx, session) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      notificationPref: users.notificationPref,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!rows[0]) {
    return Response.json({ error: 'user_not_found' }, { status: 404 });
  }

  return Response.json(rows[0]);
});

// PATCH /api/ra/profile — updates user profile preferences.
// REQ-ENTERPRISE-058
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

  const { notificationPref, theme, locale } = parsed.data;

  // Only update DB columns that are actually stored in the users table.
  // theme and locale are client-side preferences — accepted but not persisted.
  let profileRow: {
    id: string;
    email: string;
    name: string;
    role: string;
    notificationPref: unknown;
  } | null = null;

  if (notificationPref !== undefined) {
    // Update notificationPref in DB
    const rows = await db
      .update(users)
      .set({ notificationPref })
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        notificationPref: users.notificationPref,
      });

    profileRow = rows[0] ?? null;
  } else {
    // No DB fields to update — read current profile for response
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        notificationPref: users.notificationPref,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    profileRow = rows[0] ?? null;
  }

  if (!profileRow) {
    return Response.json({ error: 'user_not_found' }, { status: 404 });
  }

  await writeAudit({
    action: 'profile.update',
    actor_id: session.user.id,
    resource_type: 'user',
    resource_id: session.user.id,
    meta_json: {
      ...(notificationPref !== undefined && { notificationPref: true }),
      ...(theme !== undefined && { theme }),
      ...(locale !== undefined && { locale }),
    },
  });

  // Echo theme/locale back in the response for client-side compatibility.
  return Response.json({
    ...profileRow,
    ...(theme !== undefined && { theme }),
    ...(locale !== undefined && { locale }),
  });
});
