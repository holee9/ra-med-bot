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
// REQ-TENANT-001: department field added for secondary RBAC axis.
const PatchSchema = z
  .object({
    notificationPref: z.record(z.unknown()).optional(),
    theme: z.enum(['light', 'dark']).optional(),
    locale: z.enum(['ko', 'en']).optional(),
    department: z.enum(['RA', 'Dev', 'Exec', 'External']).optional(),
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

  const { notificationPref, theme, locale, department } = parsed.data;

  // Only update DB columns that are actually stored in the users table.
  // theme and locale are client-side preferences — accepted but not persisted.
  let profileRow: {
    id: string;
    email: string;
    name: string;
    role: string;
    notificationPref: unknown;
    department: string | null;
  } | null = null;

  const dbUpdates: { notificationPref?: unknown; department?: 'RA' | 'Dev' | 'Exec' | 'External' } =
    {};
  if (notificationPref !== undefined) dbUpdates.notificationPref = notificationPref;
  if (department !== undefined) dbUpdates.department = department;

  if (Object.keys(dbUpdates).length > 0) {
    // 21 CFR Part 11 §11.10(e) — mutation + audit in same db.transaction (Issue #378)
    const rows = await db.transaction(async (tx) => {
      const updated = await tx
        .update(users)
        .set(dbUpdates)
        .where(eq(users.id, session.user.id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          notificationPref: users.notificationPref,
          department: users.department,
        });

      // Only audit when the user row matched — preserves the original
      // "404 (no match) → no audit row" semantics, while keeping a successful
      // mutation + its audit atomic in one tx (Issue #378).
      if (updated.length > 0) {
        await writeAudit(
          {
            action: 'profile.update',
            actor_id: session.user.id,
            resource_type: 'user',
            resource_id: session.user.id,
            meta_json: {
              ...(notificationPref !== undefined && { notificationPref: true }),
              ...(theme !== undefined && { theme }),
              ...(locale !== undefined && { locale }),
              ...(department !== undefined && { department }),
            },
          },
          tx,
        );
      }

      return updated;
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
        department: users.department,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    profileRow = rows[0] ?? null;

    // Audit-only path (no DB mutation). Skip on 404 to match the original
    // "no matching user → no audit row" behavior (Issue #378).
    if (profileRow) {
      await writeAudit({
        action: 'profile.update',
        actor_id: session.user.id,
        resource_type: 'user',
        resource_id: session.user.id,
        meta_json: {
          ...(notificationPref !== undefined && { notificationPref: true }),
          ...(theme !== undefined && { theme }),
          ...(locale !== undefined && { locale }),
          ...(department !== undefined && { department }),
        },
      });
    }
  }

  if (!profileRow) {
    return Response.json({ error: 'user_not_found' }, { status: 404 });
  }

  // Echo theme/locale back in the response for client-side compatibility.
  return Response.json({
    ...profileRow,
    ...(theme !== undefined && { theme }),
    ...(locale !== undefined && { locale }),
  });
});
