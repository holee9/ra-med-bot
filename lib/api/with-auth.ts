// @MX:ANCHOR [AUTO] withAuth — reusable Next.js Route Handler session guard.
// @MX:REASON Every authenticated Route Handler must call this wrapper.
// fan_in will reach 3+ once the consult, conversations, and project API routes all use it.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-058)

import { auth } from '@/lib/kernel/auth';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Auth context injected into every wrapped handler after session validation.
 */
export interface AuthContext {
  userId: string;
  orgId: string;
  email: string;
}

type AuthHandler = (req: NextRequest, ctx: AuthContext) => Promise<NextResponse>;

/**
 * Wraps a Next.js Route Handler with session validation.
 *
 * Returns 401 when no session is present.
 * Returns 403 when the session user has no organizationId.
 * Calls the inner handler with a typed AuthContext on success.
 */
export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as { id: string; email?: string; organizationId?: string };

    if (!user.organizationId) {
      return NextResponse.json({ error: 'No organization' }, { status: 403 });
    }

    return handler(req, {
      userId: user.id,
      orgId: user.organizationId,
      email: user.email ?? '',
    });
  };
}
